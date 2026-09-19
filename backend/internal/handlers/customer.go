package handlers

import (
	"context"
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"errors"
	"fmt"
	"log"
	"math/big"
	"net"
	"net/http"
	"strconv"
	"strings"
	"sync"
	"time"
	"unicode/utf8"

	"pizza-backend/internal/repo"
	"pizza-backend/internal/sms"
)

const (
	otpTTL            = 5 * time.Minute
	otpMaxAttempts    = 5
	otpResendCooldown = 60 * time.Second
	otpPhonePerHour   = 5
	otpPhonePerDay    = 10
	otpIPPerHour      = 20
	pizzasPerGift     = 8
)

type CustomerDeps struct {
	Customers *repo.Customers
	Sender    sms.Sender
	Secret    []byte // HMAC key for OTP hashes
	DailyCap  int    // global codes/day, protects the SMS balance
	mu        sync.Mutex
}

// normalizePhone accepts Russian mobile numbers in any common notation and
// returns +79XXXXXXXXX.
func normalizePhone(s string) (string, bool) {
	var b strings.Builder
	for _, r := range s {
		if r >= '0' && r <= '9' {
			b.WriteRune(r)
		}
	}
	d := b.String()
	switch {
	case len(d) == 11 && (d[0] == '7' || d[0] == '8'):
		d = d[1:]
	case len(d) == 10:
	default:
		return "", false
	}
	if d[0] != '9' {
		return "", false
	}
	return "+7" + d, true
}

func phone10(p string) string { return p[len(p)-10:] }

func (d *CustomerDeps) hashCode(phone, code string) string {
	m := hmac.New(sha256.New, d.Secret)
	m.Write([]byte("otp:" + phone + ":" + code))
	return hex.EncodeToString(m.Sum(nil))
}

func hashToken(t string) string {
	s := sha256.Sum256([]byte(t))
	return hex.EncodeToString(s[:])
}

func randomCode() (string, error) {
	n, err := rand.Int(rand.Reader, big.NewInt(10000))
	if err != nil {
		return "", err
	}
	return fmt.Sprintf("%04d", n.Int64()), nil
}

func newToken() (string, error) {
	b := make([]byte, 32)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return base64.RawURLEncoding.EncodeToString(b), nil
}

// realIP trusts X-Real-IP: the edge proxy is the only way in and sets it.
func realIP(r *http.Request) string {
	if ip := strings.TrimSpace(r.Header.Get("X-Real-IP")); ip != "" {
		return ip
	}
	host, _, err := net.SplitHostPort(r.RemoteAddr)
	if err != nil {
		return r.RemoteAddr
	}
	return host
}

func bearer(r *http.Request) string {
	h := r.Header.Get("Authorization")
	if !strings.HasPrefix(h, "Bearer ") {
		return ""
	}
	return strings.TrimSpace(strings.TrimPrefix(h, "Bearer "))
}

// customerFromRequest returns the logged-in customer or nil (guest / bad token).
func (d *CustomerDeps) customerFromRequest(r *http.Request) *repo.User {
	t := bearer(r)
	if t == "" || d == nil {
		return nil
	}
	u, err := d.Customers.UserBySession(r.Context(), hashToken(t))
	if err != nil {
		if !errors.Is(err, repo.ErrNotFound) {
			log.Printf("session lookup: %v", err)
		}
		return nil
	}
	return u
}

