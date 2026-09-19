package handlers

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"strconv"
	"sync"
	"testing"
	"time"

	"pizza-backend/internal/db"
	"pizza-backend/internal/repo"
	"pizza-backend/internal/sms"
)

func TestNormalizePhone(t *testing.T) {
	ok := map[string]string{
		"+7 916 123-45-67":  "+79161234567",
		"89161234567":       "+79161234567",
		"8 (916) 123 45 67": "+79161234567",
		"9161234567":        "+79161234567",
		"7-916-123-45-67":   "+79161234567",
	}
	for in, want := range ok {
		if got, valid := normalizePhone(in); !valid || got != want {
			t.Errorf("%q → %q %v, want %q", in, got, valid, want)
		}
	}
	for _, bad := range []string{"", "12345", "+7 495 123-45-67", "+1 916 123 4567 8", "916123456"} {
		if got, valid := normalizePhone(bad); valid {
			t.Errorf("%q accepted as %q", bad, got)
		}
	}
}

func pizzas(prices ...float64) []repo.OrderItem {
	var it []repo.OrderItem
	for _, p := range prices {
		it = append(it, repo.OrderItem{Name: "p", Qty: 1, Price: p, Cat: "pizza"})
	}
	return it
}

func TestPizzaGift(t *testing.T) {
	cases := []struct {
		before  int
		items   []repo.OrderItem
		qty     int
		discont float64
	}{
		{0, pizzas(500, 600), 0, 0},
		{6, pizzas(700, 500), 1, 500}, // 7th and 8th → one free, cheapest
		{7, pizzas(800), 1, 800},      // exactly the 8th
		{8, pizzas(800), 0, 0},        // 9th
		{5, pizzas(900, 400, 700, 600, 500, 800, 300, 200, 1000, 1100, 1200), 2, 500}, // crosses 8 and 16
		{7, []repo.OrderItem{{Name: "cola", Qty: 3, Price: 100, Cat: "drinks"}}, 0, 0},
		{7, []repo.OrderItem{{Name: "p", Qty: 2, Price: 550, Cat: "pizza"}}, 1, 550},
	}
	for i, c := range cases {
		q, d := pizzaGift(c.before, c.items)
		if q != c.qty || d != c.discont {
			t.Errorf("case %d: got %d/%.0f want %d/%.0f", i, q, d, c.qty, c.discont)
		}
	}
}

// ---- integration (needs TEST_DATABASE_URL) ----

type captureSender struct {
	mu    sync.Mutex
	codes map[string]string
}

func (c *captureSender) SendCode(_ context.Context, phone, code string) (string, string, error) {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.codes[phone] = code
	return code, sms.ChannelSMS, nil
}

type testAPI struct {
	t   *testing.T
	mux *http.ServeMux
}

func (a testAPI) do(method, path, token string, body any) (int, map[string]any) {
	a.t.Helper()
	var buf bytes.Buffer
	if body != nil {
		_ = json.NewEncoder(&buf).Encode(body)
	}
	req := httptest.NewRequest(method, path, &buf)
	req.Header.Set("X-Real-IP", "10.0.0.1")
	if token != "" {
		req.Header.Set("Authorization", "Bearer "+token)
	}
	rec := httptest.NewRecorder()
	a.mux.ServeHTTP(rec, req)
	var out map[string]any
	_ = json.Unmarshal(rec.Body.Bytes(), &out)
	return rec.Code, out
}

