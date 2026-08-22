import type { Product } from '@/modules/products/domain/entities/Product';
import {
  defaultProductCategories,
  mergeCategoryOptions,
  productCategoriesStorageKey,
  sanitizeCategoryOptions
} from '@/modules/products/domain/services/productCategories';
import { API_BASE_URL } from '@/shared/infrastructure/api/runtimeEndpoint';

type CatalogCategoryRecord = {
  id: string;
  name: string;
  active?: boolean;
  data?: {
    order?: number;
  };
};

type CatalogCategoryResponse = {
  ok?: boolean;
  records?: CatalogCategoryRecord[];
  message?: string;
};

const endpoint = (path: string) => `${API_BASE_URL}${path}`;

const categoryIdFromName = (name: string) =>
  `category-${name
    .normalize('NFD')
    .replace(/[^\x00-\x7F]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')}`;

const readCatalogResponse = async (response: Response): Promise<CatalogCategoryResponse> => {
  const contentType = response.headers.get('content-type') ?? '';
  if (!contentType.toLowerCase().includes('application/json')) {
    throw new Error('Catálogo de categorias retornou resposta inválida.');
  }

  return response.json() as Promise<CatalogCategoryResponse>;
};

export const fetchProductCategoriesCatalog = async () => {
  const response = await fetch(endpoint('/api/v1/catalog/categories'));
  const payload = await readCatalogResponse(response);
  if (!response.ok || payload.ok === false) {
    throw new Error(payload.message ?? 'Falha ao buscar categorias.');
  }

  return sanitizeCategoryOptions(
    (payload.records ?? [])
      .filter((record) => record.active !== false)
      .sort((a, b) => (a.data?.order ?? 999) - (b.data?.order ?? 999) || a.name.localeCompare(b.name, 'pt-BR'))
      .map((record) => record.name)
  );
};

export const saveProductCategoriesCatalog = async (categories: string[]) => {
  const nextCategories = sanitizeCategoryOptions(categories);
  const existingRecords = await fetch(endpoint('/api/v1/catalog/categories'))
    .then(readCatalogResponse)
    .then((payload) => payload.records ?? [])
    .catch(() => [] as CatalogCategoryRecord[]);

  const desiredIds = new Set(nextCategories.map(categoryIdFromName));

  await Promise.all(
    nextCategories.map((name, index) => {
      const id = categoryIdFromName(name);
      return fetch(endpoint(`/api/v1/catalog/categories/${encodeURIComponent(id)}`), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          record: {
            id,
            code: String(index + 1).padStart(2, '0'),
            name,
            active: true,
            data: { source: 'products-category-catalog', order: index }
          }
        })
      });
    })
  );

  await Promise.all(
    existingRecords
      .filter((record) => !desiredIds.has(record.id))
      .map((record) =>
        fetch(endpoint(`/api/v1/catalog/categories/${encodeURIComponent(record.id)}`), {
          method: 'DELETE'
        })
      )
  );
};

export const loadSharedProductCategories = async (products: Product[] = []) => {
  try {
    const remoteCategories = await fetchProductCategoriesCatalog();
    return mergeCategoryOptions(
      remoteCategories.length > 0 ? remoteCategories : defaultProductCategories,
      products
    );
  } catch {
    // Sem backend, categorias canônicas + categorias dos produtos evitam que
    // perfis antigos do navegador/Electron produzam catálogos divergentes.
  }

  return mergeCategoryOptions(defaultProductCategories, products);
};

export const cacheSharedProductCategories = (categories: string[]) => {
  if (typeof window === 'undefined' || !window.localStorage) {
    return;
  }

  window.localStorage.setItem(productCategoriesStorageKey, JSON.stringify(sanitizeCategoryOptions(categories)));
};
