-- TapFlow | D1 SQLite | MIGRATION PROPOSTA / NÃO APLICADA
-- Jamais executar em bancos de Flow, Alvo OS ou KAIRÓS.
-- O D1 não oferece RLS: todas as leituras/escritas exigirão autorização no backend.
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS tenants (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','active','suspended')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS locations (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','active','suspended')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(tenant_id) REFERENCES tenants(id),
  UNIQUE(tenant_id,id)
);

CREATE TABLE IF NOT EXISTS dining_tables (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  location_id TEXT NOT NULL,
  label TEXT NOT NULL,
  token_hash TEXT,
  is_active INTEGER NOT NULL DEFAULT 0 CHECK(is_active IN (0,1)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(tenant_id,location_id) REFERENCES locations(tenant_id,id),
  UNIQUE(tenant_id,id),
  UNIQUE(tenant_id,location_id,label)
);

CREATE TABLE IF NOT EXISTS menu_items (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  location_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  price_cents INTEGER NOT NULL CHECK(price_cents>=0 AND price_cents<=100000000),
  currency TEXT NOT NULL DEFAULT 'BRL' CHECK(currency='BRL'),
  availability TEXT NOT NULL DEFAULT 'hidden' CHECK(availability IN ('available','sold_out','hidden')),
  poster_key TEXT,
  video_key TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(tenant_id,location_id) REFERENCES locations(tenant_id,id),
  UNIQUE(tenant_id,id)
);

CREATE TABLE IF NOT EXISTS menu_addons (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  menu_item_id TEXT NOT NULL,
  name TEXT NOT NULL,
  price_cents INTEGER NOT NULL CHECK(price_cents>=0 AND price_cents<=100000000),
  is_available INTEGER NOT NULL DEFAULT 1 CHECK(is_available IN (0,1)),
  FOREIGN KEY(tenant_id,menu_item_id) REFERENCES menu_items(tenant_id,id),
  UNIQUE(tenant_id,id)
);

CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  location_id TEXT NOT NULL,
  table_id TEXT,
  actor_session_hash TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'submitted' CHECK(status IN ('submitted','accepted','preparing','ready','completed','rejected','cancelled')),
  payment_status TEXT NOT NULL DEFAULT 'not_required' CHECK(payment_status IN ('not_required','pending','authorized','paid','failed','expired','refund_pending','refunded','partially_refunded')),
  total_cents INTEGER NOT NULL CHECK(total_cents>=0 AND total_cents<=100000000),
  currency TEXT NOT NULL DEFAULT 'BRL' CHECK(currency='BRL'),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(tenant_id,location_id) REFERENCES locations(tenant_id,id),
  FOREIGN KEY(tenant_id,table_id) REFERENCES dining_tables(tenant_id,id),
  UNIQUE(tenant_id,id)
);

CREATE TABLE IF NOT EXISTS order_lines (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  order_id TEXT NOT NULL,
  item_id TEXT NOT NULL,
  name_snapshot TEXT NOT NULL,
  addons_json TEXT NOT NULL DEFAULT '[]',
  quantity INTEGER NOT NULL CHECK(quantity BETWEEN 1 AND 10),
  unit_price_cents INTEGER NOT NULL CHECK(unit_price_cents>=0),
  total_cents INTEGER NOT NULL CHECK(total_cents>=0),
  notes TEXT,
  FOREIGN KEY(tenant_id,order_id) REFERENCES orders(tenant_id,id)
);

CREATE TABLE IF NOT EXISTS order_idempotency (
  tenant_id TEXT NOT NULL,
  actor_session_hash TEXT NOT NULL,
  idempotency_key TEXT NOT NULL,
  request_hash TEXT NOT NULL,
  order_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY(tenant_id,actor_session_hash,idempotency_key),
  FOREIGN KEY(tenant_id,order_id) REFERENCES orders(tenant_id,id)
);

CREATE TABLE IF NOT EXISTS order_events (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  order_id TEXT NOT NULL,
  action TEXT NOT NULL,
  actor_type TEXT NOT NULL,
  actor_id TEXT,
  reason TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(tenant_id,order_id) REFERENCES orders(tenant_id,id)
);

CREATE INDEX IF NOT EXISTS idx_locations_tenant ON locations(tenant_id,status);
CREATE INDEX IF NOT EXISTS idx_tables_scope ON dining_tables(tenant_id,location_id,is_active);
CREATE INDEX IF NOT EXISTS idx_items_scope ON menu_items(tenant_id,location_id,availability);
CREATE INDEX IF NOT EXISTS idx_order_scope ON orders(tenant_id,location_id,status,created_at);
CREATE INDEX IF NOT EXISTS idx_order_events_scope ON order_events(tenant_id,order_id,created_at);

-- PENDÊNCIAS ANTES DE PRODUÇÃO:
-- 1. Identidade de mesa/autor no backend, sessão segura, revogação e rate limits.
-- 2. Cotação versionada e snapshot atômico de itens, preço e estoque.
-- 3. Testes de batch/transação, unicidade e concorrência/idempotência no D1 real.
-- 4. Backups, rotinas de restore, migrações aditivas e monitoramento.
-- 5. Nenhum endpoint público que aceite tenant_id como autorização.
