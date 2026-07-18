export type NfeProductDraft = {
  sourceItemId: string;
  xmlProductCode: string;
  name: string;
  barcode: string;
  unit: string;
  unitCost: string;
  ncm: string;
  cfop: string;
  origin: string;
  cstOrCsosn: string;
  aliqIcms: string;
  cstPis: string;
  aliqPis: string;
  cstCofins: string;
  aliqCofins: string;
};

export type NfeProductDraftResult = {
  sourceItemId: string;
  productId: string;
  productName: string;
};

export const nfeProductDraftStorageKey = 'pdv.products.nfeProductDraft';
export const nfeProductDraftResultStorageKey = 'pdv.products.nfeProductDraftResult';

const readJson = <Value>(key: string): Value | null => {
  try {
    const rawValue = localStorage.getItem(key);
    return rawValue ? JSON.parse(rawValue) as Value : null;
  } catch {
    localStorage.removeItem(key);
    return null;
  }
};

export const readNfeProductDraft = () => readJson<NfeProductDraft>(nfeProductDraftStorageKey);

export const writeNfeProductDraft = (draft: NfeProductDraft) => {
  localStorage.setItem(nfeProductDraftStorageKey, JSON.stringify(draft));
};

export const clearNfeProductDraft = () => {
  localStorage.removeItem(nfeProductDraftStorageKey);
};

export const readNfeProductDraftResult = () =>
  readJson<NfeProductDraftResult>(nfeProductDraftResultStorageKey);

export const writeNfeProductDraftResult = (result: NfeProductDraftResult) => {
  localStorage.setItem(nfeProductDraftResultStorageKey, JSON.stringify(result));
};

export const clearNfeProductDraftResult = () => {
  localStorage.removeItem(nfeProductDraftResultStorageKey);
};
