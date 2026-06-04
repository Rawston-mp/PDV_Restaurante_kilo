import { describe, expect, it } from 'vitest';

import { CreateProduct } from '@/modules/products/application/use-cases/CreateProduct';
import { SyncProducts } from '@/modules/products/application/use-cases/SyncProducts';
import { InMemoryProductRepository } from '@/modules/products/infrastructure/repositories/InMemoryProductRepository';
import { InMemoryProductSyncGateway } from '@/modules/products/infrastructure/sync/InMemoryProductSyncGateway';

describe('SyncProducts use case integration', () => {
  it('resolve conflito por versao e aplica merge', async () => {
    const repository = new InMemoryProductRepository();
    const createProduct = new CreateProduct(repository);

    await createProduct.execute({
      id: 'prd-sync-1',
      productCode: '02',
      name: 'Feijao',
      category: 'BUFFET',
      costValue: 38,
      marginProfit: 57.63,
      price: 59.9,
      byWeight: true,
      stock: 40
    });

    const remoteGateway = new InMemoryProductSyncGateway([
      {
        id: 'prd-sync-1',
        productCode: '02',
        name: 'Feijao Premium',
        category: 'BUFFET',
        costValue: 40,
        marginProfit: 62.5,
        price: 65,
        byWeight: true,
        stock: 35,
        version: 2,
        createdAt: new Date('2026-06-04T10:00:00Z'),
        updatedAt: new Date('2026-06-04T10:05:00Z')
      }
    ]);

    const syncProducts = new SyncProducts(repository, remoteGateway);
    const result = await syncProducts.execute({ baseDelayMs: 1 });

    expect(result.resolvedConflicts).toBe(1);

    const local = await repository.findById('prd-sync-1');
    expect(local?.name).toBe('Feijao Premium');
    expect(local?.version).toBe(2);
  });
});
