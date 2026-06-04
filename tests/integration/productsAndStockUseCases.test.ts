import { describe, expect, it } from 'vitest';

import { CreateProduct } from '@/modules/products/application/use-cases/CreateProduct';
import { InMemoryProductRepository } from '@/modules/products/infrastructure/repositories/InMemoryProductRepository';
import { AdjustStock } from '@/modules/stock/application/use-cases/AdjustStock';

describe('Products + Stock use cases integration', () => {
  it('cria produto e ajusta estoque', async () => {
    const repository = new InMemoryProductRepository();
    const createProduct = new CreateProduct(repository);
    const adjustStock = new AdjustStock(repository);

    const product = await createProduct.execute({
      id: 'prd-1',
      productCode: '01',
      name: 'Arroz branco',
      category: 'BUFFET',
      costValue: 45,
      marginProfit: 44.22,
      price: 64.9,
      byWeight: true,
      stock: 50
    });

    const updated = await adjustStock.execute({
      productId: product.id,
      delta: -4
    });

    expect(updated.stock).toBe(46);
  });

  it('falha quando produto nao existe', async () => {
    const repository = new InMemoryProductRepository();
    const adjustStock = new AdjustStock(repository);

    await expect(adjustStock.execute({ productId: 'x', delta: -2 })).rejects.toThrow(
      'Produto nao encontrado'
    );
  });
});
