import { describe, expect, it } from 'vitest';

import {
  calculateOrderItemTotal,
  calculateOrderTotal
} from '@/modules/orders/domain/services/orderRules';

describe('orderRules', () => {
  it('calcula item unitario por quantidade', () => {
    const total = calculateOrderItemTotal({
      id: 'i1',
      productId: 'p1',
      productName: 'Refrigerante',
      quantity: 2,
      unitPrice: 6.5,
      byWeight: false
    });

    expect(total).toBe(13);
  });

  it('calcula item por peso', () => {
    const total = calculateOrderItemTotal({
      id: 'i2',
      productId: 'p2',
      productName: 'Comida por quilo',
      quantity: 1,
      unitPrice: 69.9,
      byWeight: true,
      weight: 0.45
    });

    expect(total).toBe(31.46);
  });

  it('falha quando item por peso nao informa peso', () => {
    expect(() =>
      calculateOrderItemTotal({
        id: 'i3',
        productId: 'p3',
        productName: 'Comida por quilo',
        quantity: 1,
        unitPrice: 69.9,
        byWeight: true
      })
    ).toThrow('Peso deve ser informado para itens por peso');
  });

  it('calcula o total do pedido com itens mistos', () => {
    const total = calculateOrderTotal([
      {
        id: 'i1',
        productId: 'p1',
        productName: 'Suco',
        quantity: 2,
        unitPrice: 8,
        byWeight: false
      },
      {
        id: 'i2',
        productId: 'p2',
        productName: 'Comida por quilo',
        quantity: 1,
        unitPrice: 65,
        byWeight: true,
        weight: 0.5
      }
    ]);

    expect(total).toBe(48.5);
  });
});
