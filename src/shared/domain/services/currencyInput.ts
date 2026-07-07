const currencyInputFormatter = new Intl.NumberFormat('pt-BR', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
});

export const normalizeCurrencyInputChange = (value: string) => value.replace(/[^\d,.]/g, '');

export const parseCurrencyInput = (value: string) => {
  const normalized = normalizeCurrencyInputChange(value).trim();

  if (!normalized) {
    return 0;
  }

  const numericValue = normalized.includes(',')
    ? normalized.replace(/\./g, '').replace(',', '.')
    : normalized.replace(/\./g, '');

  const parsed = Number(numericValue);
  return Number.isFinite(parsed) ? parsed : 0;
};

export const formatCurrencyInput = (value: string) => {
  const normalized = normalizeCurrencyInputChange(value).trim();

  if (!normalized) {
    return '';
  }

  return currencyInputFormatter.format(parseCurrencyInput(normalized));
};
