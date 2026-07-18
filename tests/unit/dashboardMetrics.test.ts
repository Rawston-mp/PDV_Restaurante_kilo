import { describe, expect, it } from 'vitest';

import type { CashMovement } from '@/modules/finance/domain/entities/CashMovement';
import type { StoredFinanceEntry } from '@/modules/finance/infrastructure/local/financeEntries';
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

const createFinanceEntry = (override: Partial<StoredFinanceEntry>): StoredFinanceEntry => ({
  id: 'finance-1',
  financeCode: 'F-001',
  tab: 'RECEITA',
  description: 'Fechamento do turno',
  categoryType: 'OPERACIONAL',
  amount: '0,00',
  dueDate: '2026-07-15',
  competenceDate: '2026-07-15',
  accountName: 'Caixa',
  documentRef: 'Dinheiro',
  status: 'RECEBIDO',
  createdAt: '2026-07-15T21:00:00-03:00',
  updatedAt: '2026-07-15T21:00:00-03:00',
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

  it('usa a categoria do produto cadastrado quando o item vendido traz outro id', () => {
    const metrics = buildDashboardMetrics({
      orders: [
        createOrder({
          items: [
            {
              id: 'item-coca',
              productId: 'item-da-comanda-123',
              productName: 'Coca lata zero 350 ml.',
              quantity: 1,
              unitPrice: 7.5,
              byWeight: false
            }
          ],
          total: 7.5
        })
      ],
      cashMovements: [],
      products: [
        baseProduct,
        {
          ...baseProduct,
          id: '06',
          productCode: '06',
          name: 'Coca lata zero 350 ml.',
          category: 'Bebidas',
          price: 7.5,
          byWeight: false
        }
      ],
      period,
      openComandas: 0
    });

    expect(metrics.topProducts[0]).toMatchObject({
      productId: '06',
      name: 'Coca lata zero 350 ml.',
      category: 'Bebidas',
      unit: 'UN',
      total: 7.5
    });
  });

  it('monta vendas por horário com qualquer hora que tenha venda no período', () => {
    const metrics = buildDashboardMetrics({
      orders: [
        createOrder({
          id: 'madrugada',
          total: 10,
          createdAt: new Date('2026-07-15T02:10:00-03:00')
        }),
        createOrder({
          id: 'noite',
          total: 20,
          createdAt: new Date('2026-07-15T23:40:00-03:00')
        })
      ],
      cashMovements: [],
      products: [baseProduct],
      period,
      openComandas: 0
    });

    expect(metrics.hourlySales.map((hour) => hour.hour)).toEqual([2, 23]);
    expect(metrics.hourlySales.map((hour) => hour.amount)).toEqual([10, 20]);
  });

  it('lista produtos com estoque baixo para o alerta operacional', () => {
    const metrics = buildDashboardMetrics({
      orders: [],
      cashMovements: [],
      products: [
        { ...baseProduct, id: 'sem-estoque', name: 'Sem estoque', stock: 0 },
        { ...baseProduct, id: 'baixo-2', name: 'Gelatina', category: 'Sobremesa', stock: 2 },
        { ...baseProduct, id: 'baixo-1', name: 'Coca lata zero 350 ml.', category: 'Bebidas', stock: 1 },
        { ...baseProduct, id: 'normal', name: 'Estoque normal', stock: 12 }
      ],
      period,
      openComandas: 0
    });

    expect(metrics.lowStockCount).toBe(2);
    expect(metrics.lowStockProducts).toEqual([
      expect.objectContaining({ productId: 'baixo-1', name: 'Coca lata zero 350 ml.', stock: 1 }),
      expect.objectContaining({ productId: 'baixo-2', name: 'Gelatina', stock: 2 })
    ]);
  });

  it('calcula meios de pagamento a partir de Financeiro > Receita liquidada', () => {
    const metrics = buildDashboardMetrics({
      orders: [createOrder({ total: 100 })],
      cashMovements: [
        createMovement({ id: 'automatico', category: 'PIX', paymentMethod: 'PIX', amount: 100 })
      ],
      financeEntries: [
        createFinanceEntry({ id: 'aberto', documentRef: 'PIX', amount: '999,00', status: 'ABERTO' }),
        createFinanceEntry({ id: 'estornado', documentRef: 'Fiado', amount: '999,00', status: 'ESTORNADO' }),
        createFinanceEntry({ id: 'pix', documentRef: 'PIX', amount: '40,00', status: 'RECEBIDO' }),
        createFinanceEntry({ id: 'dinheiro', documentRef: 'Dinheiro', amount: '60,00', status: 'PAGO' })
      ],
      products: [baseProduct],
      period,
      openComandas: 0
    });

    expect(metrics.paymentMethods).toEqual([
      expect.objectContaining({ name: 'Dinheiro', percentage: 60 }),
      expect.objectContaining({ name: 'PIX', percentage: 40 })
    ]);
  });

  it('mantém movimentações automáticas como fallback quando não há receita liquidada', () => {
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
      expect.objectContaining({ name: 'Dinheiro', percentage: 60 }),
      expect.objectContaining({ name: 'PIX', percentage: 40 })
    ]);
  });
});
