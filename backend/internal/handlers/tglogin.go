package handlers

import (
	"context"
	"crypto/rand"
	"encoding/base64"
	"errors"
	"log"
	"net/http"
	"strings"
	"time"

	"pizza-backend/internal/repo"
	"pizza-backend/internal/tgbot"
)

const (
	tgLoginTTL     = 10 * time.Minute
	tgLoginPerHour = 30 // per IP, protects against nonce flooding
)

type TGLoginDeps struct {
	Customers *CustomerDeps
	Bot       *tgbot.Client
	Username  string // bot username for the t.me link
}

func (d *TGLoginDeps) enabled() bool {
	return d != nil && d.Bot.Enabled() && d.Customers != nil && d.Customers.Enabled
}

func newNonce() (string, error) {
	b := make([]byte, 16)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return base64.RawURLEncoding.EncodeToString(b), nil
}

// TGLoginStart hands the website a one-time link to the bot.
func TGLoginStart(d *TGLoginDeps) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if !d.enabled() {
			writeError(w, http.StatusServiceUnavailable, "Вход через Telegram пока недоступен")
			return
		}
		nonce, err := newNonce()
		if err != nil {
			writeError(w, http.StatusInternalServerError, "internal error")
			return
		}
		if err := d.Customers.Customers.CreateTGLogin(r.Context(), nonce, realIP(r), tgLoginTTL); err != nil {
			log.Printf("tg login create: %v", err)
			writeError(w, http.StatusInternalServerError, "internal error")
			return
		}
		writeJSON(w, http.StatusOK, map[string]any{
			"nonce": nonce,
			"link":  "https://t.me/" + strings.TrimPrefix(d.Username, "@") + "?start=" + nonce,
			"ttl":   int(tgLoginTTL.Seconds()),
		})
	}
}

// AuthMethods tells the website which login buttons to show.
func AuthMethods(d *TGLoginDeps) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		writeJSON(w, http.StatusOK, map[string]any{
			"telegram": d.enabled(),
			"phone":    d.Customers != nil && d.Customers.Enabled && d.Customers.PhoneCodes,
		})
	}
}

// TGLoginStatus is polled by the website until the bot confirms the phone.
func TGLoginStatus(d *TGLoginDeps) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		nonce := r.URL.Query().Get("nonce")
		if nonce == "" {
			writeError(w, http.StatusBadRequest, "no nonce")
			return
		}
		l, err := d.Customers.Customers.TGLoginStatus(r.Context(), nonce)
		if errors.Is(err, repo.ErrNotFound) {
			writeJSON(w, http.StatusOK, map[string]any{"status": "expired"})
			return
		}
		if err != nil {
			log.Printf("tg login status: %v", err)
			writeError(w, http.StatusInternalServerError, "internal error")
			return
		}
		switch {
		case l.UsedAt != nil:
			writeJSON(w, http.StatusOK, map[string]any{"status": "used"})
		case time.Now().After(l.ExpiresAt):
			writeJSON(w, http.StatusOK, map[string]any{"status": "expired"})
		case l.UserID == nil:
			writeJSON(w, http.StatusOK, map[string]any{"status": "pending", "opened": l.ChatID != nil})
		default:
			ok, err := d.Customers.Customers.ConsumeTGLogin(r.Context(), nonce)
			if err != nil || !ok {
				writeJSON(w, http.StatusOK, map[string]any{"status": "used"})
				return
			}
			token, err := newToken()
			if err != nil {
				writeError(w, http.StatusInternalServerError, "internal error")
				return
			}
			if err := d.Customers.Customers.CreateSession(r.Context(), *l.UserID, hashToken(token), r.UserAgent()); err != nil {
				log.Printf("tg login session: %v", err)
				writeError(w, http.StatusInternalServerError, "internal error")
				return
			}
			writeJSON(w, http.StatusOK, map[string]any{"status": "ready", "token": token})
		}
	}
}

