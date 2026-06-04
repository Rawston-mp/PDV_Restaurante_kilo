import { describe, expect, it } from 'vitest';

import { applyWeightFilter } from '@/modules/orders/presentation/utils/weightFilter';
import type { WeightFilterState } from '@/modules/orders/presentation/utils/weightFilter';

describe('weightFilter', () => {
  const options = {
    windowSize: 4,
    stabilityTolerance: 0.03,
    maxJump: 1.2
  };

  it('nao aceita peso antes da janela minima', () => {
    let state: WeightFilterState = { history: [], stableWeight: null };
    state = applyWeightFilter(0.45, state, options);

    expect(state.stableWeight).toBeNull();
    expect(state.history).toHaveLength(1);
  });

  it('aceita media estavel quando janela fecha', () => {
    let state: WeightFilterState = { history: [], stableWeight: null };

    state = applyWeightFilter(0.45, state, options);
    state = applyWeightFilter(0.451, state, options);
    state = applyWeightFilter(0.449, state, options);
    state = applyWeightFilter(0.45, state, options);

    expect(state.stableWeight).toBe(0.45);
  });

  it('ignora salto abrupto acima do maxJump', () => {
    const state = {
      history: [0.45, 0.451, 0.449, 0.45],
      stableWeight: 0.45
    };

    const next = applyWeightFilter(2.8, state, options);
    expect(next.stableWeight).toBe(0.45);
  });
});
