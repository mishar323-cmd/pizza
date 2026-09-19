package repo

import (
	"context"
	"encoding/json"
	"errors"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

var ErrNotFound = errors.New("not found")

type User struct {
	ID          int64      `json:"id"`
	Phone       string     `json:"phone"`
	Name        string     `json:"name"`
	CreatedAt   time.Time  `json:"createdAt"`
	LastLoginAt *time.Time `json:"lastLoginAt,omitempty"`
}

type Address struct {
	ID         int64  `json:"id"`
	Label      string `json:"label"`
	Text       string `json:"text"`
	IsFavorite bool   `json:"isFavorite"`
}

type OTP struct {
	ID        int64
	CodeHash  string
	Attempts  int
	ExpiresAt time.Time
}

type Customers struct{ pool *pgxpool.Pool }

func NewCustomers(pool *pgxpool.Pool) *Customers { return &Customers{pool: pool} }

// ---- OTP ----

// OTPCounts reports codes requested since the given times, for rate limiting.
type OTPCounts struct {
	PhoneLastAt                            *time.Time
	PhoneHour, PhoneDay, IPHour, GlobalDay int
}

func (r *Customers) OTPCounts(ctx context.Context, phone, ip string) (OTPCounts, error) {
	var c OTPCounts
	err := r.pool.QueryRow(ctx, `
		SELECT
			(SELECT max(created_at) FROM otp_codes WHERE phone = $1),
			(SELECT count(*) FROM otp_codes WHERE phone = $1 AND created_at > now() - interval '1 hour'),
			(SELECT count(*) FROM otp_codes WHERE phone = $1 AND created_at > now() - interval '1 day'),
			(SELECT count(*) FROM otp_codes WHERE request_ip = $2 AND created_at > now() - interval '1 hour'),
			(SELECT count(*) FROM otp_codes WHERE created_at > now() - interval '1 day')`,
		phone, ip).Scan(&c.PhoneLastAt, &c.PhoneHour, &c.PhoneDay, &c.IPHour, &c.GlobalDay)
	return c, err
}

// ReserveOTP records a request before the provider is called, so concurrent
// requests already count against the rate limits. The row can't be used for
// login until FinishOTP stores the code.
func (r *Customers) ReserveOTP(ctx context.Context, phone, ip string) (int64, error) {
	var id int64
	err := r.pool.QueryRow(ctx, `
		INSERT INTO otp_codes(phone, code_hash, request_ip, expires_at, consumed_at)
		VALUES ($1, '', $2, now(), now()) RETURNING id`, phone, ip).Scan(&id)
	return id, err
}

// FinishOTP activates the reserved row and invalidates older unused codes.
func (r *Customers) FinishOTP(ctx context.Context, id int64, phone, codeHash, channel string, ttl time.Duration) error {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)
	if _, err := tx.Exec(ctx, `UPDATE otp_codes SET consumed_at = now() WHERE phone = $1 AND consumed_at IS NULL`, phone); err != nil {
		return err
	}
	if _, err := tx.Exec(ctx, `
		UPDATE otp_codes SET code_hash = $2, channel = $3, consumed_at = NULL,
			expires_at = now() + make_interval(secs => $4)
		WHERE id = $1`, id, codeHash, channel, ttl.Seconds()); err != nil {
		return err
	}
	return tx.Commit(ctx)
}

func (r *Customers) LatestActiveOTP(ctx context.Context, phone string) (*OTP, error) {
	var o OTP
	err := r.pool.QueryRow(ctx, `
		SELECT id, code_hash, attempts, expires_at FROM otp_codes
		WHERE phone = $1 AND consumed_at IS NULL
		ORDER BY created_at DESC LIMIT 1`, phone).Scan(&o.ID, &o.CodeHash, &o.Attempts, &o.ExpiresAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrNotFound
	}
	return &o, err
}

func (r *Customers) OTPFailedAttempt(ctx context.Context, id int64, maxAttempts int) error {
	_, err := r.pool.Exec(ctx, `
		UPDATE otp_codes SET attempts = attempts + 1,
			consumed_at = CASE WHEN attempts + 1 >= $2 THEN now() ELSE consumed_at END
		WHERE id = $1`, id, maxAttempts)
	return err
}

