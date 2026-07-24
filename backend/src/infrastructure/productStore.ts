import { Pool } from 'pg';
import * as dotenv from 'dotenv';

dotenv.config({ path: `${process.cwd()}/.env` });

export type ProductRecord = {
  id: string;
  productCode: string;
  barcode?: string;
  imageUrl?: string;
  name: string;
  description?: string;
  category: string;
  isUnavailable?: boolean;
  isHidden?: boolean;
  ncm?: string;
  cfop?: string;
  cstIcms?: string;
  taxSituationCode?: string;
  aliqIcms?: string;
  cstPis?: string;
  aliqPis?: string;
  cstCofins?: string;
  aliqCofins?: string;
  fiscalType?: string;
  purchaseUnit?: string;
  saleUnit?: string;
  unitsPerPurchase?: number;
  purchaseCostValue?: number;
  costValue?: number;
  marginProfit?: number;
  price: number;
  byWeight: boolean;
  stock: number;
  version: number;
  createdAt: string;
  updatedAt: string;
  lastSyncedAt?: string;
};

export type ProductStore = {
  initialize: () => Promise<void>;
  list: () => Promise<ProductRecord[]>;
  findById: (id: string) => Promise<ProductRecord | null>;
  save: (product: ProductRecord) => Promise<ProductRecord>;
  delete: (id: string) => Promise<void>;
};

type PostgresConfig = {
  connectionString?: string;
  host: string;
  port: number;
  database: string;
  user: string;
  password?: string;
  ssl: boolean;
};

const parseBoolean = (value: string | undefined, fallback = false) => {
  if (!value) {
    return fallback;
  }

  return ['1', 'true', 'yes', 'on'].includes(value.trim().toLowerCase());
};

const buildPostgresConfig = (): PostgresConfig => {
  const rawConnectionString = (
    process.env.PRODUCT_DATABASE_URL ??
    process.env.POSTGRES_URL ??
    process.env.DATABASE_URL
  )?.trim().replace(/^"|"$/g, '');
  const connectionString = rawConnectionString?.startsWith('postgres://') || rawConnectionString?.startsWith('postgresql://')
    ? rawConnectionString
    : undefined;

  return {
    connectionString: connectionString || undefined,
    host: process.env.PGHOST?.trim() || '127.0.0.1',
    port: Number(process.env.PGPORT ?? 5432),
    database: process.env.PGDATABASE?.trim() || 'postgres',
    user: process.env.PGUSER?.trim() || 'postgres',
    password: process.env.PGPASSWORD?.trim() || 'postgres',
    ssl: parseBoolean(process.env.PGSSL, false)
  };
};

const createPool = () => {
  const config = buildPostgresConfig();
  const connectionTimeoutMillis = Number(process.env.PG_CONNECTION_TIMEOUT_MS ?? 3000);

  if (config.connectionString) {
    return new Pool({
      connectionString: config.connectionString,
      connectionTimeoutMillis,
      ssl: config.ssl ? { rejectUnauthorized: false } : undefined
    });
  }

  return new Pool({
    host: config.host,
    port: config.port,
    database: config.database,
    user: config.user,
    password: config.password,
    connectionTimeoutMillis,
    ssl: config.ssl ? { rejectUnauthorized: false } : undefined
  });
};

const toOptionalText = (value: unknown) => (typeof value === 'string' && value.trim() ? value.trim() : null);

const toOptionalNumber = (value: unknown) => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value.replace(',', '.'));
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
};

const toRequiredNumber = (value: unknown, fallback = 0) => toOptionalNumber(value) ?? fallback;

const toBoolean = (value: unknown, fallback = false) => {
  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'string') {
    return parseBoolean(value, fallback);
  }

  return fallback;
};

const toIsoDate = (value: unknown) => {
  if (typeof value === 'string' && value.trim()) {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toISOString();
    }
  }

  return new Date().toISOString();
};

