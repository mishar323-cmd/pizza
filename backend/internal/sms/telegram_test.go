package sms

import (
	"context"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"testing"
)

type recordingSender struct {
	calls int
	code  string
}

func (r *recordingSender) SendCode(_ context.Context, _, code string) (string, string, error) {
	r.calls++
	r.code = code
	return code, ChannelCall, nil
}

func fakeGateway(t *testing.T, resp string, status int) (*TelegramGateway, *recordingSender, *[]map[string]any) {
	t.Helper()
	var seen []map[string]any
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/gw/sendVerificationMessage" {
			t.Errorf("unexpected path %s", r.URL.Path)
		}
		if r.Header.Get("Authorization") != "Bearer tok" {
			t.Errorf("missing token: %q", r.Header.Get("Authorization"))
		}
		if r.Header.Get("X-Relay-Secret") != "sec" {
			t.Errorf("missing relay secret")
		}
		body, _ := io.ReadAll(r.Body)
		var m map[string]any
		_ = json.Unmarshal(body, &m)
		seen = append(seen, m)
		w.WriteHeader(status)
		w.Write([]byte(resp))
	}))
	t.Cleanup(srv.Close)
	fb := &recordingSender{}
	return NewTelegramGateway("tok", srv.URL+"/gw", "sec", fb), fb, &seen
}

func TestTelegramDelivered(t *testing.T) {
	g, fb, seen := fakeGateway(t, `{"ok":true,"result":{"request_id":"r1","request_cost":0.01}}`, 200)
	code, ch, err := g.SendCode(context.Background(), "+79161234567", "4821")
	if err != nil || ch != ChannelTelegram || code != "4821" {
		t.Fatalf("got %q %q %v", code, ch, err)
	}
	if fb.calls != 0 {
		t.Fatal("fallback used even though Telegram delivered")
	}
	if got := (*seen)[0]; got["phone_number"] != "+79161234567" || got["code"] != "4821" || got["ttl"] != float64(300) {
		t.Fatalf("payload: %v", got)
	}
}

func TestNoTelegramFallsBackToCall(t *testing.T) {
	g, fb, _ := fakeGateway(t, `{"ok":false,"error":"PHONE_NUMBER_NOT_FOUND"}`, 400)
	code, ch, err := g.SendCode(context.Background(), "+79161234567", "4821")
	if err != nil || ch != ChannelCall || code != "4821" || fb.calls != 1 {
		t.Fatalf("got %q %q %v fallback=%d", code, ch, err, fb.calls)
	}
}

func TestGatewayOutageStillSendsCode(t *testing.T) {
	// Token or balance trouble must not block logins while a fallback exists.
	g, fb, _ := fakeGateway(t, `{"ok":false,"error":"BALANCE_NOT_ENOUGH"}`, 400)
	_, ch, err := g.SendCode(context.Background(), "+79161234567", "4821")
	if err != nil || ch != ChannelCall || fb.calls != 1 {
		t.Fatalf("got %q %v fallback=%d", ch, err, fb.calls)
	}
}

func TestGatewayWithoutFallbackReturnsError(t *testing.T) {
	g, _, _ := fakeGateway(t, `{"ok":false,"error":"ACCESS_TOKEN_INVALID"}`, 401)
	g.Fallback = nil
	if _, _, err := g.SendCode(context.Background(), "+79161234567", "4821"); err == nil {
		t.Fatal("expected error")
	}
}
