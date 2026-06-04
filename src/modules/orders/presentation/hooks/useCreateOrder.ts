import { useState } from 'react';

import { ordersContainer } from '@/modules/orders/infrastructure/container/ordersContainer';
import { useAuth } from '@/modules/auth/presentation/providers/AuthProvider';

export function useCreateOrder() {
  const { user } = useAuth();
  const [saving, setSaving] = useState(false);

  const createOrder = async (table: string) => {
    if (!user) {
      throw new Error('Usuario nao autenticado');
    }

    setSaving(true);
    try {
      const orderId = `ord-${crypto.randomUUID()}`;
      return await ordersContainer.createOrder.execute({
        id: orderId,
        table,
        createdBy: user.id
      });
    } finally {
      setSaving(false);
    }
  };

  return { createOrder, saving };
}
