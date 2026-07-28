package repo

import (
	"context"
	"encoding/json"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

type AuditEntry struct {
	ID         int64           `json:"id"`
	AdminID    int64           `json:"adminId"`
	AdminLogin string          `json:"adminLogin"`
	AdminName  string          `json:"adminName"`
	Action     string          `json:"action"`
	Target     string          `json:"target"`
	Details    json.RawMessage `json:"details"`
	IP         string          `json:"ip"`
	CreatedAt  time.Time       `json:"createdAt"`
}

type Audit struct{ pool *pgxpool.Pool }

func NewAudit(pool *pgxpool.Pool) *Audit { return &Audit{pool: pool} }

func (r *Audit) Record(ctx context.Context, e AuditEntry) error {
	details := e.Details
	if len(details) == 0 {
		details = json.RawMessage(`{}`)
	}
	_, err := r.pool.Exec(ctx,
		`INSERT INTO admin_audit_log(admin_id, admin_login, admin_name, action, target, details, ip)
		 VALUES($1,$2,$3,$4,$5,$6::jsonb,$7)`,
		e.AdminID, e.AdminLogin, e.AdminName, e.Action, e.Target, string(details), e.IP,
	)
	return err
}

func (r *Audit) List(ctx context.Context, limit int) ([]AuditEntry, error) {
	if limit <= 0 || limit > 500 {
		limit = 100
	}
	rows, err := r.pool.Query(ctx,
		`SELECT id, admin_id, admin_login, admin_name, action, target, details, ip, created_at
		 FROM admin_audit_log ORDER BY id DESC LIMIT $1`, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []AuditEntry
	for rows.Next() {
		var e AuditEntry
		var details []byte
		if err := rows.Scan(&e.ID, &e.AdminID, &e.AdminLogin, &e.AdminName,
			&e.Action, &e.Target, &details, &e.IP, &e.CreatedAt); err != nil {
			return nil, err
		}
		e.Details = json.RawMessage(details)
		out = append(out, e)
	}
	return out, rows.Err()
}
