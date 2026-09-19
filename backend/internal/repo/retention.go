package repo

import (
	"context"

	"github.com/jackc/pgx/v5/pgxpool"
)

// PurgeExpired enforces the retention periods stated in the privacy policy:
// login codes 30 days, revoked sessions 30 days, orders are anonymized after
// 3 years (sums and items stay for accounting).
func PurgeExpired(ctx context.Context, pool *pgxpool.Pool) (map[string]int64, error) {
	stmts := []struct{ name, sql string }{
		{"otp_codes", `DELETE FROM otp_codes WHERE created_at < now() - interval '30 days'`},
		{"sessions", `DELETE FROM sessions WHERE revoked_at < now() - interval '30 days'`},
		{"orders_anonymized", `UPDATE orders SET customer_name = 'обезличено', customer_phone = '', address = NULL, comment = NULL
			WHERE created_at < now() - interval '3 years' AND customer_phone <> ''`},
	}
	out := map[string]int64{}
	for _, s := range stmts {
		tag, err := pool.Exec(ctx, s.sql)
		if err != nil {
			return out, err
		}
		out[s.name] = tag.RowsAffected()
	}
	return out, nil
}
