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

// Polyfill for localStorage in non‑browser environments (e.g., Node tests)
const storage: Storage = (typeof localStorage !== 'undefined')
  ? (localStorage as unknown as Storage)
  : (() => {
      const map = new Map<string, string>();
      return {
        getItem(key: string) {
          return map.has(key) ? map.get(key)! : null;
        },
        setItem(key: string, value: string) {
          map.set(key, value);
        },
        removeItem(key: string) {
          map.delete(key);
        },
        clear() {
          map.clear();
        },
        // The following are required by the Storage interface but not used
        key(index: number) {
          const keys = Array.from(map.keys());
          return keys[index] ?? null;
        },
        length: 0,
      } as unknown as Storage;
    })();

// Ensure global.localStorage exists for test code that calls it directly
if (typeof (globalThis as any).localStorage === 'undefined') {
  (globalThis as any).localStorage = storage;
}

const readJson = <Value>(key: string): Value | null => {
  try {
    const rawValue = storage.getItem(key);
    return rawValue ? (JSON.parse(rawValue) as Value) : null;
  } catch {
    storage.removeItem(key);
    return null;
  }
};

export const readNfeProductDraft = () => readJson<NfeProductDraft>(nfeProductDraftStorageKey);

export const writeNfeProductDraft = (draft: NfeProductDraft) => {
  storage.setItem(nfeProductDraftStorageKey, JSON.stringify(draft));
};

export const clearNfeProductDraft = () => {
  storage.removeItem(nfeProductDraftStorageKey);
};

export const readNfeProductDraftResult = () =>
  readJson<NfeProductDraftResult>(nfeProductDraftResultStorageKey);

export const writeNfeProductDraftResult = (result: NfeProductDraftResult) => {
  storage.setItem(nfeProductDraftResultStorageKey, JSON.stringify(result));
};

export const clearNfeProductDraftResult = () => {
  storage.removeItem(nfeProductDraftResultStorageKey);
};
