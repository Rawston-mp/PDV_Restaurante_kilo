import type { ProductSyncGateway } from '@/modules/products/application/ports/ProductSyncGateway';
import type { Product } from '@/modules/products/domain/entities/Product';
import { normalizeCategoryName } from '@/modules/products/domain/services/productCategories';
import { readPendingProductDeletionIds } from '@/modules/products/infrastructure/local/productDeletionTombstones';
import { API_BASE_URL } from '@/shared/infrastructure/api/runtimeEndpoint';

type ApiProduct = Omit<Product, 'createdAt' | 'updatedAt' | 'lastSyncedAt'> & {
  createdAt: string;
  updatedAt: string;
  lastSyncedAt?: string;
};

type ProductsResponse = {
  ok: boolean;
  products?: ApiProduct[];
  product?: ApiProduct;
  message?: string;
};

const endpoint = (path: string) => `${API_BASE_URL}${path}`;

type RuntimeResponse = {
  ok?: boolean;
  stores?: {
    products?: string;
  };
};

const assertPostgresProductStore = async () => {
  const response = await fetch(endpoint('/api/v1/runtime'));
  const payload = await response.json() as RuntimeResponse;

  if (!response.ok || payload.stores?.products !== 'postgres') {
    throw new Error(
      'PostgreSQL indisponível. Os produtos continuam salvos localmente e serão enviados após a reconexão.'
    );
  }
};

const readProductsResponse = async (response: Response): Promise<ProductsResponse> => {
  const contentType = response.headers.get('content-type') ?? '';
  if (!contentType.toLowerCase().includes('application/json')) {
    const preview = (await response.text()).slice(0, 80).replace(/\s+/g, ' ').trim();
    throw new Error(
      `Endpoint de produtos retornou resposta inválida (${response.url || 'URL desconhecida'}): ${preview || 'sem conteúdo'}`
    );
  }

  return response.json() as Promise<ProductsResponse>;
};

const toProduct = (product: ApiProduct): Product => ({
  ...product,
  category: normalizeCategoryName(product.category),
  createdAt: new Date(product.createdAt),
  updatedAt: new Date(product.updatedAt),
  lastSyncedAt: product.lastSyncedAt ? new Date(product.lastSyncedAt) : undefined
});

export class ApiProductSyncGateway implements ProductSyncGateway {
  async pullProducts(): Promise<Product[]> {
    await assertPostgresProductStore();
    const response = await fetch(endpoint('/api/v1/products'));
    const payload = await readProductsResponse(response);

    if (!response.ok) {
      throw new Error(payload.message ?? 'Falha ao buscar produtos no backend.');
    }

    const pendingDeletedIds = new Set(readPendingProductDeletionIds());

    return (payload.products ?? [])
      .map(toProduct)
      .filter((product) => !pendingDeletedIds.has(product.id));
  }

  async pushProducts(products: Product[]): Promise<void> {
    await assertPostgresProductStore();
    const pendingDeletedIds = new Set(readPendingProductDeletionIds());

    for (const product of products) {
      if (pendingDeletedIds.has(product.id)) {
        continue;
      }

      const response = await fetch(endpoint(`/api/v1/products/${encodeURIComponent(product.id)}`), {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ product })
      });
      const payload = await readProductsResponse(response);

      if (!response.ok) {
        throw new Error(payload.message ?? `Falha ao enviar produto ${product.name} ao backend.`);
      }
    }
  }
}
