import { describe, it, expect, beforeEach } from 'vitest';
import { prisma } from '../../../prisma/prisma.config';
import { prismaStore } from '../prismaStore';
import type { ComandaStateSnapshot, ComandaAuditEvent } from '../../domain/comandaStateMachine';

describe('prismaStore', () => {
  const storePromise = prismaStore();

  beforeEach(async () => {
    await prisma.pdv_comanda_audit.deleteMany();
    await prisma.pdv_comanda_state.deleteMany();
  });

  it('returns null when no snapshot exists', async () => {
    const store = await storePromise;
    const state = await store.loadState();
    expect(state).toBeNull();
  });

  it('saves and loads a snapshot correctly', async () => {
    const store = await storePromise;
    const snapshot: ComandaStateSnapshot = {
      version: 1,
      data: { foo: 'bar' },
    };
    await store.saveState(snapshot);
    const loaded = await store.loadState();
    expect(loaded).toEqual(snapshot);
  });

  it('appends an audit event', async () => {
    const store = await storePromise;
    const event: ComandaAuditEvent = {
      action: 'ABRIR',
      numero: '123',
      // outros campos opcionais podem ser ignorados neste teste
    } as any;
    await store.appendAudit(event);
    const rows = await prisma.pdv_comanda_audit.findMany();
    expect(rows).toHaveLength(1);
    expect(rows[0].action).toBe(event.action);
    expect(rows[0].numero).toBe(event.numero);
  });
});
