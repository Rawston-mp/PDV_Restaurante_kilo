import type { ItemComanda } from '@/types/comanda';
import { isValidComandaNumber, normalizeComandaNumber } from '@/shared/domain/services/comandaNumber';

export const COMANDA_ITEMS_STORAGE_KEY = 'pdv.comandas.itens.v1';
export const COMANDA_CANCELLED_STORAGE_KEY = 'pdv.comandas.canceladas.v1';

type PersistedComandaSnapshot = {
  itens: ItemComanda[];
  updatedAt: string;
};

type ComandaCacheMap = Record<string, PersistedComandaSnapshot>;
type CancelledComandaSnapshot = {
  cancelledAt: string;
  reason: string;
};
type CancelledComandaMap = Record<string, CancelledComandaSnapshot>;

const hasStorage = () => typeof window !== 'undefined' && Boolean(window.localStorage);

const sanitizeCache = (raw: unknown): ComandaCacheMap => {
  if (typeof raw !== 'object' || raw === null) {
    return {};
  }

  const entries = Object.entries(raw as Record<string, unknown>);
  const sanitized: ComandaCacheMap = {};

  for (const [numero, snapshot] of entries) {
    const normalizedNumero = normalizeComandaNumber(numero);
    if (!isValidComandaNumber(normalizedNumero)) {
      continue;
    }

    if (typeof snapshot !== 'object' || snapshot === null) {
      continue;
    }

    const itens = (snapshot as { itens?: unknown }).itens;
    const updatedAt = (snapshot as { updatedAt?: unknown }).updatedAt;

    if (!Array.isArray(itens)) {
      continue;
    }

    const normalizedSnapshot = {
      itens: itens as ItemComanda[],
      updatedAt: typeof updatedAt === 'string' ? updatedAt : new Date().toISOString()
    };
    const current = sanitized[normalizedNumero];
    sanitized[normalizedNumero] = current
      ? {
          itens: [...current.itens, ...normalizedSnapshot.itens],
          updatedAt: Date.parse(normalizedSnapshot.updatedAt) >= Date.parse(current.updatedAt)
            ? normalizedSnapshot.updatedAt
            : current.updatedAt
        }
      : normalizedSnapshot;
  }

  return sanitized;
};

const sanitizeCancelledComandas = (raw: unknown): CancelledComandaMap => {
  if (typeof raw !== 'object' || raw === null) {
    return {};
  }

  const sanitized: CancelledComandaMap = {};
  for (const [numero, snapshot] of Object.entries(raw as Record<string, unknown>)) {
    const normalizedNumero = normalizeComandaNumber(numero);
    if (!isValidComandaNumber(normalizedNumero) || typeof snapshot !== 'object' || snapshot === null) {
      continue;
    }

    const cancelledAt = (snapshot as { cancelledAt?: unknown }).cancelledAt;
    const reason = (snapshot as { reason?: unknown }).reason;
    sanitized[normalizedNumero] = {
      cancelledAt: typeof cancelledAt === 'string' ? cancelledAt : new Date().toISOString(),
      reason: typeof reason === 'string' && reason.trim() ? reason : 'cancelada_no_caixa'
    };
  }

  return sanitized;
};

export const readComandaCache = (): ComandaCacheMap => {
  if (!hasStorage()) {
    return {};
  }

  const raw = window.localStorage.getItem(COMANDA_ITEMS_STORAGE_KEY);
  if (!raw) {
    return {};
  }

  try {
    const parsed = JSON.parse(raw) as unknown;
    const sanitized = sanitizeCache(parsed);

    if (JSON.stringify(parsed) !== JSON.stringify(sanitized)) {
      window.localStorage.setItem(COMANDA_ITEMS_STORAGE_KEY, JSON.stringify(sanitized));
    }

    return sanitized;
  } catch {
    window.localStorage.removeItem(COMANDA_ITEMS_STORAGE_KEY);
    return {};
  }
};

export const writeComandaCache = (cache: ComandaCacheMap) => {
  if (!hasStorage()) {
    return;
  }

  const sanitized = sanitizeCache(cache);
  if (Object.keys(sanitized).length === 0) {
    window.localStorage.removeItem(COMANDA_ITEMS_STORAGE_KEY);
    return;
  }

  window.localStorage.setItem(COMANDA_ITEMS_STORAGE_KEY, JSON.stringify(sanitized));
};

