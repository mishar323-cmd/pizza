CREATE TABLE IF NOT EXISTS promo_codes (
  id BIGSERIAL PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  discount_type TEXT NOT NULL CHECK (discount_type IN ('percent', 'fixed')),
  discount_value NUMERIC(10,2) NOT NULL CHECK (discount_value > 0),
  min_order NUMERIC(10,2) NOT NULL DEFAULT 0,
  max_uses INT,
  used_count INT NOT NULL DEFAULT 0,
  per_phone_limit INT NOT NULL DEFAULT 0,
  starts_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  active BOOLEAN NOT NULL DEFAULT true,
  source TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS promo_codes_code_idx ON promo_codes(UPPER(code));
CREATE INDEX IF NOT EXISTS promo_codes_active_idx ON promo_codes(active) WHERE active = true;

CREATE TABLE IF NOT EXISTS promo_redemptions (
  id BIGSERIAL PRIMARY KEY,
  promo_id BIGINT NOT NULL REFERENCES promo_codes(id) ON DELETE CASCADE,
  order_id BIGINT REFERENCES orders(id) ON DELETE SET NULL,
  customer_phone TEXT NOT NULL,
  discount_applied NUMERIC(10,2) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS promo_redemptions_promo_idx ON promo_redemptions(promo_id);
CREATE INDEX IF NOT EXISTS promo_redemptions_phone_idx ON promo_redemptions(customer_phone);
CREATE INDEX IF NOT EXISTS promo_redemptions_order_idx ON promo_redemptions(order_id);

ALTER TABLE orders ADD COLUMN IF NOT EXISTS promo_code TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS promo_discount NUMERIC(10,2) NOT NULL DEFAULT 0;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS utm_source TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS utm_medium TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS utm_campaign TEXT;

INSERT INTO promo_codes (code, description, discount_type, discount_value, min_order, source, active)
VALUES ('NEWSITE', 'Скидка 200 ₽ при заказе через сайт (стикер на коробке Я.Еды)', 'fixed', 200, 800, 'yandex_eda_sticker', true)
ON CONFLICT (code) DO NOTHING;

INSERT INTO promo_codes (code, description, discount_type, discount_value, min_order, source, active)
VALUES ('RIGA300', 'Скидка 300 ₽ на 1-й заказ для ЖК Резиденции Новая Рига', 'fixed', 300, 1000, 'uk_flyer', true)
ON CONFLICT (code) DO NOTHING;
