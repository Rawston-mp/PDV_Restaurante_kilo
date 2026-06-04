import type { OrderSyncGateway } from '@/modules/orders/application/ports/OrderSyncGateway';
import type { Order } from '@/modules/orders/domain/entities/Order';
import type { OrderRepository } from '@/modules/orders/domain/ports/OrderRepository';
import { resolveByVersionAndTime } from '@/shared/sync/domain/services/resolveByVersionAndTime';

export type SyncOrdersResult = {
  mergedCount: number;
  resolvedConflicts: number;
};

export class SyncOrders {
  readonly type = 'SYNC_ORDERS' as const;

  constructor(
    private readonly orderRepository: OrderRepository,
    private readonly orderSyncGateway: OrderSyncGateway
  ) {}

  async execute(): Promise<SyncOrdersResult> {
    const localOrders = await this.orderRepository.list();
    const remoteOrders = await this.orderSyncGateway.pullOrders();

    const localMap = new Map(localOrders.map((order) => [order.id, order]));
    const remoteMap = new Map(remoteOrders.map((order) => [order.id, order]));

    const ids = new Set<string>([...localMap.keys(), ...remoteMap.keys()]);
    const mergedOrders: Order[] = [];
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

        mergedOrders.push({
          ...resolved,
          lastSyncedAt: new Date()
        });
        continue;
      }

      if (local) {
        mergedOrders.push({
          ...local,
          lastSyncedAt: new Date()
        });
        continue;
      }

      if (remote) {
        mergedOrders.push({
          ...remote,
          lastSyncedAt: new Date()
        });
      }
    }

    for (const order of mergedOrders) {
      await this.orderRepository.save(order);
    }

    await this.orderSyncGateway.pushOrders(mergedOrders);

    return {
      mergedCount: mergedOrders.length,
      resolvedConflicts
    };
  }
}