// AuthRequestCode sends a login code by SMS (flash call if SMS is rejected).
func AuthRequestCode(d *CustomerDeps) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var req struct {
			Phone string `json:"phone"`
		}
		if err := decodeJSON(w, r, &req); err != nil {
			writeError(w, http.StatusBadRequest, "invalid request body")
			return
		}
		phone, ok := normalizePhone(req.Phone)
		if !ok {
			writeError(w, http.StatusBadRequest, "Введите мобильный номер: +7 9XX XXX-XX-XX")
			return
		}
		ip := realIP(r)

		d.mu.Lock()
		c, err := d.Customers.OTPCounts(r.Context(), phone, ip)
		if err != nil {
			d.mu.Unlock()
			log.Printf("otp counts: %v", err)
			writeError(w, http.StatusInternalServerError, "internal error")
			return
		}
		if c.PhoneLastAt != nil {
			if wait := otpResendCooldown - time.Since(*c.PhoneLastAt); wait > 0 {
				d.mu.Unlock()
				writeJSON(w, http.StatusTooManyRequests, map[string]any{
					"error": "Код уже отправлен — подождите немного", "resendAfter": int(wait.Seconds()) + 1,
				})
				return
			}
		}
		if c.PhoneHour >= otpPhonePerHour || c.PhoneDay >= otpPhonePerDay || c.IPHour >= otpIPPerHour {
			d.mu.Unlock()
			writeError(w, http.StatusTooManyRequests, "Слишком много попыток. Попробуйте позже или позвоните нам.")
			return
		}
		if d.DailyCap > 0 && c.GlobalDay >= d.DailyCap {
			d.mu.Unlock()
			log.Printf("ALERT: daily OTP cap %d reached", d.DailyCap)
			writeError(w, http.StatusServiceUnavailable, "Вход временно недоступен. Оформите заказ без входа.")
			return
		}
		id, err := d.Customers.ReserveOTP(r.Context(), phone, ip)
		d.mu.Unlock()
		if err != nil {
			log.Printf("otp reserve: %v", err)
			writeError(w, http.StatusInternalServerError, "internal error")
			return
		}

		code, err := randomCode()
		if err != nil {
			writeError(w, http.StatusInternalServerError, "internal error")
			return
		}
		ctx, cancel := context.WithTimeout(r.Context(), 20*time.Second)
		defer cancel()
		sent, channel, err := d.Sender.SendCode(ctx, phone, code)
		if err != nil {
			log.Printf("otp send to %s: %v", maskPhone(phone), err)
			writeError(w, http.StatusBadGateway, "Не удалось отправить код. Попробуйте ещё раз через минуту.")
			return
		}
		if err := d.Customers.FinishOTP(r.Context(), id, phone, d.hashCode(phone, sent), channel, otpTTL); err != nil {
			log.Printf("otp finish: %v", err)
			writeError(w, http.StatusInternalServerError, "internal error")
			return
		}
		writeJSON(w, http.StatusOK, map[string]any{
			"ok": true, "channel": channel, "phone": phone,
			"resendAfter": int(otpResendCooldown.Seconds()), "ttl": int(otpTTL.Seconds()),
		})
	}
}

func maskPhone(p string) string {
	if len(p) < 4 {
		return "***"
	}
	return "***" + p[len(p)-4:]
}

// AuthVerify checks the code and opens a long-lived session.
func AuthVerify(d *CustomerDeps) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var req struct {
			Phone string `json:"phone"`
			Code  string `json:"code"`
		}
		if err := decodeJSON(w, r, &req); err != nil {
			writeError(w, http.StatusBadRequest, "invalid request body")
			return
		}
		phone, ok := normalizePhone(req.Phone)
		code := strings.TrimSpace(req.Code)
		if !ok || len(code) != 4 {
			writeError(w, http.StatusBadRequest, "Введите 4 цифры кода")
			return
		}
		otp, err := d.Customers.LatestActiveOTP(r.Context(), phone)
		if errors.Is(err, repo.ErrNotFound) || (err == nil && time.Now().After(otp.ExpiresAt)) {
			writeError(w, http.StatusUnauthorized, "Код устарел — запросите новый")
			return
		}
		if err != nil {
			log.Printf("otp lookup: %v", err)
			writeError(w, http.StatusInternalServerError, "internal error")
			return
		}
		if !hmac.Equal([]byte(otp.CodeHash), []byte(d.hashCode(phone, code))) {
			if err := d.Customers.OTPFailedAttempt(r.Context(), otp.ID, otpMaxAttempts); err != nil {
				log.Printf("otp attempt: %v", err)
			}
			left := otpMaxAttempts - otp.Attempts - 1
			if left <= 0 {
				writeError(w, http.StatusUnauthorized, "Неверный код. Попытки закончились — запросите новый")
				return
			}
			writeJSON(w, http.StatusUnauthorized, map[string]any{"error": "Неверный код", "attemptsLeft": left})
			return
		}
		if ok, err := d.Customers.ConsumeOTP(r.Context(), otp.ID); err != nil || !ok {
			writeError(w, http.StatusUnauthorized, "Код устарел — запросите новый")
			return
		}
		u, isNew, err := d.Customers.UpsertUserOnLogin(r.Context(), phone)
		if err != nil {
			log.Printf("user upsert: %v", err)
			writeError(w, http.StatusInternalServerError, "internal error")
			return
		}
		token, err := newToken()
		if err != nil {
			writeError(w, http.StatusInternalServerError, "internal error")
			return
		}
		if err := d.Customers.CreateSession(r.Context(), u.ID, hashToken(token), r.UserAgent()); err != nil {
			log.Printf("session create: %v", err)
			writeError(w, http.StatusInternalServerError, "internal error")
			return
		}
		writeJSON(w, http.StatusOK, map[string]any{"token": token, "user": u, "isNew": isNew})
	}
}

