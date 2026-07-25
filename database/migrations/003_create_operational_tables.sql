CREATE TABLE IF NOT EXISTS comandas (
  numero TEXT PRIMARY KEY,
  status TEXT NOT NULL,
  total NUMERIC(14, 2) NOT NULL DEFAULT 0,
  item_count INTEGER NOT NULL DEFAULT 0,
  opened_at TIMESTAMPTZ NOT NULL,
  closed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  lock_json JSONB,
  source_snapshot JSONB NOT NULL
);

CREATE TABLE IF NOT EXISTS comanda_items (
  id TEXT PRIMARY KEY,
  comanda_numero TEXT NOT NULL REFERENCES comandas(numero) ON DELETE CASCADE,
  name TEXT NOT NULL,
  quantity NUMERIC(14, 3) NOT NULL DEFAULT 0,
  weight NUMERIC(14, 3),
  unit_price NUMERIC(14, 2) NOT NULL DEFAULT 0,
  subtotal NUMERIC(14, 2) NOT NULL DEFAULT 0,
  by_weight BOOLEAN NOT NULL DEFAULT FALSE,
  by_unit BOOLEAN NOT NULL DEFAULT FALSE,
  raw_json JSONB NOT NULL,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS comanda_pesagens (
  id TEXT PRIMARY KEY,
  comanda_numero TEXT NOT NULL REFERENCES comandas(numero) ON DELETE CASCADE,
  weight NUMERIC(14, 3) NOT NULL,
  origin TEXT,
  owner TEXT,
  station_id TEXT,
  item_id TEXT,
  product_name TEXT,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL,
  raw_json JSONB NOT NULL
);

CREATE TABLE IF NOT EXISTS vendas (
  id TEXT PRIMARY KEY,
  comanda_numero TEXT REFERENCES comandas(numero) ON DELETE SET NULL,
  document_mode TEXT NOT NULL CHECK (document_mode IN ('NFCE', 'ORCAMENTO')),
  status TEXT NOT NULL DEFAULT 'CLOSED',
  subtotal NUMERIC(14, 2) NOT NULL DEFAULT 0,
  discount NUMERIC(14, 2) NOT NULL DEFAULT 0,
  total NUMERIC(14, 2) NOT NULL DEFAULT 0,
  operator TEXT,
  pdv TEXT,
  customer_document TEXT,
  source TEXT NOT NULL DEFAULT 'BACKEND',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  closed_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS pagamentos (
  id TEXT PRIMARY KEY,
  venda_id TEXT NOT NULL REFERENCES vendas(id) ON DELETE CASCADE,
  method TEXT NOT NULL,
  label TEXT,
  amount NUMERIC(14, 2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS caixa_sessions (
  id TEXT PRIMARY KEY,
  status TEXT NOT NULL CHECK (status IN ('OPEN', 'CLOSED')),
  opened_at TIMESTAMPTZ NOT NULL,
  closed_at TIMESTAMPTZ,
  opened_by TEXT,
  closed_by TEXT,
  total_sales NUMERIC(14, 2) NOT NULL DEFAULT 0,
  attendance_count INTEGER NOT NULL DEFAULT 0,
  expected_totals JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS financeiro (
  id TEXT PRIMARY KEY,
  finance_code TEXT,
  tab TEXT NOT NULL,
  movement_type TEXT,
  category TEXT,
  amount NUMERIC(14, 2) NOT NULL DEFAULT 0,
  description TEXT,
  account_name TEXT,
  document_ref TEXT,
  status TEXT NOT NULL,
  due_date DATE,
  competence_date DATE,
  supplier_name TEXT,
  convenio_id TEXT,
  convenio_name TEXT,
  payment_method TEXT,
  launched_at TIMESTAMPTZ,
  source_json JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id BIGSERIAL PRIMARY KEY,
  action TEXT NOT NULL,
  user_id TEXT,
  user_role TEXT,
  entity TEXT NOT NULL,
  entity_id TEXT,
  before_json JSONB,
  after_json JSONB,
  status TEXT NOT NULL DEFAULT 'SUCCESS',
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_comandas_status ON comandas(status);
CREATE INDEX IF NOT EXISTS idx_comanda_items_numero ON comanda_items(comanda_numero);
CREATE INDEX IF NOT EXISTS idx_vendas_closed_at ON vendas(closed_at);
CREATE INDEX IF NOT EXISTS idx_pagamentos_venda ON pagamentos(venda_id);
CREATE INDEX IF NOT EXISTS idx_financeiro_status ON financeiro(status);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs(entity, entity_id);
