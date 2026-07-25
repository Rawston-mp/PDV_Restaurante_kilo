import type { Pool } from 'pg';

import { createPostgresPool, parseBoolean } from './postgresConfig';

export type CatalogEntity =
  | 'clients'
  | 'suppliers'
  | 'convenios'
  | 'employees'
  | 'categories'
  | 'card_administrators';

export type AdminEntity =
  | 'stores'
  | 'store_users'
  | 'store_pins'
  | 'peripheral_settings'
  | 'fiscal_settings'
  | 'sefaz_settings'
  | 'support_settings';

export type CatalogAdminRecord = {
  id: string;
  code?: string;
  name: string;
  active?: boolean;
  version?: number;
  data?: Record<string, unknown>;
  createdAt?: string;
  updatedAt?: string;
};

export type StoreRecord = CatalogAdminRecord & {
  legalName?: string;
  tradeName?: string;
  cnpj?: string;
  stateRegistration?: string;
  commercialStatus?: string;
  allowedRoles?: string[];
};

const catalogTables: Record<CatalogEntity, string> = {
  clients: 'pdv_clients',
  suppliers: 'pdv_suppliers',
  convenios: 'pdv_convenios',
  employees: 'pdv_employees',
  categories: 'pdv_categories',
  card_administrators: 'pdv_card_administrators'
};

const adminTables: Record<AdminEntity, string> = {
  stores: 'pdv_stores',
  store_users: 'pdv_store_users',
  store_pins: 'pdv_store_pins',
  peripheral_settings: 'pdv_peripheral_settings',
  fiscal_settings: 'pdv_fiscal_settings',
  sefaz_settings: 'pdv_sefaz_settings',
  support_settings: 'pdv_support_settings'
};

const catalogEntityList = Object.keys(catalogTables) as CatalogEntity[];
const adminEntityList = Object.keys(adminTables) as AdminEntity[];

const toOptionalText = (value: unknown) => (typeof value === 'string' && value.trim() ? value.trim() : undefined);

const toIsoDate = (value: unknown) => {
  if (typeof value === 'string' && value.trim()) {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toISOString();
    }
  }

  return new Date().toISOString();
};

const toBoolean = (value: unknown, fallback = true) => {
  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'string') {
    return parseBoolean(value, fallback);
  }

  return fallback;
};

const toInteger = (value: unknown, fallback = 1) => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.max(1, Math.trunc(value));
  }

  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? Math.max(1, Math.trunc(parsed)) : fallback;
  }

  return fallback;
};

const toData = (value: unknown) => {
  if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }

  return {};
};

const normalizeRecord = (input: unknown): CatalogAdminRecord | null => {
  if (typeof input !== 'object' || input === null) {
    return null;
  }

  const payload = input as Record<string, unknown>;
  const id = toOptionalText(payload.id);
  const name = toOptionalText(payload.name)
    ?? toOptionalText(payload.fullName)
    ?? toOptionalText(payload.legalName)
    ?? toOptionalText(payload.tradeName);

  if (!id || !name) {
    return null;
  }

  const now = new Date().toISOString();
  return {
    id,
    code: toOptionalText(payload.code)
      ?? toOptionalText(payload.clientCode)
      ?? toOptionalText(payload.supplierCode)
      ?? toOptionalText(payload.convenioCode)
      ?? toOptionalText(payload.employeeCode),
    name,
    active: toBoolean(payload.active, true),
    version: toInteger(payload.version, 1),
    data: toData(payload.data ?? payload),
    createdAt: toIsoDate(payload.createdAt ?? now),
    updatedAt: toIsoDate(payload.updatedAt ?? now)
  };
};

const normalizeStore = (input: unknown): StoreRecord | null => {
  const record = normalizeRecord(input);
  if (!record || typeof input !== 'object' || input === null) {
    return record;
  }

  const payload = input as Record<string, unknown>;
  const allowedRoles = Array.isArray(payload.allowedRoles)
    ? payload.allowedRoles.map(String)
    : [];

  return {
    ...record,
    legalName: toOptionalText(payload.legalName),
    tradeName: toOptionalText(payload.tradeName),
    cnpj: toOptionalText(payload.cnpj),
    stateRegistration: toOptionalText(payload.stateRegistration),
    commercialStatus: toOptionalText(payload.commercialStatus) ?? 'EM_DIA',
    allowedRoles
  };
};

const mapCatalogRow = (row: Record<string, unknown>): CatalogAdminRecord => ({
  id: String(row.id),
  code: row.code ? String(row.code) : undefined,
  name: String(row.name),
  active: Boolean(row.active),
  version: Number(row.version ?? 1),
  data: typeof row.data === 'object' && row.data !== null ? (row.data as Record<string, unknown>) : {},
  createdAt: new Date(String(row.created_at)).toISOString(),
  updatedAt: new Date(String(row.updated_at)).toISOString()
});

