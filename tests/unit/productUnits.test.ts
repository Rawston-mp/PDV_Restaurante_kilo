import { describe, expect, it } from 'vitest';

import {
  calculateSaleUnitCost,
  inferUnitsPerPurchase,
  normalizeProductUnit
} from '@/modules/products/domain/services/productUnits';

describe('Conversão de unidades de produto', () => {
  it('normaliza unidades encontradas na NF-e', () => {
    expect(normalizeProductUnit('caixa')).toBe('CX');
    expect(normalizeProductUnit('unid')).toBe('UN');
    expect(normalizeProductUnit('fardo')).toBe('FD');
  });

  it('infere conteúdo da embalagem pela descrição', () => {
    expect(inferUnitsPerPurchase('Coca-Cola PET 200ml 12U', 'CX')).toBe(12);
    expect(inferUnitsPerPurchase('Água mineral CX C/24', 'CX')).toBe(24);
    expect(inferUnitsPerPurchase('Arroz 5kg', 'KG')).toBe(1);
  });

  it('calcula o custo da unidade vendida', () => {
    expect(calculateSaleUnitCost(16.7875, 12)).toBeCloseTo(1.398958, 6);
  });
});
