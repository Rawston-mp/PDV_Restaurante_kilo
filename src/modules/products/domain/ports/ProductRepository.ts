import type { Product } from '@/modules/products/domain/entities/Product';

export interface ProductRepository {
  findById(id: string): Promise<Product | null>;
  list(): Promise<Product[]>;
  save(product: Product): Promise<void>;
}