export const readCancelledComandas = (): CancelledComandaMap => {
  if (!hasStorage()) {
    return {};
  }

  const raw = window.localStorage.getItem(COMANDA_CANCELLED_STORAGE_KEY);
  if (!raw) {
    return {};
  }

  try {
    const parsed = JSON.parse(raw) as unknown;
    const sanitized = sanitizeCancelledComandas(parsed);

    if (JSON.stringify(parsed) !== JSON.stringify(sanitized)) {
      window.localStorage.setItem(COMANDA_CANCELLED_STORAGE_KEY, JSON.stringify(sanitized));
    }

    return sanitized;
  } catch {
    window.localStorage.removeItem(COMANDA_CANCELLED_STORAGE_KEY);
    return {};
  }
};

const writeCancelledComandas = (cache: CancelledComandaMap) => {
  if (!hasStorage()) {
    return;
  }

  const sanitized = sanitizeCancelledComandas(cache);
  if (Object.keys(sanitized).length === 0) {
    window.localStorage.removeItem(COMANDA_CANCELLED_STORAGE_KEY);
    return;
  }

  window.localStorage.setItem(COMANDA_CANCELLED_STORAGE_KEY, JSON.stringify(sanitized));
};

export const readComandaItems = (numero: string): ItemComanda[] => {
  const normalizedNumero = normalizeComandaNumber(numero);
  if (!isValidComandaNumber(normalizedNumero)) {
    return [];
  }

  return readComandaCache()[normalizedNumero]?.itens ?? [];
};

export const listLocallyCancelledComandaNumbers = (): string[] => Object.keys(readCancelledComandas());

export const isComandaLocallyCancelled = (numero: string): boolean => {
  const normalizedNumero = normalizeComandaNumber(numero);
  if (!isValidComandaNumber(normalizedNumero)) {
    return false;
  }

  return Boolean(readCancelledComandas()[normalizedNumero]);
};

export const markComandaLocallyCancelled = (numero: string, reason = 'cancelada_no_caixa') => {
  const normalizedNumero = normalizeComandaNumber(numero);
  if (!isValidComandaNumber(normalizedNumero)) {
    return;
  }

  const current = readCancelledComandas();
  current[normalizedNumero] = {
    cancelledAt: new Date().toISOString(),
    reason
  };
  writeCancelledComandas(current);
};

export const unmarkComandaLocallyCancelled = (numero: string) => {
  const normalizedNumero = normalizeComandaNumber(numero);
  if (!isValidComandaNumber(normalizedNumero)) {
    return;
  }

  const current = readCancelledComandas();
  if (!current[normalizedNumero]) {
    return;
  }

  delete current[normalizedNumero];
  writeCancelledComandas(current);
};

export const listOpenComandaNumbers = (): string[] => (
  Object.keys(readComandaCache()).filter((numero) => !isComandaLocallyCancelled(numero))
);

export const upsertComandaItems = (numero: string, itens: ItemComanda[]) => {
  const normalizedNumero = normalizeComandaNumber(numero);
  if (!isValidComandaNumber(normalizedNumero)) {
    return;
  }

  const current = readComandaCache();

  if (itens.length === 0) {
    delete current[normalizedNumero];
    writeComandaCache(current);
    return;
  }

  current[normalizedNumero] = {
    itens,
    updatedAt: new Date().toISOString()
  };

  writeComandaCache(current);
};

export const removeComandaCacheEntry = (numero: string) => {
  const normalizedNumero = normalizeComandaNumber(numero);
  if (!isValidComandaNumber(normalizedNumero)) {
    return;
  }

  const current = readComandaCache();
  if (!current[normalizedNumero]) {
    return;
  }

  delete current[normalizedNumero];
  writeComandaCache(current);
};

export const clearComandaCache = () => {
  if (!hasStorage()) {
    return;
  }

  window.localStorage.removeItem(COMANDA_ITEMS_STORAGE_KEY);
  window.localStorage.removeItem(COMANDA_CANCELLED_STORAGE_KEY);
};
