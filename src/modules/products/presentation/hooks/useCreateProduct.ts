import { useState } from 'react';

import { productsContainer } from '@/modules/products/infrastructure/container/productsContainer';

type Input = {
  productCode: string;
  name: string;
  category: string;
  costValue: number;
  marginProfit: number;
  price: number;
  byWeight: boolean;
  stock: number;
};

export function useCreateProduct() {
  const [saving, setSaving] = useState(false);

  const createProduct = async (input: Input) => {
    setSaving(true);
    try {
      return await productsContainer.createProduct.execute({
        id: `prd-${crypto.randomUUID()}`,
        ...input
      });
    } finally {
      setSaving(false);
    }
  };

  return { createProduct, saving };
}
