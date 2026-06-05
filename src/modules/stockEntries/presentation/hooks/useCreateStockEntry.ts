import { useState } from 'react';

import { stockEntriesContainer } from '@/modules/stockEntries/infrastructure/container/stockEntriesContainer';

type Input = {
  stockEntryCode: string;
  noteCode: string;
  natureOfOperation: string;
  productId: string;
  productName: string;
  supplierName: string;
  invoiceNumber: string;
  series: string;
  accessKey: string;
  authorizationProtocol: string;
  issueDate: Date;
  deliveryDate: Date | null;
  icmsBase: number;
  icmsValue: number;
  icmsSubstitutionBase: number;
  icmsSubstitutionValue: number;
  productsValue: number;
  freightValue: number;
  insuranceValue: number;
  discountValue: number;
  additionalExpensesValue: number;
  ipiValue: number;
  invoiceTotalValue: number;
  documentModel: string;
  paymentCondition: string;
  stockLocation: string;
  purchaseOrder: string;
  freightByAccount: string;
  quantity: number;
  unitCost: number;
  notes: string;
  receivedAt: Date;
};

export function useCreateStockEntry() {
  const [saving, setSaving] = useState(false);

  const createStockEntry = async (input: Input) => {
    setSaving(true);
    try {
      return await stockEntriesContainer.createStockEntry.execute({
        id: `stock-${crypto.randomUUID()}`,
        ...input
      });
    } finally {
      setSaving(false);
    }
  };

  return { createStockEntry, saving };
}
