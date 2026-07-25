import { describe, expect, it } from 'vitest';

import { parseScaleData } from '../../backend/src/services/scaleReader.service';

describe('parseScaleData - Protocolo Toledo', () => {
  it('converte string de 5 dígitos em gramas para kg (Toledo STX/ETX)', () => {
    expect(parseScaleData('\x0200455\x03')).toBe(0.455);
    expect(parseScaleData('01250')).toBe(1.25);
    expect(parseScaleData('00050')).toBe(0.05);
  });

  it('converte string com decimal ou formato P03', () => {
    expect(parseScaleData('0.455')).toBe(0.455);
    expect(parseScaleData('0,455')).toBe(0.455);
    expect(parseScaleData('ST,GS,  1.250kg')).toBe(1.25);
  });

  it('trata valores acima de 100 inteiros sem decimal como gramas', () => {
    expect(parseScaleData('455')).toBe(0.455);
  });

  it('retorna null para dados inválidos ou peso zero/negativo', () => {
    expect(parseScaleData('00000')).toBeNull();
    expect(parseScaleData('INVALID')).toBeNull();
  });
});