func AuthLogout(d *CustomerDeps) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if t := bearer(r); t != "" {
			if err := d.Customers.RevokeSession(r.Context(), hashToken(t)); err != nil {
				log.Printf("session revoke: %v", err)
			}
		}
		writeJSON(w, http.StatusOK, map[string]bool{"ok": true})
	}
}

type level struct {
	ID, Name string
	Min      float64
}

var levels = []level{
	{"novice", "Новичок", 0},
	{"fan", "Любитель", 3000},
	{"eater", "Пиццаед", 10000},
	{"mega", "Мощнейший пиццаед", 25000},
}

func loyaltyView(s repo.LoyaltyStats) map[string]any {
	cur := levels[0]
	var next *level
	for i, l := range levels {
		if s.TotalSpent >= l.Min {
			cur = l
			next = nil
			if i+1 < len(levels) {
				next = &levels[i+1]
			}
		}
	}
	v := map[string]any{
		"ordersCount": s.OrdersCount,
		"totalSpent":  s.TotalSpent,
		"pizzaCount":  s.PizzaCount,
		"inCycle":     s.PizzaCount % pizzasPerGift,
		"perGift":     pizzasPerGift,
		"level":       map[string]any{"id": cur.ID, "name": cur.Name, "min": cur.Min},
	}
	if next != nil {
		v["nextLevel"] = map[string]any{"id": next.ID, "name": next.Name, "min": next.Min}
	}
	return v
}

func requireCustomer(d *CustomerDeps, w http.ResponseWriter, r *http.Request) *repo.User {
	u := d.customerFromRequest(r)
	if u == nil {
		writeError(w, http.StatusUnauthorized, "Войдите заново")
	}
	return u
}

// Me returns everything the profile screen needs.
func Me(d *CustomerDeps) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		u := requireCustomer(d, w, r)
		if u == nil {
			return
		}
		addrs, err := d.Customers.Addresses(r.Context(), u.ID)
		if err != nil {
			log.Printf("me addresses: %v", err)
			writeError(w, http.StatusInternalServerError, "internal error")
			return
		}
		orders, err := d.Customers.CustomerOrders(r.Context(), u.ID, phone10(u.Phone), 30)
		if err != nil {
			log.Printf("me orders: %v", err)
			writeError(w, http.StatusInternalServerError, "internal error")
			return
		}
		stats, err := d.Customers.Loyalty(r.Context(), u.ID, phone10(u.Phone))
		if err != nil {
			log.Printf("me loyalty: %v", err)
			writeError(w, http.StatusInternalServerError, "internal error")
			return
		}
		type orderView struct {
			ID            int64            `json:"id"`
			Number        int              `json:"number"`
			CreatedAt     time.Time        `json:"createdAt"`
			Status        string           `json:"status"`
			ReceiveMethod string           `json:"receiveMethod"`
			Address       string           `json:"address"`
			Items         []repo.OrderItem `json:"items"`
			Total         float64          `json:"total"`
		}
		ov := make([]orderView, 0, len(orders))
		for _, o := range orders {
			if o.PayMethod == "online" && !o.Paid {
				continue // abandoned payment
			}
			ov = append(ov, orderView{o.ID, o.Number, o.CreatedAt, o.Status, o.ReceiveMethod, o.Address, o.Items, o.Total})
		}
		writeJSON(w, http.StatusOK, map[string]any{
			"user": u, "addresses": addrs, "orders": ov, "loyalty": loyaltyView(stats),
		})
	}
}

