import type { AddItemToOrderInput } from '@/modules/orders/application/dto/AddItemToOrderInput';
import { calculateOrderTotal } from '@/modules/orders/domain/services/orderRules';
import type { OrderRepository } from '@/modules/orders/domain/ports/OrderRepository';

export class AddItemToOrder {
  constructor(private readonly orderRepository: OrderRepository) {}

  async execute(input: AddItemToOrderInput) {
    const order = await this.orderRepository.findById(input.orderId);

    if (!order) {
      throw new Error('Pedido não encontrado');
    }

    const items = [...order.items, input.item];

    const updatedOrder = {
      ...order,
      items,
      total: calculateOrderTotal(items),
      version: order.version + 1,
      updatedAt: new Date()
    };

    await this.orderRepository.save(updatedOrder);
    return updatedOrder;
  }
}
