import { describe, expect, it } from 'vitest';

import { calculateNewStock } from '@/modules/stock/domain/services/stockRules';

describe('stockRules', () => {
  it('ajusta estoque com entrada positiva', () => {
    expect(calculateNewStock(10, 5)).toBe(15);
  });

  it('ajusta o estoque com saída', () => {
    expect(calculateNewStock(10, -3)).toBe(7);
  });

  it('não permite estoque negativo', () => {
    expect(() => calculateNewStock(2, -5)).toThrow('O estoque não pode ficar negativo');
  });
});
