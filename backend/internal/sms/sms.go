// Package sms delivers one-time login codes: by SMS, or by a flash call whose
// caller number ends with the code.
package sms

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log"
	"net/http"
	"net/url"
	"strings"
	"time"
)

const (
	ChannelSMS  = "sms"
	ChannelCall = "call"
)

// Sender delivers a login code. The flash-call provider picks the code itself,
// so the code actually delivered is returned.
type Sender interface {
	SendCode(ctx context.Context, phone, code string) (sentCode, channel string, err error)
}

// Stub logs codes instead of sending them (local dev).
type Stub struct{}

func (Stub) SendCode(_ context.Context, phone, code string) (string, string, error) {
	log.Printf("[OTP stub] %s code %s", phone, code)
	return code, ChannelSMS, nil
}

// SMSC sends via smsc.ru. Order of channels: SMS first; if the operator
// rejects it (e.g. unregistered sender name for МТС/МегаФон) — flash call.
type SMSC struct {
	Login, Password, Sender string
	PreferCall              bool
	BaseURL                 string
	HTTP                    *http.Client
}

func NewSMSC(login, password, sender string, preferCall bool) *SMSC {
	return &SMSC{
		Login: login, Password: password, Sender: sender, PreferCall: preferCall,
		BaseURL: "https://smsc.ru",
		HTTP:    &http.Client{Timeout: 15 * time.Second},
	}
}

type smscResp struct {
	ID        json.Number `json:"id"`
	Cnt       json.Number `json:"cnt"`
	Code      string      `json:"code"`
	Error     string      `json:"error"`
	ErrorCode int         `json:"error_code"`
}

// APIError is an error reported by SMSC itself.
type APIError struct {
	Code int
	Msg  string
}

func (e *APIError) Error() string { return fmt.Sprintf("smsc error %d: %s", e.Code, e.Msg) }

// Errors that mean "this channel won't work for this number", not an outage.
func channelRejected(err error) bool {
	var ae *APIError
	if !errors.As(err, &ae) {
		return false
	}
	switch ae.Code {
	case 6, // message denied (sender/operator)
		7, // wrong number format / undeliverable
		8: // can't deliver to this number
		return true
	}
	return false
}

func (s *SMSC) SendCode(ctx context.Context, phone, code string) (string, string, error) {
	if s.PreferCall {
		sent, err := s.call(ctx, phone)
		if err == nil || !channelRejected(err) {
			return sent, ChannelCall, err
		}
		log.Printf("smsc call rejected for %s, trying sms: %v", maskPhone(phone), err)
		return code, ChannelSMS, s.sms(ctx, phone, code)
	}
	err := s.sms(ctx, phone, code)
	if err == nil {
		return code, ChannelSMS, nil
	}
	if !channelRejected(err) {
		return "", "", err
	}
	log.Printf("smsc sms rejected for %s, falling back to call: %v", maskPhone(phone), err)
	sent, err := s.call(ctx, phone)
	return sent, ChannelCall, err
}

func (s *SMSC) sms(ctx context.Context, phone, code string) error {
	v := url.Values{"mes": {code + " — код для входа на delovpizza.ru"}}
	if s.Sender != "" {
		v.Set("sender", s.Sender)
	}
	_, err := s.send(ctx, phone, v)
	return err
}

func (s *SMSC) call(ctx context.Context, phone string) (string, error) {
	r, err := s.send(ctx, phone, url.Values{"mes": {"code"}, "call": {"1"}})
	if err != nil {
		return "", err
	}
	code := strings.TrimSpace(r.Code)
	if len(code) < 4 {
		return "", fmt.Errorf("smsc call: unexpected code %q", r.Code)
	}
	return code[len(code)-4:], nil
}

func (s *SMSC) send(ctx context.Context, phone string, v url.Values) (*smscResp, error) {
	v.Set("login", s.Login)
	v.Set("psw", s.Password)
	v.Set("phones", strings.TrimPrefix(phone, "+"))
	v.Set("fmt", "3")
	v.Set("charset", "utf-8")
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, s.BaseURL+"/sys/send.php", strings.NewReader(v.Encode()))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	resp, err := s.HTTP.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	body, _ := io.ReadAll(io.LimitReader(resp.Body, 64<<10))
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("smsc http %d", resp.StatusCode)
	}
	var r smscResp
	if err := json.Unmarshal(body, &r); err != nil {
		return nil, fmt.Errorf("smsc decode: %w", err)
	}
	if r.Error != "" || r.ErrorCode != 0 {
		return nil, &APIError{Code: r.ErrorCode, Msg: r.Error}
	}
	return &r, nil
}

func maskPhone(p string) string {
	if len(p) < 4 {
		return "***"
	}
	return "***" + p[len(p)-4:]
}
