import { describe, expect, it } from 'vitest';

import { getNextOrderStatus } from '@/modules/orders/domain/services/orderStatusRules';

describe('orderStatusRules', () => {
  it('avanca de PENDENTE para EM_PREPARO', () => {
    expect(getNextOrderStatus('PENDENTE')).toBe('EM_PREPARO');
  });

  it('avanca de EM_PREPARO para PRONTO', () => {
    expect(getNextOrderStatus('EM_PREPARO')).toBe('PRONTO');
  });

  it('falha ao avancar quando pedido ja entregue', () => {
    expect(() => getNextOrderStatus('ENTREGUE')).toThrow('Pedido ja esta no status final');
  });
});
