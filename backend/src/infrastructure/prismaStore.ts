import { prisma } from '../../prisma/prisma.config';
import type { ComandaStateSnapshot } from '../domain/comandaStateMachine';
import type { ComandaStore, ComandaAuditEvent } from './comandaStore';

/**
 * Prisma based implementation of `ComandaStore`.
 *
 * Uses the tables defined in `schema.prisma`:
 *   - `pdv_comanda_state`  (single row with id = 1 storing the snapshot JSON)
 *   - `pdv_comanda_audit`  (audit log entries)
 *
 * In development we run against the SQLite file `dev.db`. In production the
 * datasource will point to PostgreSQL via the `DATABASE_URL` environment
 * variable. No separate username/password is required for SQLite; for PostgreSQL
 * the connection string must contain the credentials (e.g.
 * `postgresql://user:password@host:5432/db`).
 */
export const prismaStore = async (): Promise<ComandaStore> => {
  // The Prisma client has already been configured with the correct datasource
  // (SQLite for dev, PostgreSQL for prod) via `prisma.config.ts`.

  return {
    /** Load the latest comanda state snapshot from the database */
    async loadState(): Promise<ComandaStateSnapshot | null> {
      const record = await prisma.pdv_comanda_state.findUnique({
        where: { id: 1 },
        select: { snapshot: true },
      });
      return record ? (record.snapshot as unknown as ComandaStateSnapshot) : null;
    },

    /** Persist a new snapshot, upserting the single row with id = 1 */
    async saveState(snapshot: ComandaStateSnapshot): Promise<void> {
      await prisma.pdv_comanda_state.upsert({
        where: { id: 1 },
        update: { snapshot: snapshot as any, updated_at: new Date() },
        create: { id: 1, snapshot: snapshot as any },
      });
    },

    /** Append an audit event to `pdv_comanda_audit` */
    async appendAudit(event: ComandaAuditEvent): Promise<void> {
      await prisma.pdv_comanda_audit.create({
        data: {
          action: event.action,
          numero: event.numero,
          event: event as any, // JSONB column stores the full event object
        },
      });
    },
  };
};