const normalizeProduct = (input: unknown): ProductRecord | null => {
  if (typeof input !== 'object' || input === null) {
    return null;
  }

  const payload = input as Record<string, unknown>;
  const id = toOptionalText(payload.id);
  const name = toOptionalText(payload.name);
  const productCode = toOptionalText(payload.productCode);
  const category = toOptionalText(payload.category);

  if (!id || !name || !productCode || !category) {
    return null;
  }

  const now = new Date().toISOString();

  return {
    id,
    productCode,
    barcode: toOptionalText(payload.barcode) ?? undefined,
    imageUrl: toOptionalText(payload.imageUrl) ?? undefined,
    name,
    description: toOptionalText(payload.description) ?? undefined,
    category,
    isUnavailable: toBoolean(payload.isUnavailable, false),
    isHidden: toBoolean(payload.isHidden, false),
    ncm: toOptionalText(payload.ncm) ?? undefined,
    cfop: toOptionalText(payload.cfop) ?? undefined,
    cstIcms: toOptionalText(payload.cstIcms) ?? undefined,
    taxSituationCode: toOptionalText(payload.taxSituationCode) ?? undefined,
    aliqIcms: toOptionalText(payload.aliqIcms) ?? undefined,
    cstPis: toOptionalText(payload.cstPis) ?? undefined,
    aliqPis: toOptionalText(payload.aliqPis) ?? undefined,
    cstCofins: toOptionalText(payload.cstCofins) ?? undefined,
    aliqCofins: toOptionalText(payload.aliqCofins) ?? undefined,
    fiscalType: toOptionalText(payload.fiscalType) ?? undefined,
    purchaseUnit: toOptionalText(payload.purchaseUnit) ?? 'UN',
    saleUnit: toOptionalText(payload.saleUnit) ?? 'UN',
    unitsPerPurchase: toRequiredNumber(payload.unitsPerPurchase, 1),
    purchaseCostValue: toRequiredNumber(payload.purchaseCostValue, 0),
    costValue: toRequiredNumber(payload.costValue, 0),
    marginProfit: toRequiredNumber(payload.marginProfit, 0),
    price: toRequiredNumber(payload.price, 0),
    byWeight: toBoolean(payload.byWeight, false),
    stock: toRequiredNumber(payload.stock, 0),
    version: Math.max(1, Math.trunc(toRequiredNumber(payload.version, 1))),
    createdAt: toIsoDate(payload.createdAt ?? now),
    updatedAt: toIsoDate(payload.updatedAt ?? now),
    lastSyncedAt: toOptionalText(payload.lastSyncedAt) ?? undefined
  };
};

const mapRow = (row: Record<string, unknown>): ProductRecord => ({
  id: String(row.id),
  productCode: String(row.product_code),
  barcode: row.barcode ? String(row.barcode) : undefined,
  imageUrl: row.image_url ? String(row.image_url) : undefined,
  name: String(row.name),
  description: row.description ? String(row.description) : undefined,
  category: String(row.category),
  isUnavailable: Boolean(row.is_unavailable),
  isHidden: Boolean(row.is_hidden),
  ncm: row.ncm ? String(row.ncm) : undefined,
  cfop: row.cfop ? String(row.cfop) : undefined,
  cstIcms: row.cst_icms ? String(row.cst_icms) : undefined,
  taxSituationCode: row.tax_situation_code ? String(row.tax_situation_code) : undefined,
  aliqIcms: row.aliq_icms ? String(row.aliq_icms) : undefined,
  cstPis: row.cst_pis ? String(row.cst_pis) : undefined,
  aliqPis: row.aliq_pis ? String(row.aliq_pis) : undefined,
  cstCofins: row.cst_cofins ? String(row.cst_cofins) : undefined,
  aliqCofins: row.aliq_cofins ? String(row.aliq_cofins) : undefined,
  fiscalType: row.fiscal_type ? String(row.fiscal_type) : undefined,
  purchaseUnit: row.purchase_unit ? String(row.purchase_unit) : undefined,
  saleUnit: row.sale_unit ? String(row.sale_unit) : undefined,
  unitsPerPurchase: Number(row.units_per_purchase ?? 1),
  purchaseCostValue: Number(row.purchase_cost_value ?? 0),
  costValue: Number(row.cost_value ?? 0),
  marginProfit: Number(row.margin_profit ?? 0),
  price: Number(row.price ?? 0),
  byWeight: Boolean(row.by_weight),
  stock: Number(row.stock ?? 0),
  version: Number(row.version ?? 1),
  createdAt: new Date(String(row.created_at)).toISOString(),
  updatedAt: new Date(String(row.updated_at)).toISOString(),
  lastSyncedAt: row.last_synced_at ? new Date(String(row.last_synced_at)).toISOString() : undefined
});

class PostgresProductStore implements ProductStore {
  constructor(private readonly pool: Pool) {}

