package sms

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log"
	"net/http"
	"strings"
	"time"
)

const ChannelTelegram = "telegram"

// TelegramGateway delivers the code as a Telegram message (gatewayapi.telegram.org).
// Costs about a rouble per delivered code and only works if the phone has a
// Telegram account — Fallback covers everyone else.
type TelegramGateway struct {
	Token    string
	BaseURL  string // relay, e.g. https://tg-relay.example.workers.dev/gw
	Secret   string // X-Relay-Secret of the relay
	Fallback Sender
	HTTP     *http.Client
}

func NewTelegramGateway(token, baseURL, secret string, fallback Sender) *TelegramGateway {
	return &TelegramGateway{
		Token: token, BaseURL: strings.TrimRight(baseURL, "/"), Secret: secret, Fallback: fallback,
		HTTP: &http.Client{Timeout: 15 * time.Second},
	}
}

type gwResponse struct {
	OK     bool   `json:"ok"`
	Error  string `json:"error"`
	Result struct {
		RequestID   string  `json:"request_id"`
		RequestCost float64 `json:"request_cost"`
	} `json:"result"`
}

// GatewayError is an error reported by Telegram Gateway.
type GatewayError struct{ Code string }

func (e *GatewayError) Error() string { return "telegram gateway: " + e.Code }

// noTelegram reports errors meaning "this number can't receive a Telegram
// message" — worth falling back, unlike balance or token problems.
func noTelegram(err error) bool {
	var ge *GatewayError
	if !errors.As(err, &ge) {
		return false
	}
	switch ge.Code {
	case "PHONE_NUMBER_INVALID", "PHONE_NUMBER_NOT_FOUND", "USER_NOT_FOUND",
		"SEND_ABILITY_NOT_FOUND", "SEND_ABILITY_EXPIRED", "PHONE_NUMBER_BLOCKED",
		"NOT_ELIGIBLE", "FLOOD_WAIT":
		return true
	}
	return false
}

func (g *TelegramGateway) SendCode(ctx context.Context, phone, code string) (string, string, error) {
	err := g.send(ctx, phone, code)
	if err == nil {
		return code, ChannelTelegram, nil
	}
	if g.Fallback == nil {
		return "", "", err
	}
	if !noTelegram(err) {
		// Token or balance problem: log loudly, still try not to lose the login.
		log.Printf("telegram gateway unavailable (%v), falling back", err)
	}
	return g.Fallback.SendCode(ctx, phone, code)
}

func (g *TelegramGateway) send(ctx context.Context, phone, code string) error {
	body, err := json.Marshal(map[string]any{
		"phone_number": phone,
		"code":         code,
		"ttl":          300,
	})
	if err != nil {
		return err
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, g.BaseURL+"/sendVerificationMessage", strings.NewReader(string(body)))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+g.Token)
	if g.Secret != "" {
		req.Header.Set("X-Relay-Secret", g.Secret)
	}
	resp, err := g.HTTP.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	raw, _ := io.ReadAll(io.LimitReader(resp.Body, 64<<10))
	var r gwResponse
	if err := json.Unmarshal(raw, &r); err != nil {
		return fmt.Errorf("telegram gateway decode (http %d): %w", resp.StatusCode, err)
	}
	if !r.OK {
		if r.Error != "" {
			return &GatewayError{Code: r.Error}
		}
		return fmt.Errorf("telegram gateway http %d", resp.StatusCode)
	}
	return nil
}
