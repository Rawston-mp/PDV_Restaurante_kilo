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
    throw new Error('O pedido já está no status final');
  }

  return next;
}
