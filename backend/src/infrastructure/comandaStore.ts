import type { Pool } from 'pg';

import type { ComandaStateSnapshot } from '../domain/comandaStateMachine';
import { ComandaFileStore, type ComandaAuditEvent } from './comandaFileStore';
import { createOperationalStore, type OperationalPostgresStore } from './operationalStore';
import { createPostgresPool, parseBoolean } from './postgresConfig';

export type ComandaStore = {
  loadState: () => Promise<ComandaStateSnapshot | null>;
  saveState: (snapshot: ComandaStateSnapshot) => Promise<void>;
  appendAudit: (event: ComandaAuditEvent) => Promise<void>;
};

class ComandaPostgresStore implements ComandaStore {
  constructor(
    private readonly pool: Pool,
    private readonly operationalStore: OperationalPostgresStore
  ) {}

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

    await this.operationalStore.mirrorComandaSnapshot(snapshot);
  }

  async appendAudit(event: ComandaAuditEvent) {
    await this.pool.query(
      `
        INSERT INTO pdv_comanda_audit (action, numero, event, created_at)
        VALUES ($1, $2, $3::jsonb, NOW())
      `,
      [event.action, event.numero, JSON.stringify(event)]
    );

    await this.operationalStore.appendAudit(event);
  }
}

export const createComandaStore = async (): Promise<{ store: ComandaStore; usingPostgres: boolean }> => {
  const postgresEnabled = parseBoolean(process.env.PDV_USE_POSTGRES, true);

  if (!postgresEnabled) {
    return { store: new ComandaFileStore(), usingPostgres: false };
  }

  try {
    const operationalStore = await createOperationalStore();
    const store = new ComandaPostgresStore(createPostgresPool(), operationalStore);
    await store.initialize();
    return { store, usingPostgres: true };
  } catch (e) {
    console.error('Failed to initialize PostgreSQL comanda store, falling back to file store:', e);
    return { store: new ComandaFileStore(), usingPostgres: false };
  }
};
