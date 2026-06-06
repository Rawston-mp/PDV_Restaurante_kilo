import type { Product } from '@/modules/products/domain/entities/Product';
import type { Categoria } from '@/types/comanda';

export const defaultProductCategories = ['Saladas', 'Quentes', 'Sobremesas', 'Bebidas'];
export const productCategoriesStorageKey = 'pdv.products.categories';
const legacyProductCategoriesStorageKey = 'pdv.products.groups';

const categoryPalette = ['#10b981', '#f59e0b', '#a78bfa', '#38bdf8', '#f97316', '#ef4444', '#14b8a6', '#6366f1'];

const knownCategoryVisuals: Record<string, { label: string; icon: string; className: string; color: string }> = {
  Saladas: { label: 'Saladas', icon: '🥗', className: 'is-saladas', color: '#10b981' },
  Quentes: { label: 'Quentes', icon: '🍛', className: 'is-quentes', color: '#f59e0b' },
  Sobremesas: { label: 'Sobremesas', icon: '🍰', className: 'is-sobremesas', color: '#a78bfa' },
  Bebidas: { label: 'Bebidas', icon: '🥤', className: 'is-bebidas', color: '#38bdf8' }
};

export const normalizeCategoryName = (value: string) => value.trim().replace(/\s+/g, ' ');

export const isSameCategoryName = (left: string, right: string) =>
  left.localeCompare(right, 'pt-BR', { sensitivity: 'base' }) === 0;

export const sanitizeCategoryOptions = (categories: string[]) => {
  const normalized = categories.map(normalizeCategoryName).filter(Boolean);
  const unique: string[] = [];

  for (const category of normalized) {
    if (!unique.some((existing) => isSameCategoryName(existing, category))) {
      unique.push(category);
    }
  }

  return unique.length > 0 ? unique : [...defaultProductCategories];
};

export const readStoredProductCategories = () => {
  if (typeof window === 'undefined' || !window.localStorage) {
    return [...defaultProductCategories];
  }

  const raw =
    window.localStorage.getItem(productCategoriesStorageKey) ??
    window.localStorage.getItem(legacyProductCategoriesStorageKey);
  if (!raw) {
    return [...defaultProductCategories];
  }

  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [...defaultProductCategories];
    }

    return sanitizeCategoryOptions(parsed.filter((item): item is string => typeof item === 'string'));
  } catch {
    return [...defaultProductCategories];
  }
};

export const persistProductCategories = (categories: string[]) => {
  if (typeof window === 'undefined' || !window.localStorage) {
    return;
  }

  window.localStorage.setItem(
    productCategoriesStorageKey,
    JSON.stringify(sanitizeCategoryOptions(categories))
  );
  window.localStorage.removeItem(legacyProductCategoriesStorageKey);
};

export const mergeCategoryOptions = (storedCategories: string[], products: Product[]) => {
  const categoriesFromProducts = products.map((product) => product.category);
  return sanitizeCategoryOptions([...storedCategories, ...categoriesFromProducts]);
};

export const getCategoryVisual = (categoryName: string, index = 0) => {
  const known = knownCategoryVisuals[categoryName];
  if (known) {
    return known;
  }

  return {
    label: categoryName,
    icon: '📦',
    className: '',
    color: categoryPalette[index % categoryPalette.length]
  };
};

export const buildComandaCategories = (categoryNames: string[]): Categoria[] =>
  sanitizeCategoryOptions(categoryNames).map((categoryName, index) => {
    const visual = getCategoryVisual(categoryName, index);

    return {
      id: categoryName,
      nome: visual.label,
      cor: visual.color
    };
  });