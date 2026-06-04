import type { Order } from '@/modules/orders/domain/entities/Order';
import type { OrderRepository } from '@/modules/orders/domain/ports/OrderRepository';
import { pdvDatabase } from '@/shared/infrastructure/db/PdvDatabase';

export class DexieOrderRepository implements OrderRepository {
  async findById(id: string): Promise<Order | null> {
    const order = await pdvDatabase.orders.get(id);
    return order ?? null;
  }

  async list(): Promise<Order[]> {
    return pdvDatabase.orders.toArray();
  }

  async save(order: Order): Promise<void> {
    await pdvDatabase.orders.put(order);
  }
}
