import type { Order } from '@/modules/orders/domain/entities/Order';

export interface OrderRepository {
  findById(id: string): Promise<Order | null>;
  list(): Promise<Order[]>;
  save(order: Order): Promise<void>;
}
