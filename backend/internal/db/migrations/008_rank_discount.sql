-- Скидка за ранг покупателя и промокоды «только на первый заказ».
ALTER TABLE orders ADD COLUMN IF NOT EXISTS rank_discount NUMERIC(10,2) NOT NULL DEFAULT 0;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS rank_level TEXT NOT NULL DEFAULT '';
ALTER TABLE promo_codes ADD COLUMN IF NOT EXISTS first_order_only BOOLEAN NOT NULL DEFAULT false;
