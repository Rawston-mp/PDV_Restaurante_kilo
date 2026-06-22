import { describe, expect, it } from 'vitest';

import { mapClosedSalesToOrders } from '@/modules/orders/presentation/hooks/useOrdersQuery';

describe('Comandas fechadas no Dashboard', () => {
  it('converte apenas vendas fiscais e usa a data de fechamento', () => {
    const orders = mapClosedSalesToOrders([
      {
        numero: '1',
        status: 'FECHADA_VENDA',
        createdAt: '2026-06-21T12:00:00.000Z',
        updatedAt: '2026-06-22T03:08:34.199Z',
        transitions: [{ to: 'FECHADA_VENDA', at: '2026-06-22T03:08:34.199Z' }],
        items: [
          {
            id: 'item-1',
            nome: 'Filé de Frango',
            precoUnitario: 29.5,
            quantidade: 1,
            subtotal: 29.5,
            porUnidade: true
          },
          {
            id: 'item-2',
            nome: 'Gelatina',
            precoUnitario: 3,
            quantidade: 1,
            subtotal: 3,
            porUnidade: true
          }
        ]
      },
      {
        numero: '4',
        status: 'FECHADA_ORCAMENTO',
        createdAt: '2026-06-22T02:25:10.451Z',
        updatedAt: '2026-06-22T03:09:08.900Z',
        items: []
      }
    ]);

    expect(orders).toHaveLength(1);
    expect(orders[0]).toMatchObject({
      id: 'comanda-1',
      table: 'Comanda 1',
      status: 'ENTREGUE',
      total: 32.5,
      createdBy: 'CAIXA'
    });
    expect(orders[0].createdAt.toISOString()).toBe('2026-06-22T03:08:34.199Z');
  });
});