const mapStoreRow = (row: Record<string, unknown>): StoreRecord => ({
  ...mapCatalogRow(row),
  legalName: row.legal_name ? String(row.legal_name) : undefined,
  tradeName: row.trade_name ? String(row.trade_name) : undefined,
  cnpj: row.cnpj ? String(row.cnpj) : undefined,
  stateRegistration: row.state_registration ? String(row.state_registration) : undefined,
  commercialStatus: row.commercial_status ? String(row.commercial_status) : undefined,
  allowedRoles: Array.isArray(row.allowed_roles) ? row.allowed_roles.map(String) : []
});

const assertCatalogEntity = (entity: string): CatalogEntity => {
  if (!catalogEntityList.includes(entity as CatalogEntity)) {
    throw new Error('Entidade de cadastro inválida.');
  }

  return entity as CatalogEntity;
};

const assertAdminEntity = (entity: string): AdminEntity => {
  if (!adminEntityList.includes(entity as AdminEntity)) {
    throw new Error('Entidade administrativa inválida.');
  }

  return entity as AdminEntity;
};

export class CatalogAdminPostgresStore {
  constructor(private readonly pool: Pool) {}

  async initialize() {
    for (const tableName of Object.values(catalogTables)) {
      await this.pool.query(`
        CREATE TABLE IF NOT EXISTS ${tableName} (
          id TEXT PRIMARY KEY,
          code TEXT,
          name TEXT NOT NULL,
          active BOOLEAN NOT NULL DEFAULT TRUE,
          version INTEGER NOT NULL DEFAULT 1,
          data JSONB NOT NULL DEFAULT '{}'::jsonb,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `);

      await this.pool.query(`CREATE INDEX IF NOT EXISTS idx_${tableName}_name ON ${tableName} (name)`);
      await this.pool.query(`CREATE INDEX IF NOT EXISTS idx_${tableName}_active ON ${tableName} (active)`);
    }

    await this.pool.query(`
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
      )
    `);

    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS pdv_store_users (
        id TEXT PRIMARY KEY,
        store_id TEXT REFERENCES pdv_stores(id) ON DELETE CASCADE,
        role TEXT NOT NULL,
        name TEXT NOT NULL,
        active BOOLEAN NOT NULL DEFAULT TRUE,
        data JSONB NOT NULL DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    await this.pool.query(`
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
      )
    `);

    await this.pool.query(`
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
      )
    `);

    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS pdv_fiscal_settings (
        id TEXT PRIMARY KEY,
        store_id TEXT REFERENCES pdv_stores(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        active BOOLEAN NOT NULL DEFAULT TRUE,
        data JSONB NOT NULL DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS pdv_sefaz_settings (
        id TEXT PRIMARY KEY,
        store_id TEXT REFERENCES pdv_stores(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        environment TEXT NOT NULL DEFAULT 'HOMOLOGACAO',
        active BOOLEAN NOT NULL DEFAULT TRUE,
        data JSONB NOT NULL DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS pdv_support_settings (
        id TEXT PRIMARY KEY,
        store_id TEXT REFERENCES pdv_stores(id) ON DELETE SET NULL,
        name TEXT NOT NULL,
        active BOOLEAN NOT NULL DEFAULT TRUE,
        data JSONB NOT NULL DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    await this.pool.query('CREATE INDEX IF NOT EXISTS idx_pdv_stores_name ON pdv_stores (name)');
    await this.pool.query('CREATE INDEX IF NOT EXISTS idx_pdv_stores_active ON pdv_stores (active)');
    await this.pool.query('CREATE INDEX IF NOT EXISTS idx_pdv_store_users_store ON pdv_store_users (store_id)');
    await this.pool.query('CREATE INDEX IF NOT EXISTS idx_pdv_store_pins_store ON pdv_store_pins (store_id)');
    await this.pool.query('CREATE INDEX IF NOT EXISTS idx_pdv_peripheral_store ON pdv_peripheral_settings (store_id)');
    await this.pool.query('CREATE INDEX IF NOT EXISTS idx_pdv_fiscal_store ON pdv_fiscal_settings (store_id)');
    await this.pool.query('CREATE INDEX IF NOT EXISTS idx_pdv_sefaz_store ON pdv_sefaz_settings (store_id)');
  }

  async listCatalog(entityName: string) {
    const entity = assertCatalogEntity(entityName);
    const result = await this.pool.query(`SELECT * FROM ${catalogTables[entity]} ORDER BY name ASC`);
    return result.rows.map(mapCatalogRow);
  }

  async findCatalogById(entityName: string, id: string) {
    const entity = assertCatalogEntity(entityName);
    const result = await this.pool.query(`SELECT * FROM ${catalogTables[entity]} WHERE id = $1`, [id]);
    return result.rowCount ? mapCatalogRow(result.rows[0]) : null;
  }

  async saveCatalog(entityName: string, input: unknown) {
    const entity = assertCatalogEntity(entityName);
    const tableName = catalogTables[entity];
    const record = normalizeRecord(input);
    if (!record) {
      throw new Error('Registro de cadastro inválido.');
    }

    const result = await this.pool.query(
      `
        INSERT INTO ${tableName} (id, code, name, active, version, data, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8)
        ON CONFLICT (id)
        DO UPDATE SET
          code = EXCLUDED.code,
          name = EXCLUDED.name,
          active = EXCLUDED.active,
          version = GREATEST(${tableName}.version + 1, EXCLUDED.version),
          data = EXCLUDED.data,
          updated_at = EXCLUDED.updated_at
        RETURNING *
      `,
      [
        record.id,
        record.code ?? null,
        record.name,
        record.active ?? true,
        record.version ?? 1,
        JSON.stringify(record.data ?? {}),
        record.createdAt,
        record.updatedAt
      ]
    );

    return mapCatalogRow(result.rows[0]);
  }

  async deleteCatalog(entityName: string, id: string) {
    const entity = assertCatalogEntity(entityName);
    await this.pool.query(`DELETE FROM ${catalogTables[entity]} WHERE id = $1`, [id]);
  }

  async listAdmin(entityName: string) {
    const entity = assertAdminEntity(entityName);
    if (entity === 'stores') {
      const result = await this.pool.query('SELECT * FROM pdv_stores ORDER BY name ASC');
      return result.rows.map(mapStoreRow);
    }

    const tableName = adminTables[entity];
    const result = await this.pool.query(`SELECT * FROM ${tableName} ORDER BY updated_at DESC`);
    return result.rows;
  }

  async findAdminById(entityName: string, id: string) {
    const entity = assertAdminEntity(entityName);
    if (entity === 'stores') {
      const result = await this.pool.query('SELECT * FROM pdv_stores WHERE id = $1', [id]);
      return result.rowCount ? mapStoreRow(result.rows[0]) : null;
    }

    const result = await this.pool.query(`SELECT * FROM ${adminTables[entity]} WHERE id = $1`, [id]);
    return result.rowCount ? result.rows[0] : null;
  }

  async saveStore(input: unknown) {
    const store = normalizeStore(input);
    if (!store) {
      throw new Error('Loja inválida.');
    }

    const result = await this.pool.query(
      `
        INSERT INTO pdv_stores (
          id, code, name, legal_name, trade_name, cnpj, state_registration,
          commercial_status, allowed_roles, active, version, data, created_at, updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::text[], $10, $11, $12::jsonb, $13, $14)
        ON CONFLICT (id)
        DO UPDATE SET
          code = EXCLUDED.code,
          name = EXCLUDED.name,
          legal_name = EXCLUDED.legal_name,
          trade_name = EXCLUDED.trade_name,
          cnpj = EXCLUDED.cnpj,
          state_registration = EXCLUDED.state_registration,
          commercial_status = EXCLUDED.commercial_status,
          allowed_roles = EXCLUDED.allowed_roles,
          active = EXCLUDED.active,
          version = GREATEST(pdv_stores.version + 1, EXCLUDED.version),
          data = EXCLUDED.data,
          updated_at = EXCLUDED.updated_at
        RETURNING *
      `,
      [
        store.id,
        store.code ?? null,
        store.name,
        store.legalName ?? null,
        store.tradeName ?? null,
        store.cnpj ?? null,
        store.stateRegistration ?? null,
        store.commercialStatus ?? 'EM_DIA',
        store.allowedRoles ?? [],
        store.active ?? true,
        store.version ?? 1,
        JSON.stringify(store.data ?? {}),
        store.createdAt,
        store.updatedAt
      ]
    );

    return mapStoreRow(result.rows[0]);
  }

  async saveAdmin(entityName: string, input: unknown) {
    const entity = assertAdminEntity(entityName);
    if (entity === 'stores') {
      return this.saveStore(input);
    }

    const record = normalizeRecord(input);
    if (!record) {
      throw new Error('Registro administrativo inválido.');
    }

    const payload = record.data ?? {};
    const storeId = toOptionalText(payload.storeId);

    if (entity === 'store_users') {
      const result = await this.pool.query(
        `
          INSERT INTO pdv_store_users (id, store_id, role, name, active, data, created_at, updated_at)
          VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8)
          ON CONFLICT (id)
          DO UPDATE SET
            store_id = EXCLUDED.store_id,
            role = EXCLUDED.role,
            name = EXCLUDED.name,
            active = EXCLUDED.active,
            data = EXCLUDED.data,
            updated_at = EXCLUDED.updated_at
          RETURNING *
        `,
        [
          record.id,
          storeId ?? null,
          toOptionalText(payload.role) ?? 'ADMIN',
          record.name,
          record.active ?? true,
          JSON.stringify(payload),
          record.createdAt,
          record.updatedAt
        ]
      );

      return result.rows[0];
    }

    if (entity === 'store_pins') {
      const role = toOptionalText(payload.role) ?? 'ADMIN';
      const pinKind = toOptionalText(payload.pinKind) === 'SENSITIVE' ? 'SENSITIVE' : 'LOGIN';
      const result = await this.pool.query(
        `
          INSERT INTO pdv_store_pins (id, store_id, role, pin_kind, pin_value, active, data, created_at, updated_at)
          VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8, $9)
          ON CONFLICT (store_id, role, pin_kind)
          DO UPDATE SET
            id = EXCLUDED.id,
            pin_value = EXCLUDED.pin_value,
            active = EXCLUDED.active,
            data = EXCLUDED.data,
            updated_at = EXCLUDED.updated_at
          RETURNING *
        `,
        [
          record.id,
          storeId ?? null,
          role,
          pinKind,
          toOptionalText(payload.pinValue) ?? toOptionalText(payload.pin) ?? '',
          record.active ?? true,
          JSON.stringify(payload),
          record.createdAt,
          record.updatedAt
        ]
      );

      return result.rows[0];
    }

    if (entity === 'peripheral_settings') {
      const result = await this.pool.query(
        `
          INSERT INTO pdv_peripheral_settings (
            id, store_id, computer_name, peripheral_type, name, active, data, created_at, updated_at
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8, $9)
          ON CONFLICT (id)
          DO UPDATE SET
            store_id = EXCLUDED.store_id,
            computer_name = EXCLUDED.computer_name,
            peripheral_type = EXCLUDED.peripheral_type,
            name = EXCLUDED.name,
            active = EXCLUDED.active,
            data = EXCLUDED.data,
            updated_at = EXCLUDED.updated_at
          RETURNING *
        `,
        [
          record.id,
          storeId ?? null,
          toOptionalText(payload.computerName) ?? null,
          toOptionalText(payload.peripheralType) ?? 'UNKNOWN',
          record.name,
          record.active ?? true,
          JSON.stringify(payload),
          record.createdAt,
          record.updatedAt
        ]
      );

      return result.rows[0];
    }

    if (entity === 'fiscal_settings') {
      const result = await this.pool.query(
        `
          INSERT INTO pdv_fiscal_settings (id, store_id, name, active, data, created_at, updated_at)
          VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7)
          ON CONFLICT (id)
          DO UPDATE SET
            store_id = EXCLUDED.store_id,
            name = EXCLUDED.name,
            active = EXCLUDED.active,
            data = EXCLUDED.data,
            updated_at = EXCLUDED.updated_at
          RETURNING *
        `,
        [
          record.id,
          storeId ?? null,
          record.name,
          record.active ?? true,
          JSON.stringify(payload),
          record.createdAt,
          record.updatedAt
        ]
      );

      return result.rows[0];
    }

    if (entity === 'sefaz_settings') {
      const result = await this.pool.query(
        `
          INSERT INTO pdv_sefaz_settings (id, store_id, name, environment, active, data, created_at, updated_at)
          VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8)
          ON CONFLICT (id)
          DO UPDATE SET
            store_id = EXCLUDED.store_id,
            name = EXCLUDED.name,
            environment = EXCLUDED.environment,
            active = EXCLUDED.active,
            data = EXCLUDED.data,
            updated_at = EXCLUDED.updated_at
          RETURNING *
        `,
        [
          record.id,
          storeId ?? null,
          record.name,
          toOptionalText(payload.environment) ?? 'HOMOLOGACAO',
          record.active ?? true,
          JSON.stringify(payload),
          record.createdAt,
          record.updatedAt
        ]
      );

      return result.rows[0];
    }

    const result = await this.pool.query(
      `
        INSERT INTO pdv_support_settings (id, store_id, name, active, data, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7)
        ON CONFLICT (id)
        DO UPDATE SET
          store_id = EXCLUDED.store_id,
          name = EXCLUDED.name,
          active = EXCLUDED.active,
          data = EXCLUDED.data,
          updated_at = EXCLUDED.updated_at
        RETURNING *
      `,
      [
        record.id,
        storeId ?? null,
        record.name,
        record.active ?? true,
        JSON.stringify(payload),
        record.createdAt,
        record.updatedAt
      ]
    );

    return result.rows[0];
  }

  async deleteAdmin(entityName: string, id: string) {
    const entity = assertAdminEntity(entityName);
    await this.pool.query(`DELETE FROM ${adminTables[entity]} WHERE id = $1`, [id]);
  }
}

export const createCatalogAdminStore = async () => {
  const store = new CatalogAdminPostgresStore(createPostgresPool());
  await store.initialize();
  return store;
};
