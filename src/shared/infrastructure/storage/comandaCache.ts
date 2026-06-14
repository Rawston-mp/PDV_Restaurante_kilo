import type { ItemComanda } from '@/types/comanda';

export const COMANDA_ITEMS_STORAGE_KEY = 'pdv.comandas.itens.v1';

type PersistedComandaSnapshot = {
  itens: ItemComanda[];
  updatedAt: string;
};

type ComandaCacheMap = Record<string, PersistedComandaSnapshot>;

const hasStorage = () => typeof window !== 'undefined' && Boolean(window.localStorage);

const isValidNumero = (numero: string) => /^\d{1,12}$/.test(numero.trim());

const sanitizeCache = (raw: unknown): ComandaCacheMap => {
  if (typeof raw !== 'object' || raw === null) {
    return {};
  }

  const entries = Object.entries(raw as Record<string, unknown>);
  const sanitized: ComandaCacheMap = {};

  for (const [numero, snapshot] of entries) {
    if (!isValidNumero(numero)) {
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

    sanitized[numero] = {
      itens: itens as ItemComanda[],
      updatedAt: typeof updatedAt === 'string' ? updatedAt : new Date().toISOString()
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

export const readComandaItems = (numero: string): ItemComanda[] => {
  if (!isValidNumero(numero)) {
    return [];
  }

  return readComandaCache()[numero]?.itens ?? [];
};

export const listOpenComandaNumbers = (): string[] => Object.keys(readComandaCache());

export const upsertComandaItems = (numero: string, itens: ItemComanda[]) => {
  if (!isValidNumero(numero)) {
    return;
  }

  const current = readComandaCache();

  if (itens.length === 0) {
    delete current[numero];
    writeComandaCache(current);
    return;
  }

  current[numero] = {
    itens,
    updatedAt: new Date().toISOString()
  };

  writeComandaCache(current);
};

export const removeComandaCacheEntry = (numero: string) => {
  if (!isValidNumero(numero)) {
    return;
  }

  const current = readComandaCache();
  if (!current[numero]) {
    return;
  }

  delete current[numero];
  writeComandaCache(current);
};

export const clearComandaCache = () => {
  if (!hasStorage()) {
    return;
  }

  window.localStorage.removeItem(COMANDA_ITEMS_STORAGE_KEY);
};
