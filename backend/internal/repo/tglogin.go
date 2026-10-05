package repo

import (
	"context"
	"errors"
	"time"

	"github.com/jackc/pgx/v5"
)

// TGLogin is one "log in through the bot" attempt started by the website.
type TGLogin struct {
	Nonce     string
	ChatID    *int64
	UserID    *int64
	ExpiresAt time.Time
	UsedAt    *time.Time
}

func (r *Customers) CreateTGLogin(ctx context.Context, nonce, ip string, ttl time.Duration) error {
	_, err := r.pool.Exec(ctx, `
		INSERT INTO tg_logins(nonce, request_ip, expires_at)
		VALUES ($1, $2, now() + make_interval(secs => $3))`, nonce, ip, ttl.Seconds())
	return err
}

// BindTGChat remembers which chat opened the link, so the contact message that
// follows can be matched to this attempt.
func (r *Customers) BindTGChat(ctx context.Context, nonce string, chatID int64) (bool, error) {
	tag, err := r.pool.Exec(ctx, `
		UPDATE tg_logins SET chat_id = $2
		WHERE nonce = $1 AND used_at IS NULL AND expires_at > now()`, nonce, chatID)
	if err != nil {
		return false, err
	}
	return tag.RowsAffected() > 0, nil
}

// AttachTGUser links the confirmed account to the newest pending attempt of that chat.
func (r *Customers) AttachTGUser(ctx context.Context, chatID, userID int64) (bool, error) {
	tag, err := r.pool.Exec(ctx, `
		UPDATE tg_logins SET user_id = $2
		WHERE nonce = (
			SELECT nonce FROM tg_logins
			WHERE chat_id = $1 AND used_at IS NULL AND expires_at > now()
			ORDER BY created_at DESC LIMIT 1
		)`, chatID, userID)
	if err != nil {
		return false, err
	}
	return tag.RowsAffected() > 0, nil
}

func (r *Customers) TGLoginStatus(ctx context.Context, nonce string) (*TGLogin, error) {
	var l TGLogin
	err := r.pool.QueryRow(ctx, `
		SELECT nonce, chat_id, user_id, expires_at, used_at FROM tg_logins WHERE nonce = $1`, nonce).
		Scan(&l.Nonce, &l.ChatID, &l.UserID, &l.ExpiresAt, &l.UsedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrNotFound
	}
	return &l, err
}

// ConsumeTGLogin marks the attempt used; false when another request got it first.
func (r *Customers) ConsumeTGLogin(ctx context.Context, nonce string) (bool, error) {
	tag, err := r.pool.Exec(ctx, `
		UPDATE tg_logins SET used_at = now()
		WHERE nonce = $1 AND used_at IS NULL AND user_id IS NOT NULL AND expires_at > now()`, nonce)
	if err != nil {
		return false, err
	}
	return tag.RowsAffected() == 1, nil
}
