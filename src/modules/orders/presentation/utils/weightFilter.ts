export type WeightFilterOptions = {
  windowSize: number;
  stabilityTolerance: number;
  maxJump: number;
};

export type WeightFilterState = {
  history: number[];
  stableWeight: number | null;
};

export function applyWeightFilter(
  incomingWeight: number,
  currentState: WeightFilterState,
  options: WeightFilterOptions
): WeightFilterState {
  if (!Number.isFinite(incomingWeight) || incomingWeight <= 0) {
    return currentState;
  }

  const nextHistory = [...currentState.history, incomingWeight].slice(-options.windowSize);

  if (nextHistory.length < options.windowSize) {
    return {
      history: nextHistory,
      stableWeight: currentState.stableWeight
    };
  }

  const min = Math.min(...nextHistory);
  const max = Math.max(...nextHistory);
  const mean = nextHistory.reduce((acc, value) => acc + value, 0) / nextHistory.length;

  if (max - min > options.stabilityTolerance) {
    return {
      history: nextHistory,
      stableWeight: currentState.stableWeight
    };
  }

  const candidate = Number(mean.toFixed(3));

  if (
    currentState.stableWeight !== null &&
    Math.abs(candidate - currentState.stableWeight) > options.maxJump
  ) {
    return {
      history: nextHistory,
      stableWeight: currentState.stableWeight
    };
  }

  return {
    history: nextHistory,
    stableWeight: candidate
  };
}
