import { promises as fs } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import type { ComandaStateSnapshot } from '../../backend/src/domain/comandaStateMachine';
import { ComandaFileStore } from '../../backend/src/infrastructure/comandaFileStore';

const temporaryDirectories: string[] = [];

const createTemporaryStore = async () => {
  const directory = await fs.mkdtemp(join(tmpdir(), 'pdv-comanda-store-'));
  temporaryDirectories.push(directory);
  return { directory, store: new ComandaFileStore(directory) };
};

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) => fs.rm(directory, { recursive: true, force: true })));
});

describe('ComandaFileStore', () => {
  it('serializa gravações concorrentes de estado e preserva o snapshot mais recente', async () => {
    const { store } = await createTemporaryStore();
    const snapshots = Array.from({ length: 20 }, (_, index): ComandaStateSnapshot => ({
      activeComandaNumero: null,
      comandas: [],
      updatedAt: `2026-06-21T23:59:${String(index).padStart(2, '0')}.000Z`
    }));

    await Promise.all(snapshots.map((snapshot) => store.saveState(snapshot)));

    await expect(store.loadState()).resolves.toEqual(snapshots.at(-1));
  });

  it('mantém todos os eventos quando a auditoria recebe gravações concorrentes', async () => {
    const { directory, store } = await createTemporaryStore();
    const events = Array.from({ length: 20 }, (_, index) => ({
      action: 'OPEN_COMANDA' as const,
      numero: String(index + 1),
      at: new Date(2026, 5, 21, 23, 59, index).toISOString()
    }));

    await Promise.all(events.map((event) => store.appendAudit(event)));

    const content = await fs.readFile(join(directory, 'comandas-audit.jsonl'), 'utf-8');
    const persistedEvents = content.trim().split('\n').map((line) => JSON.parse(line));
    expect(persistedEvents).toEqual(events);
  });
});
