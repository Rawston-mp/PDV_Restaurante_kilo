import { useCallback, useEffect, useState } from 'react';

import type { Order } from '@/modules/orders/domain/entities/Order';
import { ordersContainer } from '@/modules/orders/infrastructure/container/ordersContainer';
import { API_BASE_URL } from '@/shared/infrastructure/api/runtimeEndpoint';

type DashboardComandaItem = {
  id: string;
  nome: string;
  precoUnitario: number;
  quantidade: number;
  subtotal: number;
  porUnidade: boolean;
  peso?: number;
};

type DashboardComanda = {
  numero: string;
  status: string;
  items?: DashboardComandaItem[];
  createdAt: string;
  updatedAt: string;
  transitions?: Array<{ to: string; at: string }>;
};

const getClosingDate = (comanda: DashboardComanda) => {
  const closingTransition = [...(comanda.transitions ?? [])]
    .reverse()
    .find((transition) => transition.to === 'FECHADA_VENDA');
  return new Date(closingTransition?.at ?? comanda.updatedAt);
};

export const mapClosedSalesToOrders = (comandas: DashboardComanda[]): Order[] =>
  comandas
    .filter((comanda) => comanda.status === 'FECHADA_VENDA')
    .map((comanda) => {
      const closedAt = getClosingDate(comanda);
      const items = Array.isArray(comanda.items) ? comanda.items : [];

      return {
        id: `comanda-${comanda.numero}`,
        table: `Comanda ${comanda.numero}`,
        status: 'ENTREGUE',
        items: items.map((item) => ({
          id: item.id,
          productId: item.id,
          productName: item.nome,
          quantity: item.quantidade,
          unitPrice: item.precoUnitario,
          byWeight: !item.porUnidade,
          weight: item.peso
        })),
        total: items.reduce((sum, item) => sum + item.subtotal, 0),
        version: Math.max(1, comanda.transitions?.length ?? 1),
        createdAt: closedAt,
        updatedAt: closedAt,
        lastSyncedAt: new Date(),
        createdBy: 'CAIXA'
      } satisfies Order;
    });

export function useOrdersQuery() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [closedSalesCount, setClosedSalesCount] = useState(0);
  const [closedBudgetsCount, setClosedBudgetsCount] = useState(0);

  const reload = useCallback(async () => {
    const localOrders = await ordersContainer.orderRepository.list();

    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/comandas`);
      if (!response.ok) {
        throw new Error('Falha ao carregar comandas para o Dashboard.');
      }

      const payload = (await response.json()) as { comandas?: DashboardComanda[] };
      const comandas = Array.isArray(payload.comandas) ? payload.comandas : [];
      const closedSaleOrders = mapClosedSalesToOrders(comandas);
      const mergedOrders = new Map(localOrders.map((order) => [order.id, order]));

      for (const order of closedSaleOrders) {
        mergedOrders.set(order.id, order);
      }

      setOrders([...mergedOrders.values()]);
      setClosedSalesCount(closedSaleOrders.length);
      setClosedBudgetsCount(comandas.filter((comanda) => comanda.status === 'FECHADA_ORCAMENTO').length);
    } catch {
      setOrders(localOrders);
      setClosedSalesCount(0);
      setClosedBudgetsCount(0);
    }
  }, []);

  useEffect(() => {
    void reload();
    const intervalId = window.setInterval(() => void reload(), 15000);
    const handleFocus = () => void reload();
    window.addEventListener('focus', handleFocus);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener('focus', handleFocus);
    };
  }, [reload]);

  return { orders, setOrders, reload, closedSalesCount, closedBudgetsCount };
}
