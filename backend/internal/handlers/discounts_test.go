package handlers

import (
	"context"
	"net/http"
	"os"
	"testing"

	"pizza-backend/internal/db"
	"pizza-backend/internal/repo"
)

func TestLevelForAndRankDiscount(t *testing.T) {
	cases := []struct {
		spent    float64
		id       string
		percent  int
		food     float64
		gift     float64
		discount float64
	}{
		{0, "novice", 0, 1000, 0, 0},
		{2999, "novice", 0, 1000, 0, 0},
		{3000, "fan", 5, 1000, 0, 50},
		{19999, "fan", 5, 1300, 450, 43},
		{20000, "eater", 10, 1300, 450, 85},
		{50000, "mega", 20, 2000, 0, 400},
		{90000, "mega", 20, 500, 900, 0}, // подарок дороже еды — скидки нет
	}
	for _, c := range cases {
		l := levelFor(c.spent)
		if l.ID != c.id || l.Discount != c.percent {
			t.Fatalf("spent %.0f: got %s/%d%%, want %s/%d%%", c.spent, l.ID, l.Discount, c.id, c.percent)
		}
		if got := rankDiscount(l, c.food, c.gift); got != c.discount {
			t.Fatalf("spent %.0f: discount %.0f, want %.0f", c.spent, got, c.discount)
		}
	}
}

// TestPromoRules: промокод «только на первый заказ» не проходит второй раз, и
// пока он применён, скидка за ранг не начисляется.
func TestPromoRules(t *testing.T) {
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

	promos := repo.NewPromos(pool)
	first := &repo.PromoCode{Code: "ПЕРВЫЙ", DiscountType: "percent", DiscountValue: 20,
		Active: true, FirstOrderOnly: true, Source: "test"}
	if err := promos.Create(ctx, first); err != nil {
		t.Fatal(err)
	}

	sender := &captureSender{codes: map[string]string{}}
	cd := &CustomerDeps{Customers: repo.NewCustomers(pool), Sender: sender, Secret: []byte("test"), DailyCap: 100, Enabled: true, PhoneCodes: true}
	od := &OrdersDeps{Orders: repo.NewOrders(pool), Promos: promos, Customers: cd}
	pd := &PromosDeps{Promos: promos}
	mux := http.NewServeMux()
	mux.HandleFunc("POST /api/auth/request-code", AuthRequestCode(cd))
	mux.HandleFunc("POST /api/auth/verify", AuthVerify(cd))
	mux.HandleFunc("POST /api/promo/validate", ValidatePromo(pd))
	mux.HandleFunc("POST /api/orders", CreateOrder(od))
	api := testAPI{t, mux}

	const phone = "+79161112233"
	api.do("POST", "/api/auth/request-code", "", map[string]any{"phone": phone})
	_, body := api.do("POST", "/api/auth/verify", "", map[string]any{"phone": phone, "code": sender.codes[phone]})
	token := body["token"].(string)

	// 1. Первый заказ: промокод проходит, ранга ещё нет.
	if s, b := api.do("POST", "/api/promo/validate", "", map[string]any{"code": "ПЕРВЫЙ", "subtotal": 1000, "phone": phone}); s != 200 || b["discount"] != float64(200) {
		t.Fatalf("validate on first order: %d %v", s, b)
	}
	s, created := api.do("POST", "/api/orders", token, map[string]any{
		"name": "Миша", "phone": phone, "receiveMethod": "pickup", "payMethod": "cash",
		"items": pizzas(2000, 2000), "total": 3200, "promoCode": "ПЕРВЫЙ",
	})
	if s != 201 {
		t.Fatalf("first order: %d %v", s, created)
	}
	orders := repo.NewOrders(pool)
	o, err := orders.GetByID(ctx, int64(created["id"].(float64)))
	if err != nil || o.PromoDiscount != 800 || o.RankDiscount != 0 {
		t.Fatalf("first order discounts: %+v %v", o, err)
	}

	// 2. Второй заказ тем же кодом — отказ, но заказ создаётся без скидки.
	if s, b := api.do("POST", "/api/promo/validate", "", map[string]any{"code": "ПЕРВЫЙ", "subtotal": 1000, "phone": phone}); s != 422 {
		t.Fatalf("second validate: %d %v", s, b)
	}
	s, created2 := api.do("POST", "/api/orders", token, map[string]any{
		"name": "Миша", "phone": phone, "receiveMethod": "pickup", "payMethod": "cash",
		"items": pizzas(1000), "total": 950, "promoCode": "ПЕРВЫЙ",
	})
	if s != 201 {
		t.Fatalf("second order: %d %v", s, created2)
	}
	o2, err := orders.GetByID(ctx, int64(created2["id"].(float64)))
	if err != nil || o2.PromoCode != "" || o2.PromoDiscount != 0 {
		t.Fatalf("expired promo applied again: %+v %v", o2, err)
	}
	// 3200 ₽ за первый заказ → «Любитель», −5 % от 1000 ₽.
	if o2.RankLevel != "fan" || o2.RankDiscount != 50 {
		t.Fatalf("rank on second order: %q %.0f", o2.RankLevel, o2.RankDiscount)
	}
}
