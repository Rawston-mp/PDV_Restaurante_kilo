import { useState } from 'react';

import { productsContainer } from '@/modules/products/infrastructure/container/productsContainer';

type Input = {
  productCode: string;
  barcode?: string;
  imageUrl?: string;
  name: string;
  description?: string;
  category: string;
  isUnavailable?: boolean;
  isHidden?: boolean;
  ncm: string;
  cfop: string;
  cstIcms: string;
  taxSituationCode: string;
  aliqIcms: string;
  cstPis: string;
  aliqPis: string;
  cstCofins: string;
  aliqCofins: string;
  fiscalType: string;
  purchaseUnit: string;
  saleUnit: string;
  unitsPerPurchase: number;
  purchaseCostValue: number;
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
