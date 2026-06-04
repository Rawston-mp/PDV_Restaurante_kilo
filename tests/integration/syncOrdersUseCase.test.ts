import { describe, expect, it } from 'vitest';

import { CreateOrder } from '@/modules/orders/application/use-cases/CreateOrder';
import { SyncOrders } from '@/modules/orders/application/use-cases/SyncOrders';
import { InMemoryOrderRepository } from '@/modules/orders/infrastructure/repositories/InMemoryOrderRepository';
import { InMemoryOrderSyncGateway } from '@/modules/orders/infrastructure/sync/InMemoryOrderSyncGateway';

describe('SyncOrders use case integration', () => {
  it('resolve conflito por versao e replica resultado para local e remoto', async () => {
    const repository = new InMemoryOrderRepository();
    const createOrder = new CreateOrder(repository);

    await createOrder.execute({
      id: 'ord-sync-1',
      table: '01',
      createdBy: 'u-1'
    });

    const remoteGateway = new InMemoryOrderSyncGateway([
      {
        id: 'ord-sync-1',
        table: '99',
        status: 'PENDENTE',
        items: [],
        total: 0,
        version: 2,
        createdAt: new Date('2026-06-04T10:00:00Z'),
        updatedAt: new Date('2026-06-04T10:10:00Z'),
        createdBy: 'u-2'
      }
    ]);

    const syncOrders = new SyncOrders(repository, remoteGateway);

    const result = await syncOrders.execute();
    expect(result.resolvedConflicts).toBe(1);

    const local = await repository.findById('ord-sync-1');
    expect(local?.table).toBe('99');
    expect(local?.version).toBe(2);

    const remote = await remoteGateway.pullOrders();
    expect(remote[0]?.table).toBe('99');
    expect(remote[0]?.version).toBe(2);
  });
});
