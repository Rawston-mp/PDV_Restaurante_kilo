import { describe, expect, it } from 'vitest';

import { getNextOrderStatus } from '@/modules/orders/domain/services/orderStatusRules';

describe('orderStatusRules', () => {
  it('avanca de PENDENTE para EM_PREPARO', () => {
    expect(getNextOrderStatus('PENDENTE')).toBe('EM_PREPARO');
  });

  it('avanca de EM_PREPARO para PRONTO', () => {
    expect(getNextOrderStatus('EM_PREPARO')).toBe('PRONTO');
  });

  it('falha ao avançar quando o pedido já foi entregue', () => {
    expect(() => getNextOrderStatus('ENTREGUE')).toThrow('O pedido já está no status final');
  });
});