// ConsumeOTP marks the code used; false if someone else consumed it first.
func (r *Customers) ConsumeOTP(ctx context.Context, id int64) (bool, error) {
	tag, err := r.pool.Exec(ctx, `UPDATE otp_codes SET consumed_at = now() WHERE id = $1 AND consumed_at IS NULL`, id)
	if err != nil {
		return false, err
	}
	return tag.RowsAffected() == 1, nil
}

// ---- users & sessions ----

func (r *Customers) UpsertUserOnLogin(ctx context.Context, phone string) (*User, bool, error) {
	var u User
	var isNew bool
	err := r.pool.QueryRow(ctx, `
		INSERT INTO users(phone, last_login_at) VALUES ($1, now())
		ON CONFLICT (phone) DO UPDATE SET last_login_at = now()
		RETURNING id, phone, name, created_at, last_login_at, (xmax = 0)`, phone).
		Scan(&u.ID, &u.Phone, &u.Name, &u.CreatedAt, &u.LastLoginAt, &isNew)
	return &u, isNew, err
}

func (r *Customers) CreateSession(ctx context.Context, userID int64, tokenHash, userAgent string) error {
	if len(userAgent) > 300 {
		userAgent = userAgent[:300]
	}
	_, err := r.pool.Exec(ctx, `INSERT INTO sessions(user_id, token_hash, user_agent) VALUES ($1, $2, $3)`,
		userID, tokenHash, userAgent)
	return err
}

func (r *Customers) UserBySession(ctx context.Context, tokenHash string) (*User, error) {
	var u User
	err := r.pool.QueryRow(ctx, `
		UPDATE sessions s SET last_seen_at = now()
		FROM users u
		WHERE s.token_hash = $1 AND s.revoked_at IS NULL AND u.id = s.user_id
		RETURNING u.id, u.phone, u.name, u.created_at, u.last_login_at`, tokenHash).
		Scan(&u.ID, &u.Phone, &u.Name, &u.CreatedAt, &u.LastLoginAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrNotFound
	}
	return &u, err
}

func (r *Customers) RevokeSession(ctx context.Context, tokenHash string) error {
	_, err := r.pool.Exec(ctx, `UPDATE sessions SET revoked_at = now() WHERE token_hash = $1 AND revoked_at IS NULL`, tokenHash)
	return err
}

func (r *Customers) UpdateName(ctx context.Context, userID int64, name string) error {
	_, err := r.pool.Exec(ctx, `UPDATE users SET name = $2, updated_at = now() WHERE id = $1`, userID, name)
	return err
}

// ---- addresses ----

const maxAddresses = 20

func (r *Customers) Addresses(ctx context.Context, userID int64) ([]Address, error) {
	rows, err := r.pool.Query(ctx, `
		SELECT id, label, text, is_favorite FROM user_addresses
		WHERE user_id = $1 ORDER BY is_favorite DESC, created_at`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []Address{}
	for rows.Next() {
		var a Address
		if err := rows.Scan(&a.ID, &a.Label, &a.Text, &a.IsFavorite); err != nil {
			return nil, err
		}
		out = append(out, a)
	}
	return out, rows.Err()
}

var ErrTooMany = errors.New("too many")

// AddAddress adds an address; the first one becomes favorite.
func (r *Customers) AddAddress(ctx context.Context, userID int64, label, text string) (*Address, error) {
	a := Address{Label: label, Text: text}
	err := r.pool.QueryRow(ctx, `
		WITH c AS (SELECT count(*) AS n FROM user_addresses WHERE user_id = $1)
		INSERT INTO user_addresses(user_id, label, text, is_favorite)
		SELECT $1, $2, $3, c.n = 0 FROM c WHERE c.n < $4
		RETURNING id, is_favorite`, userID, label, text, maxAddresses).Scan(&a.ID, &a.IsFavorite)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrTooMany
	}
	return &a, err
}

