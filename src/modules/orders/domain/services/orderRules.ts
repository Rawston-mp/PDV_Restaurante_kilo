import type { OrderItem } from '@/modules/orders/domain/entities/Order';

export function calculateOrderItemTotal(item: OrderItem): number {
  if (item.byWeight) {
    if (!item.weight || item.weight <= 0) {
      throw new Error('Peso deve ser informado para itens por peso');
    }
    return roundMoney(item.unitPrice * item.weight);
  }

  return roundMoney(item.unitPrice * item.quantity);
}

export function calculateOrderTotal(items: OrderItem[]): number {
  return roundMoney(items.reduce((acc, item) => acc + calculateOrderItemTotal(item), 0));
}

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}
