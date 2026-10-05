// Package tgbot talks to the login bot: long-polls updates and replies.
// Telegram is blocked from the VPS, so requests go through the same relay as
// the order notifications (TG_API_BASE + X-Relay-Secret).
package tgbot

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"
)

type Client struct {
	token       string
	apiBase     string
	relaySecret string
	http        *http.Client
}

func New(token, apiBase, relaySecret string) *Client {
	if apiBase == "" {
		apiBase = "https://api.telegram.org"
	}
	return &Client{token: token, apiBase: apiBase, relaySecret: relaySecret,
		http: &http.Client{Timeout: 60 * time.Second}}
}

func (c *Client) Enabled() bool { return c != nil && c.token != "" }

type Contact struct {
	PhoneNumber string `json:"phone_number"`
	UserID      int64  `json:"user_id"`
}

type Message struct {
	MessageID int64 `json:"message_id"`
	From      struct {
		ID        int64  `json:"id"`
		FirstName string `json:"first_name"`
	} `json:"from"`
	Chat struct {
		ID int64 `json:"id"`
	} `json:"chat"`
	Text    string   `json:"text"`
	Contact *Contact `json:"contact"`
}

type Update struct {
	UpdateID int64    `json:"update_id"`
	Message  *Message `json:"message"`
}

func (c *Client) call(ctx context.Context, method string, payload any, out any) error {
	body, err := json.Marshal(payload)
	if err != nil {
		return err
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost,
		fmt.Sprintf("%s/bot%s/%s", c.apiBase, c.token, method), bytes.NewReader(body))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")
	if c.relaySecret != "" {
		req.Header.Set("X-Relay-Secret", c.relaySecret)
	}
	resp, err := c.http.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	raw, _ := io.ReadAll(io.LimitReader(resp.Body, 1<<20))
	var envelope struct {
		OK          bool            `json:"ok"`
		Description string          `json:"description"`
		Result      json.RawMessage `json:"result"`
	}
	if err := json.Unmarshal(raw, &envelope); err != nil {
		return fmt.Errorf("%s: decode (http %d): %w", method, resp.StatusCode, err)
	}
	if !envelope.OK {
		return fmt.Errorf("%s: %s", method, envelope.Description)
	}
	if out != nil {
		return json.Unmarshal(envelope.Result, out)
	}
	return nil
}

// GetUpdates long-polls; offset is the next update id to receive.
func (c *Client) GetUpdates(ctx context.Context, offset int64, timeoutSec int) ([]Update, error) {
	var out []Update
	err := c.call(ctx, "getUpdates", map[string]any{
		"offset":          offset,
		"timeout":         timeoutSec,
		"allowed_updates": []string{"message"},
	}, &out)
	return out, err
}

// AskPhone shows a one-button keyboard that shares the user's own number.
func (c *Client) AskPhone(ctx context.Context, chatID int64, text string) error {
	return c.call(ctx, "sendMessage", map[string]any{
		"chat_id": chatID,
		"text":    text,
		"reply_markup": map[string]any{
			"keyboard": []any{[]any{map[string]any{
				"text":            "📱 Поделиться номером",
				"request_contact": true,
			}}},
			"resize_keyboard":   true,
			"one_time_keyboard": true,
		},
	}, nil)
}

func (c *Client) Send(ctx context.Context, chatID int64, text string) error {
	return c.call(ctx, "sendMessage", map[string]any{
		"chat_id":      chatID,
		"text":         text,
		"reply_markup": map[string]any{"remove_keyboard": true},
	}, nil)
}

type Me struct {
	ID       int64  `json:"id"`
	Username string `json:"username"`
}

func (c *Client) GetMe(ctx context.Context) (*Me, error) {
	var m Me
	if err := c.call(ctx, "getMe", map[string]any{}, &m); err != nil {
		return nil, err
	}
	return &m, nil
}