// RunTGLoginBot long-polls the bot and turns shared contacts into logins.
func RunTGLoginBot(ctx context.Context, d *TGLoginDeps) {
	if !d.enabled() {
		return
	}
	me, err := d.Bot.GetMe(ctx)
	if err != nil {
		log.Printf("tg login bot: getMe failed: %v", err)
	} else {
		if d.Username == "" {
			d.Username = me.Username
		}
		log.Printf("tg login bot ready: @%s", me.Username)
	}

	var offset int64
	for {
		if ctx.Err() != nil {
			return
		}
		updates, err := d.Bot.GetUpdates(ctx, offset, 25)
		if err != nil {
			if ctx.Err() != nil {
				return
			}
			log.Printf("tg login bot: getUpdates: %v", err)
			time.Sleep(10 * time.Second)
			continue
		}
		for _, u := range updates {
			if u.UpdateID >= offset {
				offset = u.UpdateID + 1
			}
			handleTGUpdate(ctx, d, u)
		}
	}
}

func handleTGUpdate(ctx context.Context, d *TGLoginDeps, u tgbot.Update) {
	m := u.Message
	if m == nil {
		return
	}
	cctx, cancel := context.WithTimeout(ctx, 15*time.Second)
	defer cancel()

	if m.Contact != nil {
		// Only the sender's own contact proves the number belongs to them.
		if m.Contact.UserID != m.From.ID {
			_ = d.Bot.Send(cctx, m.Chat.ID, "Это чужой контакт. Нажмите кнопку «Поделиться номером» — Telegram подставит ваш собственный номер.")
			return
		}
		phone, ok := normalizePhone(m.Contact.PhoneNumber)
		if !ok {
			_ = d.Bot.Send(cctx, m.Chat.ID, "Не удалось разобрать номер. Напишите нам: +7 915 488-94-19")
			return
		}
		user, _, err := d.Customers.Customers.UpsertUserOnLogin(cctx, phone)
		if err != nil {
			log.Printf("tg login upsert: %v", err)
			_ = d.Bot.Send(cctx, m.Chat.ID, "Что-то пошло не так, попробуйте ещё раз чуть позже.")
			return
		}
		bound, err := d.Customers.Customers.AttachTGUser(cctx, m.Chat.ID, user.ID)
		if err != nil {
			log.Printf("tg login attach: %v", err)
		}
		if !bound {
			_ = d.Bot.Send(cctx, m.Chat.ID, "Ссылка для входа устарела. Откройте сайт delovpizza.ru и нажмите «Войти» ещё раз.")
			return
		}
		_ = d.Bot.Send(cctx, m.Chat.ID, "Готово! Вернитесь на сайт — вы вошли.")
		return
	}

	text := strings.TrimSpace(m.Text)
	if strings.HasPrefix(text, "/start") {
		nonce := strings.TrimSpace(strings.TrimPrefix(text, "/start"))
		if nonce == "" {
			_ = d.Bot.Send(cctx, m.Chat.ID, "Этот бот нужен для входа на delovpizza.ru. Откройте сайт и нажмите «Войти через Telegram».")
			return
		}
		ok, err := d.Customers.Customers.BindTGChat(cctx, nonce, m.Chat.ID)
		if err != nil {
			log.Printf("tg login bind: %v", err)
		}
		if !ok {
			_ = d.Bot.Send(cctx, m.Chat.ID, "Ссылка для входа устарела. Откройте сайт delovpizza.ru и нажмите «Войти» ещё раз.")
			return
		}
		if err := d.Bot.AskPhone(cctx, m.Chat.ID, "Нажмите кнопку ниже — Telegram передаст ваш номер, и вы войдёте на сайт delovpizza.ru. Номер нужен, чтобы сохранять адреса, историю заказов и бесплатные пиццы."); err != nil {
			log.Printf("tg login ask phone: %v", err)
		}
		return
	}
}
