import { useEffect, useState } from 'react';

import type { Product } from '@/modules/products/domain/entities/Product';
import { productsContainer } from '@/modules/products/infrastructure/container/productsContainer';

export function useProductsQuery() {
  const [products, setProducts] = useState<Product[]>([]);

  const reload = async () => {
    setProducts(await productsContainer.productRepository.list());
  };

  useEffect(() => {
    void reload();
  }, []);

  return { products, setProducts, reload };
}
