import type { OrderStatus } from '@/modules/orders/domain/entities/Order';

const transitions: Record<OrderStatus, OrderStatus | null> = {
  PENDENTE: 'EM_PREPARO',
  EM_PREPARO: 'PRONTO',
  PRONTO: 'ENTREGUE',
  ENTREGUE: null
};

export function getNextOrderStatus(currentStatus: OrderStatus): OrderStatus {
  const next = transitions[currentStatus];

  if (!next) {
    throw new Error('Pedido ja esta no status final');
  }

  return next;
}