func (r *Customers) UpdateAddress(ctx context.Context, userID, id int64, label, text string, favorite bool) error {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)
	tag, err := tx.Exec(ctx, `UPDATE user_addresses SET label = $3, text = $4, is_favorite = $5 WHERE id = $2 AND user_id = $1`,
		userID, id, label, text, favorite)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return ErrNotFound
	}
	if favorite {
		if _, err := tx.Exec(ctx, `UPDATE user_addresses SET is_favorite = false WHERE user_id = $1 AND id <> $2`, userID, id); err != nil {
			return err
		}
	}
	return tx.Commit(ctx)
}

func (r *Customers) DeleteAddress(ctx context.Context, userID, id int64) error {
	tag, err := r.pool.Exec(ctx, `DELETE FROM user_addresses WHERE id = $2 AND user_id = $1`, userID, id)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return ErrNotFound
	}
	// Keep one favorite if any remain.
	_, err = r.pool.Exec(ctx, `
		UPDATE user_addresses SET is_favorite = true
		WHERE id = (SELECT id FROM user_addresses WHERE user_id = $1 ORDER BY created_at LIMIT 1)
		AND NOT EXISTS (SELECT 1 FROM user_addresses WHERE user_id = $1 AND is_favorite)`, userID)
	return err
}

// ---- order history ----

// CustomerOrders returns the user's orders: linked by account, or placed as a
// guest with the same phone (login proves phone ownership).
func (r *Customers) CustomerOrders(ctx context.Context, userID int64, phone10 string, limit int) ([]Order, error) {
	rows, err := r.pool.Query(ctx, `
		SELECT id, number, COALESCE(address, ''), receive_method, pay_method, items, total, delivery,
			status, COALESCE(promo_code, ''), promo_discount, paid, created_at
		FROM orders
		WHERE user_id = $1 OR right(regexp_replace(customer_phone, '\D', '', 'g'), 10) = $2
		ORDER BY created_at DESC LIMIT $3`, userID, phone10, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []Order{}
	for rows.Next() {
		var o Order
		var itemsRaw []byte
		if err := rows.Scan(&o.ID, &o.Number, &o.Address, &o.ReceiveMethod, &o.PayMethod, &itemsRaw,
			&o.Total, &o.Delivery, &o.Status, &o.PromoCode, &o.PromoDiscount, &o.Paid, &o.CreatedAt); err != nil {
			return nil, err
		}
		_ = json.Unmarshal(itemsRaw, &o.Items)
		out = append(out, o)
	}
	return out, rows.Err()
}

// LoyaltyStats aggregates every non-cancelled order of the customer.
// Pizzas: items tagged cat=pizza; older orders have no cat, so a sized item
// that isn't a drink/snack counts (only pizzas are sold in sizes).
type LoyaltyStats struct {
	OrdersCount int     `json:"ordersCount"`
	TotalSpent  float64 `json:"totalSpent"`
	PizzaCount  int     `json:"pizzaCount"`
}

func (r *Customers) Loyalty(ctx context.Context, userID int64, phone10 string) (LoyaltyStats, error) {
	var s LoyaltyStats
	err := r.pool.QueryRow(ctx, `
		WITH mine AS (
			SELECT total, items FROM orders
			WHERE (user_id = $1 OR right(regexp_replace(customer_phone, '\D', '', 'g'), 10) = $2)
				AND status <> 'cancelled'
				AND (pay_method <> 'online' OR paid)
		)
		SELECT
			(SELECT count(*) FROM mine),
			(SELECT COALESCE(sum(total), 0) FROM mine),
			(SELECT COALESCE(sum(COALESCE((it->>'qty')::int, 0)), 0)
			   FROM mine, jsonb_array_elements(mine.items) it
			  WHERE it->>'cat' = 'pizza'
			     OR (COALESCE(it->>'cat', '') = '' AND COALESCE(it->>'size', '') <> ''))`,
		userID, phone10).Scan(&s.OrdersCount, &s.TotalSpent, &s.PizzaCount)
	return s, err
}
