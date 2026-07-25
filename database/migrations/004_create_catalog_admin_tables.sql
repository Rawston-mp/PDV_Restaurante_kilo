CREATE TABLE IF NOT EXISTS pdv_clients (
  id TEXT PRIMARY KEY,
  code TEXT,
  name TEXT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  version INTEGER NOT NULL DEFAULT 1,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS pdv_suppliers (
  id TEXT PRIMARY KEY,
  code TEXT,
  name TEXT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  version INTEGER NOT NULL DEFAULT 1,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS pdv_convenios (
  id TEXT PRIMARY KEY,
  code TEXT,
  name TEXT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  version INTEGER NOT NULL DEFAULT 1,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS pdv_employees (
  id TEXT PRIMARY KEY,
  code TEXT,
  name TEXT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  version INTEGER NOT NULL DEFAULT 1,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS pdv_categories (
  id TEXT PRIMARY KEY,
  code TEXT,
  name TEXT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  version INTEGER NOT NULL DEFAULT 1,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS pdv_card_administrators (
  id TEXT PRIMARY KEY,
  code TEXT,
  name TEXT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  version INTEGER NOT NULL DEFAULT 1,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS pdv_stores (
  id TEXT PRIMARY KEY,
  code TEXT,
  name TEXT NOT NULL,
  legal_name TEXT,
  trade_name TEXT,
  cnpj TEXT,
  state_registration TEXT,
  commercial_status TEXT NOT NULL DEFAULT 'EM_DIA',
  allowed_roles TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  active BOOLEAN NOT NULL DEFAULT TRUE,
  version INTEGER NOT NULL DEFAULT 1,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS pdv_store_users (
  id TEXT PRIMARY KEY,
  store_id TEXT REFERENCES pdv_stores(id) ON DELETE CASCADE,
  role TEXT NOT NULL,
  name TEXT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS pdv_store_pins (
  id TEXT PRIMARY KEY,
  store_id TEXT REFERENCES pdv_stores(id) ON DELETE CASCADE,
  role TEXT NOT NULL,
  pin_kind TEXT NOT NULL CHECK (pin_kind IN ('LOGIN', 'SENSITIVE')),
  pin_value TEXT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (store_id, role, pin_kind)
);

CREATE TABLE IF NOT EXISTS pdv_peripheral_settings (
  id TEXT PRIMARY KEY,
  store_id TEXT REFERENCES pdv_stores(id) ON DELETE SET NULL,
  computer_name TEXT,
  peripheral_type TEXT NOT NULL,
  name TEXT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS pdv_fiscal_settings (
  id TEXT PRIMARY KEY,
  store_id TEXT REFERENCES pdv_stores(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS pdv_sefaz_settings (
  id TEXT PRIMARY KEY,
  store_id TEXT REFERENCES pdv_stores(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  environment TEXT NOT NULL DEFAULT 'HOMOLOGACAO',
  active BOOLEAN NOT NULL DEFAULT TRUE,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS pdv_support_settings (
  id TEXT PRIMARY KEY,
  store_id TEXT REFERENCES pdv_stores(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pdv_clients_name ON pdv_clients (name);
CREATE INDEX IF NOT EXISTS idx_pdv_suppliers_name ON pdv_suppliers (name);
CREATE INDEX IF NOT EXISTS idx_pdv_convenios_name ON pdv_convenios (name);
CREATE INDEX IF NOT EXISTS idx_pdv_employees_name ON pdv_employees (name);
CREATE INDEX IF NOT EXISTS idx_pdv_categories_name ON pdv_categories (name);
CREATE INDEX IF NOT EXISTS idx_pdv_card_administrators_name ON pdv_card_administrators (name);
CREATE INDEX IF NOT EXISTS idx_pdv_stores_name ON pdv_stores (name);
CREATE INDEX IF NOT EXISTS idx_pdv_stores_active ON pdv_stores (active);
CREATE INDEX IF NOT EXISTS idx_pdv_store_users_store ON pdv_store_users (store_id);
CREATE INDEX IF NOT EXISTS idx_pdv_store_pins_store ON pdv_store_pins (store_id);
CREATE INDEX IF NOT EXISTS idx_pdv_peripheral_store ON pdv_peripheral_settings (store_id);
CREATE INDEX IF NOT EXISTS idx_pdv_fiscal_store ON pdv_fiscal_settings (store_id);
CREATE INDEX IF NOT EXISTS idx_pdv_sefaz_store ON pdv_sefaz_settings (store_id);
