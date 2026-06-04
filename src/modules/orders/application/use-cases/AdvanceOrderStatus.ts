import type { AdvanceOrderStatusInput } from '@/modules/orders/application/dto/AdvanceOrderStatusInput';
import type { OrderRepository } from '@/modules/orders/domain/ports/OrderRepository';
import { getNextOrderStatus } from '@/modules/orders/domain/services/orderStatusRules';

export class AdvanceOrderStatus {
  constructor(private readonly orderRepository: OrderRepository) {}

  async execute(input: AdvanceOrderStatusInput) {
    const order = await this.orderRepository.findById(input.orderId);

    if (!order) {
      throw new Error('Pedido nao encontrado');
    }

    const updatedOrder = {
      ...order,
      status: getNextOrderStatus(order.status),
      version: order.version + 1,
      updatedAt: new Date()
    };

    await this.orderRepository.save(updatedOrder);
    return updatedOrder;
  }
}
