import type { Order } from '@/modules/orders/domain/entities/Order';

export interface OrderSyncGateway {
  pullOrders(): Promise<Order[]>;
  pushOrders(orders: Order[]): Promise<void>;
}
