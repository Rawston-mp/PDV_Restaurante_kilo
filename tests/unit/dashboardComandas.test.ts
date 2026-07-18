import { describe, expect, it } from 'vitest';

import { mapClosedSalesToOrders } from '@/modules/orders/presentation/hooks/useOrdersQuery';

describe('Comandas fechadas no Dashboard', () => {
  it('converte vendas fiscais e orçamentos fechados usando a data de fechamento', () => {
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
        transitions: [{ to: 'FECHADA_ORCAMENTO', at: '2026-06-22T03:09:08.900Z' }],
        items: [
          {
            id: 'item-3',
            nome: 'Coca lata zero',
            precoUnitario: 7.5,
            quantidade: 1,
            subtotal: 7.5,
            porUnidade: true
          }
        ]
      },
      {
        numero: '7',
        status: 'ARQUIVADA',
        createdAt: '2026-07-15T16:00:00.000Z',
        updatedAt: '2026-07-16T01:30:00.000Z',
        transitions: [
          { to: 'FECHADA_VENDA', at: '2026-07-15T21:20:00.000Z' },
          { to: 'ARQUIVADA', at: '2026-07-16T01:30:00.000Z' }
        ],
        items: [
          {
            id: 'item-4',
            nome: 'Venda de ontem',
            precoUnitario: 15,
            quantidade: 1,
            subtotal: 15,
            porUnidade: true
          }
        ]
      },
      {
        numero: '9',
        status: 'ARQUIVADA',
        createdAt: '2026-07-15T16:00:00.000Z',
        updatedAt: '2026-07-16T01:30:00.000Z',
        transitions: [
          { to: 'CANCELADA', at: '2026-07-15T21:20:00.000Z' },
          { to: 'ARQUIVADA', at: '2026-07-16T01:30:00.000Z' }
        ],
        items: [
          {
            id: 'item-5',
            nome: 'Cancelada arquivada',
            precoUnitario: 99,
            quantidade: 1,
            subtotal: 99,
            porUnidade: true
          }
        ]
      }
    ]);

    expect(orders).toHaveLength(3);
    expect(orders[0]).toMatchObject({
      id: 'comanda-1-fechada_venda',
      table: 'Comanda 1',
      status: 'ENTREGUE',
      total: 32.5,
      createdBy: 'CAIXA'
    });
    expect(orders[0].createdAt.toISOString()).toBe('2026-06-22T03:08:34.199Z');
    expect(orders[1]).toMatchObject({
      id: 'comanda-4-fechada_orcamento',
      table: 'Orçamento 4',
      status: 'ENTREGUE',
      total: 7.5,
      createdBy: 'CAIXA'
    });
    expect(orders[1].createdAt.toISOString()).toBe('2026-06-22T03:09:08.900Z');
    expect(orders[2]).toMatchObject({
      id: 'comanda-7-fechada_venda',
      table: 'Comanda 7',
      status: 'ENTREGUE',
      total: 15,
      createdBy: 'CAIXA'
    });
    expect(orders[2].createdAt.toISOString()).toBe('2026-07-15T21:20:00.000Z');
  });
});
