import type { Product } from '@/modules/products/domain/entities/Product';

const pendingProductUpsertsStorageKey = 'pdv.products.pendingUpsertIds';
const reconciliationBackupStorageKey = 'pdv.products.reconciliationBackup.v1';

const canUseLocalStorage = () =>
  typeof window !== 'undefined' &&
  Boolean(window.localStorage) &&
  typeof window.localStorage.getItem === 'function';

const normalizeIds = (value: unknown) => {
  if (!Array.isArray(value)) {
    return [];
  }

  return [...new Set(value.map((item) => String(item ?? '').trim()).filter(Boolean))];
};

export const readPendingProductUpsertIds = () => {
  if (!canUseLocalStorage()) {
    return [];
  }

  try {
    return normalizeIds(JSON.parse(window.localStorage.getItem(pendingProductUpsertsStorageKey) ?? '[]'));
  } catch {
    window.localStorage.removeItem(pendingProductUpsertsStorageKey);
    return [];
  }
};

const writePendingProductUpsertIds = (ids: string[]) => {
  if (!canUseLocalStorage()) {
    return;
  }

  const normalized = normalizeIds(ids);
  if (normalized.length === 0) {
    window.localStorage.removeItem(pendingProductUpsertsStorageKey);
    return;
  }

  window.localStorage.setItem(pendingProductUpsertsStorageKey, JSON.stringify(normalized));
};

export const markProductUpsertPending = (id: string) => {
  writePendingProductUpsertIds([...readPendingProductUpsertIds(), id]);
};

export const clearPendingProductUpsert = (id: string) => {
  writePendingProductUpsertIds(readPendingProductUpsertIds().filter((candidate) => candidate !== id));
};

export const backupReconciledProducts = (products: Product[]) => {
  if (!canUseLocalStorage() || products.length === 0) {
    return;
  }

  try {
    window.localStorage.setItem(reconciliationBackupStorageKey, JSON.stringify({
      createdAt: new Date().toISOString(),
      products
    }));
  } catch {
    // A reconciliação não deve falhar se o armazenamento de backup estiver cheio.
  }
};
