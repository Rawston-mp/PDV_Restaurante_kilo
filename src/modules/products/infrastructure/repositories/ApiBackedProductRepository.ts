import type { Product } from '@/modules/products/domain/entities/Product';
import type { ProductRepository } from '@/modules/products/domain/ports/ProductRepository';
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
      const response = await fetch(endpoint('/api/v1/products'));
      if (!response.ok) {
        throw new Error('Backend de produtos indisponível.');
      }

      const payload = await readProductsResponse(response);
      const remoteProducts = (payload.products ?? []).map(toProduct);
      const merged = this.mergeByFreshness(localProducts, remoteProducts);

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
      return this.sortProducts(localProducts);
    }
  }

  async save(product: Product): Promise<void> {
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
      await fetch(endpoint(`/api/v1/products/${encodeURIComponent(id)}`), {
        method: 'DELETE'
      });
    } catch {
      // Exclusão remota será reavaliada quando houver sincronização definitiva.
    }
  }

  private mergeByFreshness(localProducts: Product[], remoteProducts: Product[]) {
    const productsById = new Map<string, Product>();

    for (const product of remoteProducts) {
      productsById.set(product.id, product);
    }

    for (const product of localProducts) {
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
}
