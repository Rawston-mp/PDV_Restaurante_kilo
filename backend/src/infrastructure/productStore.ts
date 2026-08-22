import { Pool } from 'pg';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createPostgresPool, parseBoolean } from './postgresConfig';

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
  storageKind: 'POSTGRES' | 'FILE';
  initialize: () => Promise<void>;
  list: () => Promise<ProductRecord[]>;
  findById: (id: string) => Promise<ProductRecord | null>;
  save: (product: ProductRecord) => Promise<ProductRecord>;
  delete: (id: string) => Promise<boolean>;
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
  readonly storageKind = 'POSTGRES' as const;

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
        units_per_purchase NUMERIC(12, 2) NOT NULL DEFAULT 1,
        purchase_cost_value NUMERIC(14, 2) NOT NULL DEFAULT 0,
        cost_value NUMERIC(14, 2) NOT NULL DEFAULT 0,
        margin_profit NUMERIC(10, 2) NOT NULL DEFAULT 0,
        price NUMERIC(14, 2) NOT NULL DEFAULT 0,
        by_weight BOOLEAN NOT NULL DEFAULT FALSE,
        stock NUMERIC(14, 2) NOT NULL DEFAULT 0,
        version INTEGER NOT NULL DEFAULT 1,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        last_synced_at TIMESTAMPTZ
      )
    `);

    await this.pool.query(`
      ALTER TABLE pdv_products
        ALTER COLUMN units_per_purchase TYPE NUMERIC(12, 2) USING ROUND(units_per_purchase, 2),
        ALTER COLUMN purchase_cost_value TYPE NUMERIC(14, 2) USING ROUND(purchase_cost_value, 2),
        ALTER COLUMN cost_value TYPE NUMERIC(14, 2) USING ROUND(cost_value, 2),
        ALTER COLUMN margin_profit TYPE NUMERIC(10, 2) USING ROUND(margin_profit, 2),
        ALTER COLUMN price TYPE NUMERIC(14, 2) USING ROUND(price, 2),
        ALTER COLUMN stock TYPE NUMERIC(14, 2) USING ROUND(stock, 2)
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

    const syncedAt = new Date().toISOString();
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
        product.lastSyncedAt ?? syncedAt
      ]
    );

    return mapRow(result.rows[0]);
  }

  async delete(id: string) {
    const result = await this.pool.query('DELETE FROM pdv_products WHERE id = $1', [id]);
    return (result.rowCount ?? 0) > 0;
  }
}

const resolveLocalProductDataFile = () => {
  const configuredDataDir = process.env.PDV_DATA_DIR?.trim();
  const platformDataDir = process.env.APPDATA?.trim()
    ? path.join(process.env.APPDATA, 'pdv-touch-restaurante', 'data')
    : path.join(os.homedir(), '.pdv-touch-restaurante', 'data');
  return path.join(configuredDataDir || platformDataDir, 'products-state.json');
};

class FileProductStore implements ProductStore {
  readonly storageKind = 'FILE' as const;
  private readonly products = new Map<string, ProductRecord>();

  constructor(private readonly filePath = resolveLocalProductDataFile()) {}

  async initialize() {
    await fs.mkdir(path.dirname(this.filePath), { recursive: true });

    try {
      const raw = JSON.parse(await fs.readFile(this.filePath, 'utf8')) as { products?: unknown[] } | unknown[];
      const records = Array.isArray(raw) ? raw : raw.products;
      for (const entry of records ?? []) {
        const product = normalizeProduct(entry);
        if (product) {
          this.products.set(product.id, product);
        }
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw error;
      }
      await this.persist();
    }
  }

  async list() {
    return [...this.products.values()]
      .sort((left, right) => left.name.localeCompare(right.name, 'pt-BR'));
  }

  async findById(id: string) {
    return this.products.get(id) ?? null;
  }