  async initialize() {
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS pdv_products (
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
      )
    `);

    await this.pool.query('CREATE INDEX IF NOT EXISTS idx_pdv_products_name ON pdv_products USING GIN (to_tsvector(\'portuguese\', name))');
    await this.pool.query('CREATE INDEX IF NOT EXISTS idx_pdv_products_category ON pdv_products (category)');
    await this.pool.query('CREATE INDEX IF NOT EXISTS idx_pdv_products_barcode ON pdv_products (barcode)');
  }

  async list() {
    const result = await this.pool.query('SELECT * FROM pdv_products ORDER BY name ASC');
    return result.rows.map(mapRow);
  }

  async findById(id: string) {
    const result = await this.pool.query('SELECT * FROM pdv_products WHERE id = $1', [id]);
    return result.rowCount ? mapRow(result.rows[0]) : null;
  }

  async save(input: ProductRecord) {
    const product = normalizeProduct(input);
    if (!product) {
      throw new Error('Produto inválido.');
    }

    const result = await this.pool.query(
      `
        INSERT INTO pdv_products (
          id, product_code, barcode, image_url, name, description, category,
          is_unavailable, is_hidden, ncm, cfop, cst_icms, tax_situation_code,
          aliq_icms, cst_pis, aliq_pis, cst_cofins, aliq_cofins, fiscal_type,
          purchase_unit, sale_unit, units_per_purchase, purchase_cost_value,
          cost_value, margin_profit, price, by_weight, stock, version,
          created_at, updated_at, last_synced_at
        )
        VALUES (
          $1, $2, $3, $4, $5, $6, $7,
          $8, $9, $10, $11, $12, $13,
          $14, $15, $16, $17, $18, $19,
          $20, $21, $22, $23,
          $24, $25, $26, $27, $28, $29,
          $30, $31, $32
        )
        ON CONFLICT (id)
        DO UPDATE SET
          product_code = EXCLUDED.product_code,
          barcode = EXCLUDED.barcode,
          image_url = EXCLUDED.image_url,
          name = EXCLUDED.name,
          description = EXCLUDED.description,
          category = EXCLUDED.category,
          is_unavailable = EXCLUDED.is_unavailable,
          is_hidden = EXCLUDED.is_hidden,
          ncm = EXCLUDED.ncm,
          cfop = EXCLUDED.cfop,
          cst_icms = EXCLUDED.cst_icms,
          tax_situation_code = EXCLUDED.tax_situation_code,
          aliq_icms = EXCLUDED.aliq_icms,
          cst_pis = EXCLUDED.cst_pis,
          aliq_pis = EXCLUDED.aliq_pis,
          cst_cofins = EXCLUDED.cst_cofins,
          aliq_cofins = EXCLUDED.aliq_cofins,
          fiscal_type = EXCLUDED.fiscal_type,
          purchase_unit = EXCLUDED.purchase_unit,
          sale_unit = EXCLUDED.sale_unit,
          units_per_purchase = EXCLUDED.units_per_purchase,
          purchase_cost_value = EXCLUDED.purchase_cost_value,
          cost_value = EXCLUDED.cost_value,
          margin_profit = EXCLUDED.margin_profit,
          price = EXCLUDED.price,
          by_weight = EXCLUDED.by_weight,
          stock = EXCLUDED.stock,
          version = GREATEST(pdv_products.version + 1, EXCLUDED.version),
          updated_at = EXCLUDED.updated_at,
          last_synced_at = EXCLUDED.last_synced_at
        RETURNING *
      `,
      [
        product.id,
        product.productCode,
        product.barcode ?? null,
        product.imageUrl ?? null,
        product.name,
        product.description ?? null,
        product.category,
        product.isUnavailable ?? false,
        product.isHidden ?? false,
        product.ncm ?? null,
        product.cfop ?? null,
        product.cstIcms ?? null,
        product.taxSituationCode ?? null,
        product.aliqIcms ?? null,
        product.cstPis ?? null,
        product.aliqPis ?? null,
        product.cstCofins ?? null,
        product.aliqCofins ?? null,
        product.fiscalType ?? null,
        product.purchaseUnit ?? null,
        product.saleUnit ?? null,
        product.unitsPerPurchase ?? 1,
        product.purchaseCostValue ?? 0,
        product.costValue ?? 0,
        product.marginProfit ?? 0,
        product.price,
        product.byWeight,
        product.stock,
        product.version,
        product.createdAt,
        product.updatedAt,
        product.lastSyncedAt ?? null
      ]
    );

    return mapRow(result.rows[0]);
  }

  async delete(id: string) {
    await this.pool.query('DELETE FROM pdv_products WHERE id = $1', [id]);
  }
}

export const createProductStore = async (): Promise<ProductStore> => {
  const store = new PostgresProductStore(createPool());
  await store.initialize();
  return store;
};
