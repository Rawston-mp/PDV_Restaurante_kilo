import { PrismaClient } from '@prisma/client';
import { prismaStore } from './prismaStore';

describe('PrismaStore integration tests', () => {
  const client = new PrismaClient({
    datasources: { db: { url: 'file:./dev.db' } },
  });

  beforeAll(async () => {
    // Ensure database is clean and migrations are applied
    await client.$executeRawUnsafe('PRAGMA foreign_keys = OFF;');
    await client.$disconnect();
    // Run migrations using the same command as CI
    const { execSync } = require('child_process');
    execSync('npx prisma migrate deploy --schema=prisma/schema.prisma', { stdio: 'inherit' });
  });

  afterAll(async () => {
    await client.$disconnect();
  });

  test('loadState returns null when empty', async () => {
    const store = prismaStore();
    const state = await store.loadState();
    expect(state).toBeNull();
  });

  test('saveState persists a snapshot', async () => {
    const store = prismaStore();
    const snapshot = { foo: 'bar' } as any;
    await store.saveState(snapshot);
    const loaded = await store.loadState();
    expect(loaded).toEqual(snapshot);
  });

  test('appendAudit records an audit entry', async () => {
    const store = prismaStore();
    await store.appendAudit({ action: 'create', numero: '001', event: { detail: 1 } } as any);
    const audit = await client.pdv_comanda_audit.findFirst({
      where: { numero: '001' },
    });
    expect(audit).not.toBeNull();
    expect(audit?.action).toBe('create');
  });
});