  async save(input: ProductRecord) {
    const product = normalizeProduct(input);
    if (!product) {
      throw new Error('Produto inválido.');
    }

    const existing = this.products.get(product.id);
    const now = new Date().toISOString();
    const savedProduct: ProductRecord = {
      ...product,
      version: existing ? Math.max(existing.version + 1, product.version) : product.version,
      createdAt: existing?.createdAt ?? product.createdAt,
      updatedAt: product.updatedAt || now,
      lastSyncedAt: now
    };
    this.products.set(savedProduct.id, savedProduct);
    await this.persist();
    return savedProduct;
  }

  async delete(id: string) {
    const deleted = this.products.delete(id);
    if (deleted) {
      await this.persist();
    }
    return deleted;
  }

  async replaceAll(records: ProductRecord[]) {
    this.products.clear();
    for (const record of records) {
      const product = normalizeProduct(record);
      if (product) {
        this.products.set(product.id, product);
      }
    }
    await this.persist();
  }

  async mirror(record: ProductRecord) {
    const product = normalizeProduct(record);
    if (!product) {
      return;
    }
    this.products.set(product.id, product);
    await this.persist();
  }

  private async persist() {
    await fs.writeFile(this.filePath, JSON.stringify({
      version: 1,
      updatedAt: new Date().toISOString(),
      products: [...this.products.values()]
    }, null, 2), 'utf8');
  }
}

class ResilientProductStore implements ProductStore {
  readonly storageKind = 'POSTGRES' as const;

  constructor(
    private readonly primary: PostgresProductStore,
    private readonly fallback: FileProductStore
  ) {}

  async initialize() {
    const [remoteProducts, cachedProducts] = await Promise.all([
      this.primary.list(),
      this.fallback.list()
    ]);
    const remoteById = new Map(remoteProducts.map((product) => [product.id, product]));

    // Alteracoes feitas enquanto o PostgreSQL estava indisponivel ficam no
    // arquivo de contingencia. Na primeira reconexao, envie apenas registros
    // ausentes ou mais recentes antes de atualizar o espelho local.
    for (const cachedProduct of cachedProducts) {
      const remoteProduct = remoteById.get(cachedProduct.id);
      const cachedUpdatedAt = new Date(cachedProduct.updatedAt).getTime();
      const remoteUpdatedAt = remoteProduct ? new Date(remoteProduct.updatedAt).getTime() : 0;

      if (!remoteProduct || cachedUpdatedAt > remoteUpdatedAt) {
        await this.primary.save(cachedProduct);
      }
    }

    await this.fallback.replaceAll(await this.primary.list());
  }

  async list() {
    try {
      const products = await this.primary.list();
      await this.fallback.replaceAll(products);
      return products;
    } catch {
      return this.fallback.list();
    }
  }

  async findById(id: string) {
    try {
      const product = await this.primary.findById(id);
      if (product) {
        await this.fallback.mirror(product);
      }
      return product;
    } catch {
      return this.fallback.findById(id);
    }
  }

  async save(product: ProductRecord) {
    try {
      const savedProduct = await this.primary.save(product);
      await this.fallback.mirror(savedProduct);
      return savedProduct;
    } catch {
      return this.fallback.save(product);
    }
  }

  async delete(id: string) {
    try {
      const deleted = await this.primary.delete(id);
      await this.fallback.delete(id);
      return deleted;
    } catch {
      return this.fallback.delete(id);
    }
  }
}

export const createProductStore = async (): Promise<ProductStore> => {
  const fileStore = new FileProductStore();
  await fileStore.initialize();

  try {
    const postgresStore = new PostgresProductStore(createPostgresPool());
    await postgresStore.initialize();
    const resilientStore = new ResilientProductStore(postgresStore, fileStore);
    await resilientStore.initialize();
    return resilientStore;
  } catch (error) {
    if (parseBoolean(process.env.PDV_REQUIRE_POSTGRES, false)) {
      throw error;
    }

    // eslint-disable-next-line no-console
    console.error(
      `PostgreSQL de produtos indisponivel; usando arquivo local: ${error instanceof Error ? error.message : String(error)}`
    );
    return fileStore;
  }
};
