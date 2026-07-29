import type { Product } from '@/modules/products/domain/entities/Product';
import type { ProductRepository } from '@/modules/products/domain/ports/ProductRepository';
import {
  clearPendingProductDeletion,
  isProductDeletionPending,
  markProductDeletionPending,
  readPendingProductDeletionIds
} from '@/modules/products/infrastructure/local/productDeletionTombstones';
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
  createdAt: new Date(product.createdAt),
  updatedAt: new Date(product.updatedAt),
  lastSyncedAt: product.lastSyncedAt ? new Date(product.lastSyncedAt) : undefined
});

const isNewer = (left: Product, right: Product) =>
  new Date(left.updatedAt).getTime() > new Date(right.updatedAt).getTime();

const wasSyncedBefore = (product: Product) => Boolean(product.lastSyncedAt);

export class ApiBackedProductRepository implements ProductRepository {
  constructor(private readonly localRepository: ProductRepository) {}

  async findById(id: string): Promise<Product | null> {
    try {
      const response = await fetch(endpoint(`/api/v1/products/${encodeURIComponent(id)}`));
      if (!response.ok) {
        throw new Error('Produto não encontrado no backend.');
      }

      const payload = await readProductsResponse(response);
      if (!payload.product) {
        return null;
      }

      const product = toProduct(payload.product);
      await this.localRepository.save(product);
      return product;
    } catch {
      return this.localRepository.findById(id);
    }
  }

  async list(): Promise<Product[]> {
    const localProducts = await this.localRepository.list();

    try {
      await this.flushPendingDeletions();
      const pendingDeletedIds = new Set(readPendingProductDeletionIds());
      const response = await fetch(endpoint('/api/v1/products'));
      if (!response.ok) {
        throw new Error('Backend de produtos indisponível.');
      }

      const payload = await readProductsResponse(response);
      const remoteProducts = (payload.products ?? [])
        .map(toProduct)
        .filter((product) => !pendingDeletedIds.has(product.id));
      const activeLocalProducts = localProducts.filter((product) => !pendingDeletedIds.has(product.id));
      const remoteIds = new Set(remoteProducts.map((product) => product.id));
      const productsRemovedFromRemote = activeLocalProducts.filter(
        (product) => wasSyncedBefore(product) && !remoteIds.has(product.id)
      );
      await Promise.all(productsRemovedFromRemote.map((product) => this.localRepository.delete(product.id)));
      const merged = this.mergeByFreshness(activeLocalProducts, remoteProducts);

      await Promise.all(merged.map((product) => this.localRepository.save(product)));
      await Promise.all(
        merged
          .filter((product) => {
            const remote = remoteProducts.find((candidate) => candidate.id === product.id);
            return !remote || isNewer(product, remote);
          })
          .map((product) => this.pushProduct(product))
      );

      return this.sortProducts(merged);
    } catch {
      const pendingDeletedIds = new Set(readPendingProductDeletionIds());
      return this.sortProducts(localProducts.filter((product) => !pendingDeletedIds.has(product.id)));
    }
  }

  async save(product: Product): Promise<void> {
    if (isProductDeletionPending(product.id)) {
      clearPendingProductDeletion(product.id);
    }

    const nextProduct: Product = {
      ...product,
      updatedAt: product.updatedAt instanceof Date ? product.updatedAt : new Date(product.updatedAt)
    };

    await this.localRepository.save(nextProduct);

    try {
      const savedProduct = await this.pushProduct(nextProduct);
      await this.localRepository.save(savedProduct);
    } catch {
      // O cache local preserva o produto para a operação continuar sem backend.
    }
  }

  async delete(id: string): Promise<void> {
    await this.localRepository.delete(id);

    try {
      await this.deleteRemoteProduct(id);
      clearPendingProductDeletion(id);
    } catch {
      markProductDeletionPending(id);
    }
  }

  private async flushPendingDeletions() {
    const pendingIds = readPendingProductDeletionIds();

    for (const id of pendingIds) {
      try {
        await this.deleteRemoteProduct(id);
        clearPendingProductDeletion(id);
      } catch {
        markProductDeletionPending(id);
      }
    }
  }

  private mergeByFreshness(localProducts: Product[], remoteProducts: Product[]) {
    const productsById = new Map<string, Product>();

    for (const product of remoteProducts) {
      productsById.set(product.id, product);
    }

    for (const product of localProducts) {
      if (wasSyncedBefore(product) && !remoteProducts.some((remoteProduct) => remoteProduct.id === product.id)) {
        continue;
      }

      const current = productsById.get(product.id);
      if (!current || isNewer(product, current)) {
        productsById.set(product.id, product);
      }
    }

    return [...productsById.values()];
  }

  private sortProducts(products: Product[]) {
    return [...products].sort((left, right) => {
      const codeCompare = left.productCode.localeCompare(right.productCode, 'pt-BR', { numeric: true });
      return codeCompare || left.name.localeCompare(right.name, 'pt-BR');
    });
  }

  private async pushProduct(product: Product): Promise<Product> {
    if (isProductDeletionPending(product.id)) {
      throw new Error(`Produto ${product.name} está pendente de exclusão e não pode ser reenviado.`);
    }

    const response = await fetch(endpoint(`/api/v1/products/${encodeURIComponent(product.id)}`), {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ product })
    });

    const payload = await readProductsResponse(response);
    if (!response.ok || !payload.product) {
      throw new Error(payload.message ?? 'Falha ao salvar produto no backend.');
    }

    return toProduct(payload.product);
  }

  private async deleteRemoteProduct(id: string): Promise<void> {
    const response = await fetch(endpoint(`/api/v1/products/${encodeURIComponent(id)}`), {
      method: 'DELETE'
    });
    const payload = await readProductsResponse(response);

    if (!response.ok || !payload.ok) {
      throw new Error(payload.message ?? 'Falha ao excluir produto no backend.');
    }
  }
}
