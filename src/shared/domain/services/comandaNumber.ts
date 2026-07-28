export const normalizeComandaNumber = (value: unknown) => {
  const normalized = typeof value === 'number' && Number.isFinite(value)
    ? String(Math.trunc(value))
    : typeof value === 'string'
      ? value.trim()
      : '';
  if (!normalized) {
    return '';
  }

  return /^\d+$/.test(normalized) ? String(Number.parseInt(normalized, 10)) : normalized;
};

export const isValidComandaNumber = (value: unknown) => {
  const normalized = normalizeComandaNumber(value);
  return /^\d{1,12}$/.test(normalized);
};
