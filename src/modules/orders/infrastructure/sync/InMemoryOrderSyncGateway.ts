import type { OrderSyncGateway } from '@/modules/orders/application/ports/OrderSyncGateway';
import type { Order } from '@/modules/orders/domain/entities/Order';
import { resolveByVersionAndTime } from '@/shared/sync/domain/services/resolveByVersionAndTime';

export class InMemoryOrderSyncGateway implements OrderSyncGateway {
  private readonly remoteOrders = new Map<string, Order>();

  constructor(seedOrders: Order[] = []) {
    for (const order of seedOrders) {
      this.remoteOrders.set(order.id, order);
    }
  }

  async pullOrders(): Promise<Order[]> {
    return Array.from(this.remoteOrders.values());
  }

  async pushOrders(orders: Order[]): Promise<void> {
    for (const incoming of orders) {
      const current = this.remoteOrders.get(incoming.id);

      if (!current) {
        this.remoteOrders.set(incoming.id, incoming);
        continue;
      }

      this.remoteOrders.set(incoming.id, resolveByVersionAndTime(current, incoming));
    }
  }
}
