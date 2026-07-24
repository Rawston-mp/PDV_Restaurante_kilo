CREATE TABLE IF NOT EXISTS public.pdv_products (
  id TEXT PRIMARY KEY,
  product_code TEXT NOT NULL UNIQUE,
  barcode TEXT,
  image_url TEXT,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL,
  is_unavailable BOOLEAN NOT NULL DEFAULT FALSE,
  is_hidden BOOLEAN NOT NULL DEFAULT FALSE,
  ncm TEXT,
  cfop TEXT,
  cst_icms TEXT,
  tax_situation_code TEXT,
  aliq_icms TEXT,
  cst_pis TEXT,
  aliq_pis TEXT,
  cst_cofins TEXT,
  aliq_cofins TEXT,
  fiscal_type TEXT,
  purchase_unit TEXT,
  sale_unit TEXT,
  units_per_purchase NUMERIC(12, 4) NOT NULL DEFAULT 1,
  purchase_cost_value NUMERIC(14, 4) NOT NULL DEFAULT 0,
  cost_value NUMERIC(14, 4) NOT NULL DEFAULT 0,
  margin_profit NUMERIC(10, 4) NOT NULL DEFAULT 0,
  price NUMERIC(14, 4) NOT NULL DEFAULT 0,
  by_weight BOOLEAN NOT NULL DEFAULT FALSE,
  stock NUMERIC(14, 4) NOT NULL DEFAULT 0,
  version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_synced_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_pdv_products_name
  ON public.pdv_products USING GIN (to_tsvector('portuguese', name));

CREATE INDEX IF NOT EXISTS idx_pdv_products_category
  ON public.pdv_products (category);

CREATE INDEX IF NOT EXISTS idx_pdv_products_barcode
  ON public.pdv_products (barcode);
