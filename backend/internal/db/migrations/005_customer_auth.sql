CREATE TABLE IF NOT EXISTS users (
  id            BIGSERIAL PRIMARY KEY,
  phone         TEXT UNIQUE NOT NULL,
  name          TEXT NOT NULL DEFAULT '',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_login_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS user_addresses (
  id          BIGSERIAL PRIMARY KEY,
  user_id     BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  label       TEXT NOT NULL DEFAULT '',
  text        TEXT NOT NULL,
  is_favorite BOOLEAN NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS user_addresses_user_idx ON user_addresses(user_id);

CREATE TABLE IF NOT EXISTS otp_codes (
  id          BIGSERIAL PRIMARY KEY,
  phone       TEXT NOT NULL,
  code_hash   TEXT NOT NULL,
  channel     TEXT NOT NULL DEFAULT '',
  attempts    INT NOT NULL DEFAULT 0,
  expires_at  TIMESTAMPTZ NOT NULL,
  consumed_at TIMESTAMPTZ,
  request_ip  TEXT NOT NULL DEFAULT '',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS otp_codes_phone_created_idx ON otp_codes(phone, created_at);
CREATE INDEX IF NOT EXISTS otp_codes_ip_created_idx ON otp_codes(request_ip, created_at);
CREATE INDEX IF NOT EXISTS otp_codes_created_idx ON otp_codes(created_at);

CREATE TABLE IF NOT EXISTS sessions (
  id           BIGSERIAL PRIMARY KEY,
  user_id      BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash   TEXT UNIQUE NOT NULL,
  user_agent   TEXT NOT NULL DEFAULT '',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  revoked_at   TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS sessions_user_idx ON sessions(user_id);

ALTER TABLE orders ADD COLUMN IF NOT EXISTS user_id BIGINT REFERENCES users(id);
CREATE INDEX IF NOT EXISTS orders_user_idx ON orders(user_id);
CREATE INDEX IF NOT EXISTS orders_phone10_idx ON orders (right(regexp_replace(customer_phone, '\D', '', 'g'), 10));
ALTER TABLE orders ADD COLUMN IF NOT EXISTS loyalty_discount NUMERIC(10,2) NOT NULL DEFAULT 0;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS loyalty_free_qty INT NOT NULL DEFAULT 0;
