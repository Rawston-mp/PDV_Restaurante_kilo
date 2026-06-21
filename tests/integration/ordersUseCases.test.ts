import { describe, expect, it } from 'vitest';

import { CreateOrder } from '@/modules/orders/application/use-cases/CreateOrder';
import { AddItemToOrder } from '@/modules/orders/application/use-cases/AddItemToOrder';
import { InMemoryOrderRepository } from '@/modules/orders/infrastructure/repositories/InMemoryOrderRepository';

describe('Orders use cases integration', () => {
  it('cria um pedido e adiciona item por peso', async () => {
    const repository = new InMemoryOrderRepository();
    const createOrder = new CreateOrder(repository);
    const addItemToOrder = new AddItemToOrder(repository);

    const created = await createOrder.execute({
      id: 'ord-1',
      table: '12',
      createdBy: 'u-1'
    });

    const updated = await addItemToOrder.execute({
      orderId: created.id,
      item: {
        id: 'it-1',
        productId: 'prod-1',
        productName: 'Buffet Kilo',
        quantity: 1,
        unitPrice: 72,
        byWeight: true,
        weight: 0.32
      }
    });

    expect(updated.items).toHaveLength(1);
    expect(updated.total).toBe(23.04);

    const persisted = await repository.findById('ord-1');
    expect(persisted?.total).toBe(23.04);
  });

  it('falha ao adicionar item em pedido inexistente', async () => {
    const repository = new InMemoryOrderRepository();
    const addItemToOrder = new AddItemToOrder(repository);

    await expect(
      addItemToOrder.execute({
        orderId: 'missing',
        item: {
          id: 'it-2',
          productId: 'prod-2',
          productName: 'Agua',
          quantity: 1,
          unitPrice: 4,
          byWeight: false
        }
      })
    ).rejects.toThrow('Pedido não encontrado');
  });
});
