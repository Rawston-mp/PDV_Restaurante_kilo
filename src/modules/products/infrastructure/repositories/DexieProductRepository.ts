import type { Product } from '@/modules/products/domain/entities/Product';
import type { ProductRepository } from '@/modules/products/domain/ports/ProductRepository';
import { pdvDatabase } from '@/shared/infrastructure/db/PdvDatabase';

export class DexieProductRepository implements ProductRepository {
  async findById(id: string): Promise<Product | null> {
    const product = await pdvDatabase.products.get(id);
    return product ?? null;
  }

  async list(): Promise<Product[]> {
    return pdvDatabase.products.toArray();
  }

  async save(product: Product): Promise<void> {
    await pdvDatabase.products.put(product);
  }

  async delete(id: string): Promise<void> {
    await pdvDatabase.products.delete(id);
  }
}
