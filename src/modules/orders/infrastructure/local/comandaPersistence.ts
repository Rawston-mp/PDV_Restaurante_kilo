import { pdvDatabase } from '@/shared/infrastructure/db/PdvDatabase';
import { hasIndexedDb } from '@/shared/infrastructure/runtime/hasIndexedDb';

const COMANDA_KEY = 'pdv:comanda-ativa';
const WEIGHT_HISTORY_KEY = 'pdv:weight-history';

function hasLocalStorage(): boolean {
  return typeof localStorage !== 'undefined';
}

export type WeightHistoryRecord = {
  id: string;
  peso: number;
  origem?: string;
  comandaAtiva: boolean;
  receivedAt: Date;
};

export async function loadComandaAtivaLocal(): Promise<boolean | null> {
  if (hasIndexedDb()) {
    const row = await pdvDatabase.comandaState.get('main');
    return row?.comandaAtiva ?? null;
  }

  if (!hasLocalStorage()) {
    return null;
  }

  const raw = localStorage.getItem(COMANDA_KEY);
  if (raw === null) {
    return null;
  }

  return raw === 'true';
}

export async function saveComandaAtivaLocal(comandaAtiva: boolean): Promise<void> {
  if (hasIndexedDb()) {
    await pdvDatabase.comandaState.put({
      id: 'main',
      comandaAtiva,
      updatedAt: new Date()
    });
    return;
  }

  if (!hasLocalStorage()) {
    return;
  }

  localStorage.setItem(COMANDA_KEY, String(comandaAtiva));
}

export async function saveWeightHistoryLocal(record: WeightHistoryRecord): Promise<void> {
  if (hasIndexedDb()) {
    await pdvDatabase.weightHistory.put(record);
    return;
  }

  if (!hasLocalStorage()) {
    return;
  }

  const history = readWeightHistoryFromLocalStorage();
  const next = [record, ...history].slice(0, 200);
  localStorage.setItem(WEIGHT_HISTORY_KEY, JSON.stringify(next));
}

export async function loadRecentWeightHistory(limit = 10): Promise<WeightHistoryRecord[]> {
  if (hasIndexedDb()) {
    return pdvDatabase.weightHistory.orderBy('receivedAt').reverse().limit(limit).toArray();
  }

  if (!hasLocalStorage()) {
    return [];
  }

  return readWeightHistoryFromLocalStorage().slice(0, limit);
}

function readWeightHistoryFromLocalStorage(): WeightHistoryRecord[] {
  const raw = localStorage.getItem(WEIGHT_HISTORY_KEY);
  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw) as Array<WeightHistoryRecord & { receivedAt: string }>;
    return parsed.map((item) => ({
      ...item,
      receivedAt: new Date(item.receivedAt)
    }));
  } catch {
    return [];
  }
}
