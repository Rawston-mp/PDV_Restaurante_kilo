import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { Product } from '@/modules/products/domain/entities/Product';
import { sanitizeCategoryOptions } from '@/modules/products/domain/services/productCategories';
import { ApiBackedProductRepository } from '@/modules/products/infrastructure/repositories/ApiBackedProductRepository';
import { InMemoryProductRepository } from '@/modules/products/infrastructure/repositories/InMemoryProductRepository';

const makeProduct = (id: string, name: string, category = 'Delivery'): Product => ({
  id,
  productCode: id,
  name,
  category,
  price: 10,
  byWeight: false,
  stock: 1,
  version: 1,
  createdAt: new Date('2026-08-21T00:00:00.000Z'),
  updatedAt: new Date('2026-08-21T00:00:00.000Z')
});

const jsonResponse = (body: unknown, ok = true) => ({
  ok,
  status: ok ? 200 : 503,
  url: 'http://localhost:3001/api/v1/products',
  headers: { get: () => 'application/json' },
  json: async () => body,
  text: async () => JSON.stringify(body)
}) as unknown as Response;

describe('consistência do catálogo entre runtimes', () => {
  beforeEach(() => {
    const values = new Map<string, string>();
    const localStorage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, String(value)),
      removeItem: (key: string) => values.delete(key),
      clear: () => values.clear(),
      key: (index: number) => [...values.keys()][index] ?? null,
      get length() { return values.size; }
    } as Storage;
    Object.defineProperty(window, 'localStorage', { configurable: true, value: localStorage });
    vi.restoreAllMocks();
  });

  it('usa o backend como referência e guarda backup de produto legado', async () => {
    const local = new InMemoryProductRepository();
    await local.save(makeProduct('legacy', 'Produto antigo'));
    const remote = makeProduct('remote', 'Produto atual', 'Sobremesas');

    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse({
      ok: true,
      products: [{
        ...remote,
        createdAt: remote.createdAt.toISOString(),
        updatedAt: remote.updatedAt.toISOString()
      }]
    })));

    const repository = new ApiBackedProductRepository(local);
    const products = await repository.list();

    expect(products.map((product) => product.id)).toEqual(['remote']);
    expect(products[0].category).toBe('Sobremesa');
    expect(await local.findById('legacy')).toBeNull();
    expect(window.localStorage.getItem('pdv.products.reconciliationBackup.v1')).toContain('Produto antigo');
  });

  it('preserva produto criado offline enquanto o envio continua pendente', async () => {
    const local = new InMemoryProductRepository();
    const repository = new ApiBackedProductRepository(local);
    const offline = makeProduct('offline', 'Produto offline');

    vi.stubGlobal('fetch', vi.fn(async () => {
      throw new Error('backend offline');
    }));
    await repository.save(offline);

    vi.stubGlobal('fetch', vi.fn(async (_input, init) => {
      if (!init?.method) {
        return jsonResponse({ ok: true, products: [] });
      }
      throw new Error('backend ainda offline');
    }));

    const products = await repository.list();
    expect(products.map((product) => product.id)).toEqual(['offline']);
  });

  it('normaliza aliases de categorias sem duplicar opções', () => {
    expect(sanitizeCategoryOptions([
      'Quilo',
      'Por quilo',
      'Sobremesas',
      'Sobremesa',
      'Rotisseria'
    ])).toEqual(['Por kilo', 'Sobremesa', 'Rotisserie']);
  });
});
