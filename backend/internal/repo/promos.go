package repo

import (
	"context"
	"errors"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type PromoCode struct {
	ID             int64      `json:"id"`
	Code           string     `json:"code"`
	Description    string     `json:"description"`
	DiscountType   string     `json:"discountType"`
	DiscountValue  float64    `json:"discountValue"`
	MinOrder       float64    `json:"minOrder"`
	MaxUses        *int       `json:"maxUses"`
	UsedCount      int        `json:"usedCount"`
	PerPhoneLimit  int        `json:"perPhoneLimit"`
	StartsAt       *time.Time `json:"startsAt"`
	ExpiresAt      *time.Time `json:"expiresAt"`
	Active         bool       `json:"active"`
	Source         string     `json:"source"`
	CreatedAt      time.Time  `json:"createdAt"`
	UpdatedAt      time.Time  `json:"updatedAt"`
}

type Promos struct{ pool *pgxpool.Pool }

func NewPromos(pool *pgxpool.Pool) *Promos { return &Promos{pool: pool} }

var ErrPromoNotFound = errors.New("promo not found")

func (r *Promos) FindByCode(ctx context.Context, code string) (*PromoCode, error) {
	code = strings.ToUpper(strings.TrimSpace(code))
	row := r.pool.QueryRow(ctx, `
		SELECT id, code, description, discount_type, discount_value, min_order,
			max_uses, used_count, per_phone_limit, starts_at, expires_at, active, source, created_at, updated_at
		FROM promo_codes WHERE UPPER(code)=$1`, code)
	var p PromoCode
	err := row.Scan(&p.ID, &p.Code, &p.Description, &p.DiscountType, &p.DiscountValue, &p.MinOrder,
		&p.MaxUses, &p.UsedCount, &p.PerPhoneLimit, &p.StartsAt, &p.ExpiresAt, &p.Active, &p.Source, &p.CreatedAt, &p.UpdatedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrPromoNotFound
	}
	if err != nil {
		return nil, err
	}
	return &p, nil
}

func (r *Promos) CountRedemptionsByPhone(ctx context.Context, promoID int64, phone string) (int, error) {
	var n int
	err := r.pool.QueryRow(ctx,
		`SELECT COUNT(*) FROM promo_redemptions WHERE promo_id=$1 AND customer_phone=$2`,
		promoID, normalizePhone(phone),
	).Scan(&n)
	return n, err
}

func (r *Promos) Redeem(ctx context.Context, promoID int64, orderID int64, phone string, discount float64) error {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	if _, err := tx.Exec(ctx,
		`UPDATE promo_codes SET used_count = used_count + 1, updated_at = now() WHERE id=$1`,
		promoID,
	); err != nil {
		return err
	}
	if _, err := tx.Exec(ctx, `
		INSERT INTO promo_redemptions (promo_id, order_id, customer_phone, discount_applied)
		VALUES ($1, $2, $3, $4)`,
		promoID, orderID, normalizePhone(phone), discount,
	); err != nil {
		return err
	}
	return tx.Commit(ctx)
}

func (r *Promos) List(ctx context.Context) ([]PromoCode, error) {
	rows, err := r.pool.Query(ctx, `
		SELECT id, code, description, discount_type, discount_value, min_order,
			max_uses, used_count, per_phone_limit, starts_at, expires_at, active, source, created_at, updated_at
		FROM promo_codes ORDER BY created_at DESC`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []PromoCode
	for rows.Next() {
		var p PromoCode
		if err := rows.Scan(&p.ID, &p.Code, &p.Description, &p.DiscountType, &p.DiscountValue, &p.MinOrder,
			&p.MaxUses, &p.UsedCount, &p.PerPhoneLimit, &p.StartsAt, &p.ExpiresAt, &p.Active, &p.Source, &p.CreatedAt, &p.UpdatedAt); err != nil {
			return nil, err
		}
		out = append(out, p)
	}
	return out, rows.Err()
}

const promoCols = `id, code, description, discount_type, discount_value, min_order,
	max_uses, used_count, per_phone_limit, starts_at, expires_at, active, source, created_at, updated_at`

func scanPromo(row pgx.Row, p *PromoCode) error {
	return row.Scan(&p.ID, &p.Code, &p.Description, &p.DiscountType, &p.DiscountValue, &p.MinOrder,
		&p.MaxUses, &p.UsedCount, &p.PerPhoneLimit, &p.StartsAt, &p.ExpiresAt, &p.Active, &p.Source, &p.CreatedAt, &p.UpdatedAt)
}

func (r *Promos) Create(ctx context.Context, p *PromoCode) error {
	row := r.pool.QueryRow(ctx, `
		INSERT INTO promo_codes (code, description, discount_type, discount_value, min_order,
			max_uses, per_phone_limit, starts_at, expires_at, active, source)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
		RETURNING `+promoCols,
		strings.ToUpper(strings.TrimSpace(p.Code)), p.Description, p.DiscountType, p.DiscountValue, p.MinOrder,
		p.MaxUses, p.PerPhoneLimit, p.StartsAt, p.ExpiresAt, p.Active, p.Source)
	return scanPromo(row, p)
}

// Update changes everything except the code (code is the promo's identity).
func (r *Promos) Update(ctx context.Context, p *PromoCode) error {
	row := r.pool.QueryRow(ctx, `
		UPDATE promo_codes SET description=$2, discount_type=$3, discount_value=$4, min_order=$5,
			max_uses=$6, per_phone_limit=$7, starts_at=$8, expires_at=$9, active=$10, source=$11, updated_at=now()
		WHERE id=$1
		RETURNING `+promoCols,
		p.ID, p.Description, p.DiscountType, p.DiscountValue, p.MinOrder,
		p.MaxUses, p.PerPhoneLimit, p.StartsAt, p.ExpiresAt, p.Active, p.Source)
	err := scanPromo(row, p)
	if errors.Is(err, pgx.ErrNoRows) {
		return ErrPromoNotFound
	}
	return err
}

func (r *Promos) Delete(ctx context.Context, id int64) error {
	_, err := r.pool.Exec(ctx, `DELETE FROM promo_codes WHERE id=$1`, id)
	return err
}

func normalizePhone(p string) string {
	var b strings.Builder
	for _, r := range p {
		if r >= '0' && r <= '9' {
			b.WriteRune(r)
		}
	}
	s := b.String()
	if len(s) == 11 && (s[0] == '7' || s[0] == '8') {
		return "7" + s[1:]
	}
	if len(s) == 10 {
		return "7" + s
	}
	return s
}
