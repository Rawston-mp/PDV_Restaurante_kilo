const productDeletionTombstonesStorageKey = 'pdv.products.deletedIds';

const canUseLocalStorage = () =>
  typeof window !== 'undefined' &&
  Boolean(window.localStorage) &&
  typeof window.localStorage.getItem === 'function';

const normalizeIds = (value: unknown) => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => String(item ?? '').trim())
    .filter(Boolean);
};

export const readPendingProductDeletionIds = () => {
  if (!canUseLocalStorage()) {
    return [];
  }

  try {
    return normalizeIds(JSON.parse(window.localStorage.getItem(productDeletionTombstonesStorageKey) ?? '[]'));
  } catch {
    window.localStorage.removeItem(productDeletionTombstonesStorageKey);
    return [];
  }
};

const writePendingProductDeletionIds = (ids: string[]) => {
  if (!canUseLocalStorage()) {
    return;
  }

  const uniqueIds = [...new Set(ids.map((id) => id.trim()).filter(Boolean))];

  if (uniqueIds.length === 0) {
    window.localStorage.removeItem(productDeletionTombstonesStorageKey);
    return;
  }

  window.localStorage.setItem(productDeletionTombstonesStorageKey, JSON.stringify(uniqueIds));
};

export const markProductDeletionPending = (id: string) => {
  writePendingProductDeletionIds([...readPendingProductDeletionIds(), id]);
};

export const clearPendingProductDeletion = (id: string) => {
  writePendingProductDeletionIds(readPendingProductDeletionIds().filter((candidate) => candidate !== id));
};

export const isProductDeletionPending = (id: string) =>
  readPendingProductDeletionIds().includes(id);
