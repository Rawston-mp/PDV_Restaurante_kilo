import { describe, expect, it } from 'vitest';

import type { CashMovement } from '@/modules/finance/domain/entities/CashMovement';
import type { Order } from '@/modules/orders/domain/entities/Order';
import {
  buildDashboardMetrics,
  createCustomPeriod
} from '@/modules/orders/domain/services/dashboardMetrics';
import type { Product } from '@/modules/products/domain/entities/Product';

const baseProduct: Product = {
  id: 'prod-1',
  productCode: '001',
  name: 'Self-Service',
  category: 'Por kilo',
  price: 59.9,
  byWeight: true,
  stock: 10,
  version: 1,
  createdAt: new Date('2026-07-15T10:00:00-03:00'),
  updatedAt: new Date('2026-07-15T10:00:00-03:00')
};

const createOrder = (override: Partial<Order>): Order => ({
  id: 'order-1',
  table: 'Comanda 1',
  status: 'ENTREGUE',
  items: [
    {
      id: 'item-1',
      productId: 'prod-1',
      productName: 'Self-Service',
      quantity: 0.742,
      unitPrice: 59.9,
      byWeight: true,
      weight: 0.742
    }
  ],
  total: 44.45,
  version: 1,
  createdAt: new Date('2026-07-15T12:30:00-03:00'),
  updatedAt: new Date('2026-07-15T12:30:00-03:00'),
  createdBy: 'CAIXA',
  ...override
});

const createMovement = (override: Partial<CashMovement>): CashMovement => ({
  id: 'movement-1',
  movementCode: 'E-001',
  movementType: 'ENTRADA',
  category: 'PIX',
  amount: 20,
  description: 'Venda PIX',
  launchedAt: new Date('2026-07-15T12:35:00-03:00'),
  version: 1,
  createdAt: new Date('2026-07-15T12:35:00-03:00'),
  updatedAt: new Date('2026-07-15T12:35:00-03:00'),
  ...override
});

describe('dashboardMetrics', () => {
  const period = createCustomPeriod('2026-07-15', '2026-07-15');

  it('exclui vendas canceladas do faturamento e da contagem', () => {
    const metrics = buildDashboardMetrics({
      orders: [
        createOrder({ id: 'order-ok', total: 44.45 }),
        createOrder({ id: 'order-cancelada', table: 'Venda cancelada', total: 100 })
      ],
      cashMovements: [],
      products: [baseProduct],
      period,
      openComandas: 0
    });

    expect(metrics.salesCount).toBe(1);
    expect(metrics.revenueToday).toBe(44.45);
  });

  it('mantém produtos vendidos por peso em kg no ranking', () => {
    const metrics = buildDashboardMetrics({
      orders: [createOrder({})],
      cashMovements: [],
      products: [baseProduct],
      period,
      openComandas: 0
    });

    expect(metrics.topProducts[0]).toMatchObject({
      name: 'Self-Service',
      unit: 'KG',
      quantity: 0.742
    });
  });

  it('calcula meios de pagamento divididos a partir dos lançamentos reais', () => {
    const metrics = buildDashboardMetrics({
      orders: [createOrder({ total: 100 })],
      cashMovements: [
        createMovement({ id: 'pix', category: 'PIX', paymentMethod: 'PIX', amount: 40 }),
        createMovement({ id: 'dinheiro', category: 'DINHEIRO', paymentMethod: 'DINHEIRO', amount: 60 })
      ],
      products: [baseProduct],
      period,
      openComandas: 0
    });

    expect(metrics.paymentMethods).toEqual([
      expect.objectContaining({ name: 'DINHEIRO', percentage: 60 }),
      expect.objectContaining({ name: 'PIX', percentage: 40 })
    ]);
  });
});