func TestCustomerFlowIntegration(t *testing.T) {
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
	for _, q := range []string{
		`DROP SCHEMA public CASCADE`, `CREATE SCHEMA public`,
	} {
		if _, err := pool.Exec(ctx, q); err != nil {
			t.Fatal(err)
		}
	}
	if err := db.Migrate(ctx, pool); err != nil {
		t.Fatal(err)
	}

	sender := &captureSender{codes: map[string]string{}}
	cd := &CustomerDeps{Customers: repo.NewCustomers(pool), Sender: sender, Secret: []byte("test"), DailyCap: 100, Enabled: true}
	od := &OrdersDeps{Orders: repo.NewOrders(pool), Customers: cd}
	mux := http.NewServeMux()
	mux.HandleFunc("POST /api/auth/request-code", AuthRequestCode(cd))
	mux.HandleFunc("POST /api/auth/verify", AuthVerify(cd))
	mux.HandleFunc("POST /api/auth/logout", AuthLogout(cd))
	mux.HandleFunc("GET /api/me", Me(cd))
	mux.HandleFunc("PUT /api/me", MeUpdate(cd))
	mux.HandleFunc("POST /api/me/addresses", MeAddressAdd(cd))
	mux.HandleFunc("PUT /api/me/addresses/{id}", MeAddressUpdate(cd))
	mux.HandleFunc("DELETE /api/me/addresses/{id}", MeAddressDelete(cd))
	mux.HandleFunc("POST /api/orders", CreateOrder(od))
	api := testAPI{t, mux}

	// Guest order placed earlier with the same phone in another notation.
	if s, _ := api.do("POST", "/api/orders", "", map[string]any{
		"name": "Гость", "phone": "8 (916) 123-45-67", "receiveMethod": "pickup", "payMethod": "cash",
		"items": pizzas(500, 500, 500, 500, 500, 500), "total": 3000,
	}); s != 201 {
		t.Fatalf("guest order: %d", s)
	}

	if s, _ := api.do("POST", "/api/auth/request-code", "", map[string]any{"phone": "+7 495 000-00-00"}); s != 400 {
		t.Fatalf("landline accepted: %d", s)
	}
	s, body := api.do("POST", "/api/auth/request-code", "", map[string]any{"phone": "+7 916 123-45-67"})
	if s != 200 || body["channel"] != "sms" {
		t.Fatalf("request-code: %d %v", s, body)
	}
	if s, body := api.do("POST", "/api/auth/request-code", "", map[string]any{"phone": "89161234567"}); s != 429 || body["resendAfter"] == nil {
		t.Fatalf("cooldown not enforced: %d %v", s, body)
	}
	code := sender.codes["+79161234567"]
	wrong := "0000"
	if code == wrong {
		wrong = "1111"
	}
	if s, body := api.do("POST", "/api/auth/verify", "", map[string]any{"phone": "89161234567", "code": wrong}); s != 401 || body["attemptsLeft"] != float64(4) {
		t.Fatalf("wrong code: %d %v", s, body)
	}
	s, body = api.do("POST", "/api/auth/verify", "", map[string]any{"phone": "89161234567", "code": code})
	if s != 200 || body["isNew"] != true {
		t.Fatalf("verify: %d %v", s, body)
	}
	token := body["token"].(string)
	if s, _ := api.do("POST", "/api/auth/verify", "", map[string]any{"phone": "89161234567", "code": code}); s != 401 {
		t.Fatalf("code reused: %d", s)
	}

	if s, _ := api.do("PUT", "/api/me", token, map[string]any{"name": "  Миша  "}); s != 200 {
		t.Fatalf("name: %d", s)
	}
	s, a1 := api.do("POST", "/api/me/addresses", token, map[string]any{"label": "Дом", "text": "Глухово, Романовская 5, кв 1"})
	if s != 201 || a1["isFavorite"] != true {
		t.Fatalf("addr1: %d %v", s, a1)
	}
	_, a2 := api.do("POST", "/api/me/addresses", token, map[string]any{"label": "Работа", "text": "Жуковка, 12"})
	id2 := int(a2["id"].(float64))
	if s, _ := api.do("PUT", "/api/me/addresses/"+strconv.Itoa(id2), token, map[string]any{"label": "Работа", "text": "Жуковка, 12", "isFavorite": true}); s != 200 {
		t.Fatalf("fav: %d", s)
	}

	// 6 pizzas as guest + 2 now → the 8th is free (cheapest of this order).
	s, created := api.do("POST", "/api/orders", token, map[string]any{
		"name": "Миша", "phone": "+79161234567", "receiveMethod": "pickup", "payMethod": "cash",
		"items": append(pizzas(700, 450), repo.OrderItem{Name: "Кола", Qty: 1, Price: 150, Cat: "drinks"}),
		"total": 850, "loyaltyDiscount": 450, "pdConsent": "2026-09-19",
	})
	if s != 201 {
		t.Fatalf("order: %d %v", s, created)
	}
	o, err := repo.NewOrders(pool).GetByID(ctx, int64(created["id"].(float64)))
	if err != nil || o.UserID == nil || o.LoyaltyFreeQty != 1 || o.LoyaltyDiscount != 450 {
		t.Fatalf("order stored wrong: %+v %v", o, err)
	}

	s, me := api.do("GET", "/api/me", token, nil)
	if s != 200 {
		t.Fatalf("me: %d", s)
	}
	user := me["user"].(map[string]any)
	addrs := me["addresses"].([]any)
	orders := me["orders"].([]any)
	loy := me["loyalty"].(map[string]any)
	if user["name"] != "Миша" || len(addrs) != 2 || addrs[0].(map[string]any)["text"] != "Жуковка, 12" {
		t.Fatalf("me user/addresses: %v %v", user, addrs)
	}
	if len(orders) != 2 || loy["pizzaCount"] != float64(8) || loy["inCycle"] != float64(0) || loy["totalSpent"] != float64(3850) {
		t.Fatalf("me orders/loyalty: %d %v", len(orders), loy)
	}
	if lvl := loy["level"].(map[string]any); lvl["id"] != "fan" {
		t.Fatalf("level: %v", lvl)
	}

	// Other user can't touch these addresses.
	sender.codes = map[string]string{}
	api.do("POST", "/api/auth/request-code", "", map[string]any{"phone": "+79260000000"})
	_, b2 := api.do("POST", "/api/auth/verify", "", map[string]any{"phone": "+79260000000", "code": sender.codes["+79260000000"]})
	other := b2["token"].(string)
	if s, _ := api.do("DELETE", "/api/me/addresses/"+strconv.Itoa(id2), other, nil); s != 404 {
		t.Fatalf("foreign address delete: %d", s)
	}
	if _, me2 := api.do("GET", "/api/me", other, nil); len(me2["orders"].([]any)) != 0 {
		t.Fatalf("other user sees orders: %v", me2["orders"])
	}

	var consentVer string
	var consentAt *time.Time
	if err := pool.QueryRow(ctx, `SELECT pd_consent_version, pd_consent_at FROM orders WHERE id = $1`, int64(created["id"].(float64))).Scan(&consentVer, &consentAt); err != nil || consentVer != "2026-09-19" || consentAt == nil {
		t.Fatalf("consent not stored: %q %v %v", consentVer, consentAt, err)
	}

	// Retention: old codes deleted, 3-year-old orders anonymized.
	if _, err := pool.Exec(ctx, `UPDATE otp_codes SET created_at = now() - interval '31 days'`); err != nil {
		t.Fatal(err)
	}
	if _, err := pool.Exec(ctx, `UPDATE orders SET created_at = now() - interval '3 years 1 day' WHERE customer_name = 'Гость'`); err != nil {
		t.Fatal(err)
	}
	n, err := repo.PurgeExpired(ctx, pool)
	if err != nil || n["otp_codes"] == 0 || n["orders_anonymized"] != 1 {
		t.Fatalf("purge: %v %v", n, err)
	}

	if s, _ := api.do("POST", "/api/auth/logout", token, nil); s != 200 {
		t.Fatalf("logout: %d", s)
	}
	if s, _ := api.do("GET", "/api/me", token, nil); s != 401 {
		t.Fatalf("revoked token still works: %d", s)
	}
}
