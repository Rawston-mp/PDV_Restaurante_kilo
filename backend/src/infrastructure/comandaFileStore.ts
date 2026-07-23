import { promises as fs } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

import type {
  ComandaLockStationId,
  ComandaStateSnapshot,
  ComandaStatus
} from '../domain/comandaStateMachine';

export type ComandaAuditEvent = {
  action: 'OPEN_COMANDA' | 'TRANSITION' | 'LOCK_ACQUIRED' | 'LOCK_RENEWED' | 'LOCK_RELEASED' | 'LOCK_EXPIRED' | 'ITEMS_SYNCED' | 'ITEM_ADDED' | 'PESAGEM_RECORDED';
  numero: string;
  fromStatus?: ComandaStatus;
  toStatus?: ComandaStatus;
  at: string;
  reason?: string;
  lockOwner?: string;
  lockStationId?: ComandaLockStationId;
  lockExpiresAt?: string;
  itemId?: string;
  itemCount?: number;
  peso?: number;
  origem?: string;
};

const currentDir = dirname(fileURLToPath(import.meta.url));
const defaultDataDir = join(currentDir, '..', '..', 'data');

export class ComandaFileStore {
  private readonly stateFilePath: string;
  private readonly auditFilePath: string;
  private stateWriteQueue: Promise<void> = Promise.resolve();
  private auditWriteQueue: Promise<void> = Promise.resolve();

  constructor(dataDir = defaultDataDir) {
    this.stateFilePath = join(dataDir, 'comandas-state.json');
    this.auditFilePath = join(dataDir, 'comandas-audit.jsonl');
  }

  async loadState(): Promise<ComandaStateSnapshot | null> {
    try {
      const raw = await fs.readFile(this.stateFilePath, 'utf-8');
      const parsed = JSON.parse(raw) as ComandaStateSnapshot;

      if (!parsed || !Array.isArray(parsed.comandas)) {
        return null;
      }

      return parsed;
    } catch (error) {
      const nodeError = error as NodeJS.ErrnoException;
      if (nodeError?.code === 'ENOENT') {
        return null;
      }

      throw error;
    }
  }

  saveState(snapshot: ComandaStateSnapshot) {
    const serializedSnapshot = JSON.stringify(snapshot, null, 2);
    this.stateWriteQueue = this.stateWriteQueue
      .catch(() => undefined)
      .then(async () => {
        await fs.mkdir(dirname(this.stateFilePath), { recursive: true });
        const tempPath = `${this.stateFilePath}.tmp`;

        await fs.writeFile(tempPath, serializedSnapshot, 'utf-8');
        await fs.rename(tempPath, this.stateFilePath);
      });

    return this.stateWriteQueue;
  }

  appendAudit(event: ComandaAuditEvent) {
    const serializedEvent = `${JSON.stringify(event)}\n`;
    this.auditWriteQueue = this.auditWriteQueue
      .catch(() => undefined)
      .then(async () => {
        await fs.mkdir(dirname(this.auditFilePath), { recursive: true });
        await fs.appendFile(this.auditFilePath, serializedEvent, 'utf-8');
      });

    return this.auditWriteQueue;
  }
}
