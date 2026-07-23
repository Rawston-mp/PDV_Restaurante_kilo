import { Pool } from 'pg';

import type { ComandaStateSnapshot } from '../domain/comandaStateMachine';
import { ComandaFileStore, type ComandaAuditEvent } from './comandaFileStore';

export type ComandaStore = {
  loadState: () => Promise<ComandaStateSnapshot | null>;
  saveState: (snapshot: ComandaStateSnapshot) => Promise<void>;
  appendAudit: (event: ComandaAuditEvent) => Promise<void>;
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
  const connectionString = process.env.DATABASE_URL?.trim();

  return {
    connectionString: connectionString || undefined,
    host: process.env.PGHOST?.trim() || '127.0.0.1',
    port: Number(process.env.PGPORT ?? 5432),
    database: process.env.PGDATABASE?.trim() || 'postgres',
    user: process.env.PGUSER?.trim() || 'postgres',
    password: process.env.PGPASSWORD,
    ssl: parseBoolean(process.env.PGSSL, false)
  };
};

const createPool = () => {
  const config = buildPostgresConfig();

  if (config.connectionString) {
    return new Pool({
      connectionString: config.connectionString,
      ssl: config.ssl ? { rejectUnauthorized: false } : undefined
    });
  }

  return new Pool({
    host: config.host,
    port: config.port,
    database: config.database,
    user: config.user,
    password: config.password,
    ssl: config.ssl ? { rejectUnauthorized: false } : undefined
  });
};

class ComandaPostgresStore implements ComandaStore {
  private readonly pool: Pool;

  constructor(pool: Pool) {
    this.pool = pool;
  }

  async initialize() {
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS pdv_comanda_state (
        id SMALLINT PRIMARY KEY CHECK (id = 1),
        snapshot JSONB NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS pdv_comanda_audit (
        id BIGSERIAL PRIMARY KEY,
        action TEXT NOT NULL,
        numero TEXT NOT NULL,
        event JSONB NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
  }

  async loadState() {
    const result = await this.pool.query<{ snapshot: ComandaStateSnapshot }>(
      'SELECT snapshot FROM pdv_comanda_state WHERE id = 1'
    );

    if (result.rowCount === 0) {
      return null;
    }

    return result.rows[0].snapshot;
  }

  async saveState(snapshot: ComandaStateSnapshot) {
    await this.pool.query(
      `
        INSERT INTO pdv_comanda_state (id, snapshot, updated_at)
        VALUES (1, $1::jsonb, NOW())
        ON CONFLICT (id)
        DO UPDATE SET
          snapshot = EXCLUDED.snapshot,
          updated_at = NOW()
      `,
      [JSON.stringify(snapshot)]
    );
  }

  async appendAudit(event: ComandaAuditEvent) {
    await this.pool.query(
      `
        INSERT INTO pdv_comanda_audit (action, numero, event, created_at)
        VALUES ($1, $2, $3::jsonb, NOW())
      `,
      [event.action, event.numero, JSON.stringify(event)]
    );
  }
}

export const createComandaStore = async (): Promise<{ store: ComandaStore; usingPostgres: boolean }> => {
  const postgresEnabled = parseBoolean(process.env.PDV_USE_POSTGRES, true);

  if (!postgresEnabled) {
    return { store: new ComandaFileStore(), usingPostgres: false };
  }

  // Use Prisma store when PostgreSQL is enabled
  try {
    const { prismaStore } = await import('./prismaStore');
    const store = await prismaStore();
    return { store, usingPostgres: true };
  } catch (e) {
    console.error('Failed to initialize Prisma store, falling back to file store:', e);
    return { store: new ComandaFileStore(), usingPostgres: false };
  }
};
