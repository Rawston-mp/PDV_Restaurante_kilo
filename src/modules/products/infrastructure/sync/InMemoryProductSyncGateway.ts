import type { ProductSyncGateway } from '@/modules/products/application/ports/ProductSyncGateway';
import type { Product } from '@/modules/products/domain/entities/Product';
import { resolveByVersionAndTime } from '@/shared/sync/domain/services/resolveByVersionAndTime';

export class InMemoryProductSyncGateway implements ProductSyncGateway {
  private readonly remoteProducts = new Map<string, Product>();

  constructor(seedProducts: Product[] = []) {
    for (const product of seedProducts) {
      this.remoteProducts.set(product.id, product);
    }
  }

  async pullProducts(): Promise<Product[]> {
    return Array.from(this.remoteProducts.values());
  }

  async pushProducts(products: Product[]): Promise<void> {
    for (const incoming of products) {
      const current = this.remoteProducts.get(incoming.id);

      if (!current) {
        this.remoteProducts.set(incoming.id, incoming);
        continue;
      }

      this.remoteProducts.set(incoming.id, resolveByVersionAndTime(current, incoming));
    }
  }
}
