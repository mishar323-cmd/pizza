-- Вход на сайт через Telegram-бота: сайт выдаёт одноразовый nonce,
-- бот связывает его с чатом и подтверждённым номером телефона.
CREATE TABLE IF NOT EXISTS tg_logins (
  nonce      TEXT PRIMARY KEY,
  chat_id    BIGINT,
  user_id    BIGINT REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL,
  used_at    TIMESTAMPTZ,
  request_ip TEXT NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS tg_logins_chat_idx ON tg_logins(chat_id, created_at DESC);
CREATE INDEX IF NOT EXISTS tg_logins_created_idx ON tg_logins(created_at);
