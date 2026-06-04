import type { ProductSyncGateway } from '@/modules/products/application/ports/ProductSyncGateway';
import type { Product } from '@/modules/products/domain/entities/Product';
import type { ProductRepository } from '@/modules/products/domain/ports/ProductRepository';
import { executeWithRetry } from '@/shared/sync/application/services/executeWithRetry';
import { resolveByVersionAndTime } from '@/shared/sync/domain/services/resolveByVersionAndTime';

export type SyncProductsResult = {
  mergedCount: number;
  resolvedConflicts: number;
};

type SyncProductsOptions = {
  maxAttempts?: number;
  baseDelayMs?: number;
  wait?: (ms: number) => Promise<void>;
};

export class SyncProducts {
  readonly type = 'SYNC_PRODUCTS' as const;

  constructor(
    private readonly productRepository: ProductRepository,
    private readonly productSyncGateway: ProductSyncGateway
  ) {}

  async execute(options: SyncProductsOptions = {}): Promise<SyncProductsResult> {
    const maxAttempts = options.maxAttempts ?? 3;
    const baseDelayMs = options.baseDelayMs ?? 75;

    const localProducts = await this.productRepository.list();
    const remoteProducts = await executeWithRetry(
      () => this.productSyncGateway.pullProducts(),
      {
        maxAttempts,
        baseDelayMs,
        wait: options.wait
      }
    );

    const localMap = new Map(localProducts.map((product) => [product.id, product]));
    const remoteMap = new Map(remoteProducts.map((product) => [product.id, product]));

    const ids = new Set<string>([...localMap.keys(), ...remoteMap.keys()]);
    const mergedProducts: Product[] = [];
    let resolvedConflicts = 0;

    for (const id of ids) {
      const local = localMap.get(id);
      const remote = remoteMap.get(id);

      if (local && remote) {
        const resolved = resolveByVersionAndTime(local, remote);
        const hasConflict =
          local.version !== remote.version ||
          new Date(local.updatedAt).getTime() !== new Date(remote.updatedAt).getTime();

        if (hasConflict) {
          resolvedConflicts += 1;
        }

        mergedProducts.push({
          ...resolved,
          lastSyncedAt: new Date()
        });
        continue;
      }

      if (local) {
        mergedProducts.push({
          ...local,
          lastSyncedAt: new Date()
        });
        continue;
      }

      if (remote) {
        mergedProducts.push({
          ...remote,
          lastSyncedAt: new Date()
        });
      }
    }

    for (const product of mergedProducts) {
      await this.productRepository.save(product);
    }

    await executeWithRetry(() => this.productSyncGateway.pushProducts(mergedProducts), {
      maxAttempts,
      baseDelayMs,
      wait: options.wait
    });

    return {
      mergedCount: mergedProducts.length,
      resolvedConflicts
    };
  }
}
