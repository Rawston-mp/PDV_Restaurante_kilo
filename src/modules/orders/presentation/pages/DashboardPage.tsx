import { useState } from 'react';

import { ordersContainer } from '@/modules/orders/infrastructure/container/ordersContainer';
import { useOrdersQuery } from '@/modules/orders/presentation/hooks/useOrdersQuery';

export function DashboardPage() {
  const { orders, reload } = useOrdersQuery();
  const [syncMessage, setSyncMessage] = useState<string | null>(null);

  const onSync = async () => {
    const result = await ordersContainer.syncOrders.execute();
    await reload();
    setSyncMessage(
      `Sincronizacao concluida: ${result.mergedCount} pedidos, ${result.resolvedConflicts} conflitos resolvidos.`
    );
  };

  return (
    <section className="card">
      <h2>Dashboard</h2>
      <p>Total de pedidos: {orders.length}</p>
      <button type="button" onClick={onSync}>
        Sincronizar pedidos
      </button>
      {syncMessage && <p>{syncMessage}</p>}
    </section>
  );
}
