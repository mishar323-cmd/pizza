CREATE TABLE IF NOT EXISTS admin_audit_log (
  id          BIGSERIAL PRIMARY KEY,
  admin_id    BIGINT,
  admin_login TEXT NOT NULL DEFAULT '',
  admin_name  TEXT NOT NULL DEFAULT '',
  action      TEXT NOT NULL,            -- login | order.status | settings.<key> | admin.create | admin.delete
  target      TEXT NOT NULL DEFAULT '', -- human-readable object, e.g. «заказ #1042», «акции», «админ semyon»
  details     JSONB NOT NULL DEFAULT '{}'::jsonb,
  ip          TEXT NOT NULL DEFAULT '',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS admin_audit_created_idx ON admin_audit_log(id DESC);
