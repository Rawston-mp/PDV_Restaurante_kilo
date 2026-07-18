export const productUnitOptions = ['UN', 'CX', 'FD', 'SC', 'PCT', 'GF', 'KG', 'LT'] as const;

export type ProductUnit = (typeof productUnitOptions)[number];

const unitAliases: Record<string, ProductUnit> = {
  UN: 'UN',
  UND: 'UN',
  UNID: 'UN',
  UNIDADE: 'UN',
  CX: 'CX',
  CAIXA: 'CX',
  FD: 'FD',
  FARDO: 'FD',
  SC: 'SC',
  SACO: 'SC',
  PCT: 'PCT',
  PACOTE: 'PCT',
  GF: 'GF',
  GARRAFA: 'GF',
  KG: 'KG',
  KILO: 'KG',
  QUILO: 'KG',
  LT: 'LT',
  L: 'LT',
  LITRO: 'LT'
};

export const normalizeProductUnit = (value: string | undefined, fallback: ProductUnit = 'UN'): ProductUnit => {
  const normalized = value?.trim().toUpperCase() ?? '';
  return unitAliases[normalized] ?? fallback;
};

export const isPackageUnit = (unit: ProductUnit) => ['CX', 'FD', 'SC', 'PCT'].includes(unit);

export const inferUnitsPerPurchase = (productName: string, purchaseUnit: ProductUnit) => {
  if (!isPackageUnit(purchaseUnit)) {
    return 1;
  }

  const normalizedName = productName.toUpperCase();
  const patterns = [
    /(?:C\s*\/|COM)\s*(\d{1,4})\b/,
    /\b(\d{1,4})\s*(?:UN|UND|UNID|UNIDADES|U)\b/,
    /\b(?:CX|FD|FARDO|CAIXA)\s*(?:C\s*\/)?\s*(\d{1,4})\b/,
    /\b(\d{1,4})\s*X\b/
  ];

  for (const pattern of patterns) {
    const match = normalizedName.match(pattern);
    const inferredValue = Number(match?.[1]);
    if (Number.isInteger(inferredValue) && inferredValue > 1) {
      return inferredValue;
    }
  }

  return 1;
};

export const calculateSaleUnitCost = (purchaseCost: number, unitsPerPurchase: number) => {
  const safePurchaseCost = Number.isFinite(purchaseCost) ? purchaseCost : 0;
  const safeConversion = Number.isFinite(unitsPerPurchase) && unitsPerPurchase > 0 ? unitsPerPurchase : 1;
  return Number((safePurchaseCost / safeConversion).toFixed(6));
};