func cleanText(s string, max int) string {
	s = strings.TrimSpace(s)
	if utf8.RuneCountInString(s) > max {
		s = string([]rune(s)[:max])
	}
	return s
}

func MeUpdate(d *CustomerDeps) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		u := requireCustomer(d, w, r)
		if u == nil {
			return
		}
		var req struct {
			Name string `json:"name"`
		}
		if err := decodeJSON(w, r, &req); err != nil {
			writeError(w, http.StatusBadRequest, "invalid request body")
			return
		}
		if err := d.Customers.UpdateName(r.Context(), u.ID, cleanText(req.Name, 60)); err != nil {
			log.Printf("me update: %v", err)
			writeError(w, http.StatusInternalServerError, "internal error")
			return
		}
		writeJSON(w, http.StatusOK, map[string]bool{"ok": true})
	}
}

type addressReq struct {
	Label      string `json:"label"`
	Text       string `json:"text"`
	IsFavorite bool   `json:"isFavorite"`
}

func MeAddressAdd(d *CustomerDeps) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		u := requireCustomer(d, w, r)
		if u == nil {
			return
		}
		var req addressReq
		if err := decodeJSON(w, r, &req); err != nil {
			writeError(w, http.StatusBadRequest, "invalid request body")
			return
		}
		text := cleanText(req.Text, 300)
		if utf8.RuneCountInString(text) < 5 {
			writeError(w, http.StatusBadRequest, "Укажите адрес")
			return
		}
		a, err := d.Customers.AddAddress(r.Context(), u.ID, cleanText(req.Label, 40), text)
		if errors.Is(err, repo.ErrTooMany) {
			writeError(w, http.StatusBadRequest, "Слишком много адресов — удалите ненужные")
			return
		}
		if err != nil {
			log.Printf("address add: %v", err)
			writeError(w, http.StatusInternalServerError, "internal error")
			return
		}
		writeJSON(w, http.StatusCreated, a)
	}
}

func addrID(r *http.Request) (int64, bool) {
	id, err := strconv.ParseInt(r.PathValue("id"), 10, 64)
	return id, err == nil && id > 0
}

func MeAddressUpdate(d *CustomerDeps) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		u := requireCustomer(d, w, r)
		if u == nil {
			return
		}
		id, ok := addrID(r)
		if !ok {
			writeError(w, http.StatusBadRequest, "bad id")
			return
		}
		var req addressReq
		if err := decodeJSON(w, r, &req); err != nil {
			writeError(w, http.StatusBadRequest, "invalid request body")
			return
		}
		text := cleanText(req.Text, 300)
		if utf8.RuneCountInString(text) < 5 {
			writeError(w, http.StatusBadRequest, "Укажите адрес")
			return
		}
		err := d.Customers.UpdateAddress(r.Context(), u.ID, id, cleanText(req.Label, 40), text, req.IsFavorite)
		if errors.Is(err, repo.ErrNotFound) {
			writeError(w, http.StatusNotFound, "not found")
			return
		}
		if err != nil {
			log.Printf("address update: %v", err)
			writeError(w, http.StatusInternalServerError, "internal error")
			return
		}
		writeJSON(w, http.StatusOK, map[string]bool{"ok": true})
	}
}

func MeAddressDelete(d *CustomerDeps) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		u := requireCustomer(d, w, r)
		if u == nil {
			return
		}
		id, ok := addrID(r)
		if !ok {
			writeError(w, http.StatusBadRequest, "bad id")
			return
		}
		err := d.Customers.DeleteAddress(r.Context(), u.ID, id)
		if errors.Is(err, repo.ErrNotFound) {
			writeError(w, http.StatusNotFound, "not found")
			return
		}
		if err != nil {
			log.Printf("address delete: %v", err)
			writeError(w, http.StatusInternalServerError, "internal error")
			return
		}
		writeJSON(w, http.StatusOK, map[string]bool{"ok": true})
	}
}
