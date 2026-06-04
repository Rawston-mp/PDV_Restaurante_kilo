import { describe, expect, it } from 'vitest';

import { CreateOrder } from '@/modules/orders/application/use-cases/CreateOrder';
import { AdvanceOrderStatus } from '@/modules/orders/application/use-cases/AdvanceOrderStatus';
import { InMemoryOrderRepository } from '@/modules/orders/infrastructure/repositories/InMemoryOrderRepository';

describe('AdvanceOrderStatus use case integration', () => {
  it('avanca status do pedido', async () => {
    const repository = new InMemoryOrderRepository();
    const createOrder = new CreateOrder(repository);
    const advanceOrderStatus = new AdvanceOrderStatus(repository);

    const order = await createOrder.execute({
      id: 'ord-status-1',
      table: '08',
      createdBy: 'u-1'
    });

    const updated = await advanceOrderStatus.execute({ orderId: order.id });
    expect(updated.status).toBe('EM_PREPARO');
  });

  it('falha quando pedido nao existe', async () => {
    const repository = new InMemoryOrderRepository();
    const advanceOrderStatus = new AdvanceOrderStatus(repository);

    await expect(advanceOrderStatus.execute({ orderId: 'missing' })).rejects.toThrow(
      'Pedido nao encontrado'
    );
  });
});
