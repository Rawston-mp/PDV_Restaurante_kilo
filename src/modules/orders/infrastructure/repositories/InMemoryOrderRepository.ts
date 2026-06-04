import type { Order } from '@/modules/orders/domain/entities/Order';
import type { OrderRepository } from '@/modules/orders/domain/ports/OrderRepository';

export class InMemoryOrderRepository implements OrderRepository {
  private readonly orders = new Map<string, Order>();

  async findById(id: string): Promise<Order | null> {
    return this.orders.get(id) ?? null;
  }

  async list(): Promise<Order[]> {
    return Array.from(this.orders.values());
  }

  async save(order: Order): Promise<void> {
    this.orders.set(order.id, order);
  }
}
