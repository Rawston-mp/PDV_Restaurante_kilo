import type { Product } from '@/modules/products/domain/entities/Product';
import type { ProductRepository } from '@/modules/products/domain/ports/ProductRepository';

export class InMemoryProductRepository implements ProductRepository {
  private readonly products = new Map<string, Product>();

  async findById(id: string): Promise<Product | null> {
    return this.products.get(id) ?? null;
  }

  async list(): Promise<Product[]> {
    return Array.from(this.products.values());
  }

  async save(product: Product): Promise<void> {
    this.products.set(product.id, product);
  }

  async delete(id: string): Promise<void> {
    this.products.delete(id);
  }
}
