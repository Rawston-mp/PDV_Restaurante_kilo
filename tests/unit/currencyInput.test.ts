import { describe, expect, it } from 'vitest';

import {
  formatCurrencyInput,
  normalizeCurrencyInputChange,
  parseCurrencyInput
} from '../../src/shared/domain/services/currencyInput';

describe('currencyInput', () => {
  it('interpreta inteiro digitado como reais, nao como centavos', () => {
    expect(parseCurrencyInput('100')).toBe(100);
    expect(formatCurrencyInput('100')).toBe('100,00');
  });

  it('formata valores grandes com duas casas decimais', () => {
    expect(parseCurrencyInput('11111')).toBe(11111);
    expect(formatCurrencyInput('11111')).toBe('11.111,00');
  });

  it('preserva centavos informados com virgula', () => {
    expect(parseCurrencyInput('100,5')).toBe(100.5);
    expect(formatCurrencyInput('100,5')).toBe('100,50');
  });

  it('aceita valor colado com R$ e separador brasileiro', () => {
    expect(parseCurrencyInput('R$ 1.234,56')).toBe(1234.56);
    expect(formatCurrencyInput('R$ 1.234,56')).toBe('1.234,56');
  });

  it('remove caracteres que nao fazem parte de valor monetario', () => {
    expect(normalizeCurrencyInputChange('R$ abc 99,90')).toBe('99,90');
  });
});
