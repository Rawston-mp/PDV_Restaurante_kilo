export type CashMovementCategoryType = 'ENTRADA' | 'SAIDA';

export type CashMovementCategoryCatalog = Record<CashMovementCategoryType, string[]>;

export const cashMovementCategoriesStorageKey = 'pdv.cashMovements.categories';
export const cashMovementCategoriesUpdatedEvent = 'pdv.cashMovements.categories.updated';

export const defaultCashMovementCategories: CashMovementCategoryCatalog = {
  ENTRADA: ['PIX', 'DINHEIRO', 'TRANSFERENCIA', 'FIADO', 'CARTAO', 'OUTRO'],
  SAIDA: ['TROCO', 'INSUMOS', 'FORNECEDOR', 'BANCO', 'MANUTENCAO', 'OUTROS']
};

const normalizeCategoryName = (value: string) => value.trim().replace(/\s+/g, ' ').toUpperCase();

const sanitizeCategories = (categories: unknown, fallback: string[]) => {
  if (!Array.isArray(categories)) {
    return [...fallback];
  }

  const normalized = categories
    .filter((category): category is string => typeof category === 'string')
    .map(normalizeCategoryName)
    .filter(Boolean);

  const unique = [...new Set(normalized)];
  return unique.length ? unique : [...fallback];
};

const sanitizeCatalog = (catalog: unknown): CashMovementCategoryCatalog => {
  if (!catalog || typeof catalog !== 'object') {
    return {
      ENTRADA: [...defaultCashMovementCategories.ENTRADA],
      SAIDA: [...defaultCashMovementCategories.SAIDA]
    };
  }

  const rawCatalog = catalog as Partial<Record<CashMovementCategoryType, unknown>>;

  return {
    ENTRADA: sanitizeCategories(rawCatalog.ENTRADA, defaultCashMovementCategories.ENTRADA),
    SAIDA: sanitizeCategories(rawCatalog.SAIDA, defaultCashMovementCategories.SAIDA)
  };
};

const dispatchCategoriesUpdated = () => {
  if (typeof window === 'undefined') {
    return;
  }

  window.dispatchEvent(new Event(cashMovementCategoriesUpdatedEvent));
};

export const readCashMovementCategoryCatalog = (): CashMovementCategoryCatalog => {
  if (typeof localStorage === 'undefined') {
    return sanitizeCatalog(null);
  }

  try {
    return sanitizeCatalog(JSON.parse(localStorage.getItem(cashMovementCategoriesStorageKey) ?? 'null'));
  } catch {
    localStorage.removeItem(cashMovementCategoriesStorageKey);
    return sanitizeCatalog(null);
  }
};

export const saveCashMovementCategoryCatalog = (catalog: CashMovementCategoryCatalog) => {
  const nextCatalog = sanitizeCatalog(catalog);

  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(cashMovementCategoriesStorageKey, JSON.stringify(nextCatalog));
  }

  dispatchCategoriesUpdated();
  return nextCatalog;
};

export const addCashMovementCategory = (
  catalog: CashMovementCategoryCatalog,
  type: CashMovementCategoryType,
  name: string
) => {
  const normalizedName = normalizeCategoryName(name);

  if (!normalizedName) {
    return { catalog, error: 'Informe o nome da categoria.' };
  }

  if (catalog[type].includes(normalizedName)) {
    return { catalog, error: 'Categoria já cadastrada.' };
  }

  return {
    catalog: saveCashMovementCategoryCatalog({
      ...catalog,
      [type]: [...catalog[type], normalizedName]
    }),
    error: null
  };
};

export const updateCashMovementCategory = (
  catalog: CashMovementCategoryCatalog,
  type: CashMovementCategoryType,
  currentName: string,
  nextName: string
) => {
  const normalizedCurrentName = normalizeCategoryName(currentName);
  const normalizedNextName = normalizeCategoryName(nextName);

  if (!normalizedNextName) {
    return { catalog, error: 'Informe o novo nome da categoria.' };
  }

  if (normalizedCurrentName !== normalizedNextName && catalog[type].includes(normalizedNextName)) {
    return { catalog, error: 'Categoria já cadastrada.' };
  }

  return {
    catalog: saveCashMovementCategoryCatalog({
      ...catalog,
      [type]: catalog[type].map((category) =>
        category === normalizedCurrentName ? normalizedNextName : category
      )
    }),
    error: null
  };
};

export const deleteCashMovementCategory = (
  catalog: CashMovementCategoryCatalog,
  type: CashMovementCategoryType,
  name: string
) => {
  if (catalog[type].length <= 1) {
    return { catalog, error: 'Mantenha pelo menos uma categoria cadastrada.' };
  }

  const normalizedName = normalizeCategoryName(name);
  const nextCategories = catalog[type].filter((category) => category !== normalizedName);

  return {
    catalog: saveCashMovementCategoryCatalog({
      ...catalog,
      [type]: nextCategories
    }),
    error: null
  };
};
