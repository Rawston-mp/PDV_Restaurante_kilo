import { describe, expect, it } from 'vitest';

import type { Product } from '@/modules/products/domain/entities/Product';
import type { ProductSyncGateway } from '@/modules/products/application/ports/ProductSyncGateway';
import { SyncProducts } from '@/modules/products/application/use-cases/SyncProducts';
import { ProcessSyncQueue } from '@/modules/products/application/use-cases/ProcessSyncQueue';
import { InMemoryProductRepository } from '@/modules/products/infrastructure/repositories/InMemoryProductRepository';
import { InMemorySyncTaskQueue } from '@/shared/sync/infrastructure/queue/InMemorySyncTaskQueue';

class FlakyProductSyncGateway implements ProductSyncGateway {
  private pullFails = 3;

  async pullProducts(): Promise<Product[]> {
    if (this.pullFails > 0) {
      this.pullFails -= 1;
      throw new Error('remote offline');
    }

    return [];
  }

  async pushProducts(): Promise<void> {}
}

describe('ProcessSyncQueue integration', () => {
  it('reagenda tarefa quando processamento falha e conclui depois', async () => {
    const repository = new InMemoryProductRepository();
    const queue = new InMemorySyncTaskQueue();
    const flakyGateway = new FlakyProductSyncGateway();

    const syncProducts = new SyncProducts(repository, flakyGateway);
    const processor = new ProcessSyncQueue(queue, [syncProducts], 1);

    await queue.enqueue('SYNC_PRODUCTS');

    const firstRun = await processor.execute();
    expect(firstRun.failed).toBe(1);

    const pending = await queue.listAll();
    expect(pending).toHaveLength(1);

    const secondRun = await processor.execute(new Date(Date.now() + 5));
    expect(secondRun.succeeded).toBe(1);

    expect(await queue.listAll()).toHaveLength(0);
  });
});
