import type { CreateOrderInput } from '@/modules/orders/application/dto/CreateOrderInput';
import type { Order } from '@/modules/orders/domain/entities/Order';
import type { OrderRepository } from '@/modules/orders/domain/ports/OrderRepository';

export class CreateOrder {
  constructor(private readonly orderRepository: OrderRepository) {}

  async execute(input: CreateOrderInput): Promise<Order> {
    const now = new Date();
    const order: Order = {
      id: input.id,
      table: input.table,
      status: 'PENDENTE',
      items: [],
      total: 0,
      version: 1,
      createdAt: now,
      updatedAt: now,
      createdBy: input.createdBy
    };

    await this.orderRepository.save(order);
    return order;
  }
}
