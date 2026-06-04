import { useEffect, useState } from 'react';

import type { Order } from '@/modules/orders/domain/entities/Order';
import { ordersContainer } from '@/modules/orders/infrastructure/container/ordersContainer';

export function useOrdersQuery() {
  const [orders, setOrders] = useState<Order[]>([]);

  const reload = async () => {
    setOrders(await ordersContainer.orderRepository.list());
  };

  useEffect(() => {
    void reload();
  }, []);

  return { orders, setOrders, reload };
}
