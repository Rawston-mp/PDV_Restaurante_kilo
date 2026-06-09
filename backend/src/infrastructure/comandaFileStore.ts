import { promises as fs } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

import type { ComandaStateSnapshot, ComandaStatus } from '../domain/comandaStateMachine';

export type ComandaAuditEvent = {
  action: 'OPEN_COMANDA' | 'TRANSITION';
  numero: string;
  fromStatus?: ComandaStatus;
  toStatus: ComandaStatus;
  at: string;
  reason?: string;
};

const currentDir = dirname(fileURLToPath(import.meta.url));
const defaultDataDir = join(currentDir, '..', '..', 'data');

export class ComandaFileStore {
  private readonly stateFilePath: string;
  private readonly auditFilePath: string;

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

  async saveState(snapshot: ComandaStateSnapshot) {
    await fs.mkdir(dirname(this.stateFilePath), { recursive: true });
    const tempPath = `${this.stateFilePath}.tmp`;

    await fs.writeFile(tempPath, JSON.stringify(snapshot, null, 2), 'utf-8');
    await fs.rename(tempPath, this.stateFilePath);
  }

  async appendAudit(event: ComandaAuditEvent) {
    await fs.mkdir(dirname(this.auditFilePath), { recursive: true });
    await fs.appendFile(this.auditFilePath, `${JSON.stringify(event)}\n`, 'utf-8');
  }
}
