import { describe, expect, it } from 'vitest';

import { CreateStockEntry } from '@/modules/stockEntries/application/use-cases/CreateStockEntry';
import { InMemoryStockEntryRepository } from '@/modules/stockEntries/infrastructure/repositories/InMemoryStockEntryRepository';
import { InMemoryProductRepository } from '@/modules/products/infrastructure/repositories/InMemoryProductRepository';

describe('Stock entries use cases', () => {
  it('cria entrada de mercadorias e ajusta estoque', async () => {
    const stockEntryRepository = new InMemoryStockEntryRepository();
    const productRepository = new InMemoryProductRepository();
    const createStockEntry = new CreateStockEntry(stockEntryRepository, productRepository);
    const now = new Date();

    await productRepository.save({
      id: 'prod-1',
      productCode: '001',
      name: 'Arroz 5kg',
      category: 'Alimentos',
      price: 25,
      byWeight: false,
      stock: 10,
      version: 1,
      createdAt: now,
      updatedAt: now
    });

    const stockEntry = await createStockEntry.execute({
      id: 'stock-1',
      stockEntryCode: 'ENT-001',
      noteCode: '000001',
      natureOfOperation: 'Compra para revenda',
      productId: 'prod-1',
      productName: 'Arroz 5kg',
      supplierName: 'Fornecedor ABC',
      invoiceNumber: 'NF-123',
      series: '1',
      accessKey: '12345678901234567890123456789012345678901234',
      authorizationProtocol: '123456789012345',
      issueDate: now,
      deliveryDate: now,
      icmsBase: 0,
      icmsValue: 0,
      icmsSubstitutionBase: 0,
      icmsSubstitutionValue: 0,
      productsValue: 370,
      freightValue: 0,
      insuranceValue: 0,
      discountValue: 0,
      additionalExpensesValue: 0,
      ipiValue: 0,
      invoiceTotalValue: 370,
      documentModel: '55',
      paymentCondition: 'À vista',
      stockLocation: 'PADRAO',
      purchaseOrder: 'PED-1',
      freightByAccount: 'Emitente',
      quantity: 20,
      unitCost: 18.5,
      notes: 'Entrada da nota fiscal 123',
      receivedAt: now
    });

    const loadedProduct = await productRepository.findById('prod-1');
    const loadedEntry = await stockEntryRepository.findById(stockEntry.id);

    expect(loadedEntry).not.toBeNull();
    expect(loadedEntry?.totalCost).toBe(370);
    expect(loadedProduct?.stock).toBe(30);
    expect(loadedProduct?.costValue).toBe(18.5);
  });

  it('atualiza e remove entrada', async () => {
    const stockEntryRepository = new InMemoryStockEntryRepository();
    const now = new Date();

    await stockEntryRepository.save({
      id: 'stock-2',
      stockEntryCode: 'ENT-002',
      noteCode: '000002',
      natureOfOperation: 'Compra',
      productId: 'prod-2',
      productName: 'Feijao',
      supplierName: 'Fornecedor XYZ',
      invoiceNumber: 'NF-456',
      series: '1',
      accessKey: '',
      authorizationProtocol: '',
      issueDate: now,
      deliveryDate: now,
      icmsBase: 0,
      icmsValue: 0,
      icmsSubstitutionBase: 0,
      icmsSubstitutionValue: 0,
      productsValue: 108,
      freightValue: 0,
      insuranceValue: 0,
      discountValue: 0,
      additionalExpensesValue: 0,
      ipiValue: 0,
      invoiceTotalValue: 108,
      documentModel: '55',
      paymentCondition: 'À vista',
      stockLocation: 'PADRAO',
      purchaseOrder: '',
      freightByAccount: '',
      quantity: 12,
      unitCost: 9,
      totalCost: 108,
      notes: '',
      receivedAt: now,
      version: 1,
      createdAt: now,
      updatedAt: now
    });

    const existing = await stockEntryRepository.findById('stock-2');
    if (!existing) {
      throw new Error('Entrada esperada nao encontrada.');
    }

    await stockEntryRepository.save({
      ...existing,
      notes: 'Corrigido',
      version: existing.version + 1,
      updatedAt: new Date()
    });

    const updated = await stockEntryRepository.findById('stock-2');
    expect(updated?.notes).toBe('Corrigido');
    expect(updated?.version).toBe(2);

    await stockEntryRepository.delete('stock-2');
    expect(await stockEntryRepository.findById('stock-2')).toBeNull();
  });
});
