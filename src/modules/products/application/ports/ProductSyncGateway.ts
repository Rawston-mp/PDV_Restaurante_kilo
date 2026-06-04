import type { Product } from '@/modules/products/domain/entities/Product';

export interface ProductSyncGateway {
  pullProducts(): Promise<Product[]>;
  pushProducts(products: Product[]): Promise<void>;
}
