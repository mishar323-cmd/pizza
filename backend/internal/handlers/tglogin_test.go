package handlers

import (
	"context"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"sync"
	"testing"

	"pizza-backend/internal/db"
	"pizza-backend/internal/repo"
	"pizza-backend/internal/tgbot"
)

// fakeTelegram records what the bot sent and replays canned updates.
type fakeTelegram struct {
	mu      sync.Mutex
	sent    []map[string]any
	updates []tgbot.Update
	srv     *httptest.Server
}

func newFakeTelegram(t *testing.T) *fakeTelegram {
	f := &fakeTelegram{}
	f.srv = httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		body, _ := io.ReadAll(r.Body)
		var payload map[string]any
		_ = json.Unmarshal(body, &payload)
		f.mu.Lock()
		defer f.mu.Unlock()
		switch {
		case strings.HasSuffix(r.URL.Path, "/getMe"):
			w.Write([]byte(`{"ok":true,"result":{"id":1,"username":"delovpizza_login_bot"}}`))
		case strings.HasSuffix(r.URL.Path, "/getUpdates"):
			out, _ := json.Marshal(f.updates)
			f.updates = nil
			w.Write([]byte(`{"ok":true,"result":` + string(out) + `}`))
		default:
			payload["__method"] = r.URL.Path[strings.LastIndex(r.URL.Path, "/")+1:]
			f.sent = append(f.sent, payload)
			w.Write([]byte(`{"ok":true,"result":{}}`))
		}
	}))
	t.Cleanup(f.srv.Close)
	return f
}

func (f *fakeTelegram) lastTo(chatID float64) map[string]any {
	f.mu.Lock()
	defer f.mu.Unlock()
	for i := len(f.sent) - 1; i >= 0; i-- {
		if f.sent[i]["chat_id"] == chatID {
			return f.sent[i]
		}
	}
	return nil
}

func TestTelegramLoginIntegration(t *testing.T) {
	dsn := os.Getenv("TEST_DATABASE_URL")
	if dsn == "" {
		t.Skip("TEST_DATABASE_URL not set")
	}
	ctx := context.Background()
	pool, err := db.Open(ctx, dsn)
	if err != nil {
		t.Fatal(err)
	}
	defer pool.Close()
	for _, q := range []string{`DROP SCHEMA public CASCADE`, `CREATE SCHEMA public`} {
		if _, err := pool.Exec(ctx, q); err != nil {
			t.Fatal(err)
		}
	}
	if err := db.Migrate(ctx, pool); err != nil {
		t.Fatal(err)
	}

	fake := newFakeTelegram(t)
	cd := &CustomerDeps{Customers: repo.NewCustomers(pool), Secret: []byte("test"), Enabled: true}
	d := &TGLoginDeps{Customers: cd, Bot: tgbot.New("tok", fake.srv.URL, "sec"), Username: "delovpizza_login_bot"}

	mux := http.NewServeMux()
	mux.HandleFunc("POST /api/auth/tg/start", TGLoginStart(d))
	mux.HandleFunc("GET /api/auth/tg/status", TGLoginStatus(d))
	mux.HandleFunc("GET /api/me", Me(cd))
	api := testAPI{t, mux}

	// 1. Сайт просит ссылку.
	code, body := api.do("POST", "/api/auth/tg/start", "", nil)
	if code != 200 {
		t.Fatalf("start: %d %v", code, body)
	}
	nonce, _ := body["nonce"].(string)
	link, _ := body["link"].(string)
	if nonce == "" || !strings.Contains(link, "t.me/delovpizza_login_bot?start="+nonce) {
		t.Fatalf("bad start payload: %v", body)
	}
	if _, st := api.do("GET", "/api/auth/tg/status?nonce="+nonce, "", nil); st["status"] != "pending" {
		t.Fatalf("expected pending, got %v", st)
	}

	// 2. Клиент открыл бота по ссылке.
	const chat = 555
	handleTGUpdate(ctx, d, tgbot.Update{Message: msg(chat, chat, "/start "+nonce, nil)})
	ask := fake.lastTo(float64(chat))
	if ask == nil || !strings.Contains(ask["text"].(string), "номер") {
		t.Fatalf("bot didn't ask for the phone: %v", ask)
	}

	// 3. Чужой контакт не принимается.
	handleTGUpdate(ctx, d, tgbot.Update{Message: msg(chat, chat, "", &tgbot.Contact{PhoneNumber: "+79161234567", UserID: 999})})
	if _, st := api.do("GET", "/api/auth/tg/status?nonce="+nonce, "", nil); st["status"] != "pending" {
		t.Fatalf("foreign contact logged in: %v", st)
	}

	// 4. Свой контакт — вход готов.
	handleTGUpdate(ctx, d, tgbot.Update{Message: msg(chat, chat, "", &tgbot.Contact{PhoneNumber: "8 916 123-45-67", UserID: chat})})
	_, st := api.do("GET", "/api/auth/tg/status?nonce="+nonce, "", nil)
	if st["status"] != "ready" || st["token"] == "" {
		t.Fatalf("expected ready token, got %v", st)
	}
	token := st["token"].(string)

	// 5. Токен работает и выдаётся только один раз.
	if c, me := api.do("GET", "/api/me", token, nil); c != 200 || me["user"].(map[string]any)["phone"] != "+79161234567" {
		t.Fatalf("me: %d %v", c, me)
	}
	if _, again := api.do("GET", "/api/auth/tg/status?nonce="+nonce, "", nil); again["status"] != "used" {
		t.Fatalf("nonce reusable: %v", again)
	}

	// 6. Чужой nonce не даёт входа.
	if _, st := api.do("GET", "/api/auth/tg/status?nonce=whatever", "", nil); st["status"] != "expired" {
		t.Fatalf("unknown nonce: %v", st)
	}
}

func msg(chatID, fromID int64, text string, c *tgbot.Contact) *tgbot.Message {
	m := &tgbot.Message{Text: text, Contact: c}
	m.Chat.ID = chatID
	m.From.ID = fromID
	return m
}
