import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  addCashMovementCategory,
  cashMovementCategoriesStorageKey,
  defaultCashMovementCategories,
  deleteCashMovementCategory,
  readCashMovementCategoryCatalog,
  saveCashMovementCategoryCatalog,
  updateCashMovementCategory
} from '@/modules/finance/infrastructure/local/cashMovementCategories';

describe('catálogo de categorias do caixa', () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    const storage = new Map<string, string>();

    vi.stubGlobal('localStorage', {
      clear: () => storage.clear(),
      getItem: (key: string) => storage.get(key) ?? null,
      removeItem: (key: string) => storage.delete(key),
      setItem: (key: string, value: string) => storage.set(key, value)
    });
  });

  it('retorna categorias padrão quando não há cadastro local', () => {
    expect(readCashMovementCategoryCatalog()).toEqual(defaultCashMovementCategories);
  });

  it('salva categorias normalizadas e sem duplicidade', () => {
    const catalog = saveCashMovementCategoryCatalog({
      ENTRADA: [' pix ', 'PIX', 'cartão'],
      SAIDA: ['troco', ' TROCO ', 'insumos']
    });

    expect(catalog).toEqual({
      ENTRADA: ['PIX', 'CARTÃO'],
      SAIDA: ['TROCO', 'INSUMOS']
    });
    expect(JSON.parse(localStorage.getItem(cashMovementCategoriesStorageKey) ?? '{}')).toEqual(catalog);
  });

  it('adiciona, edita e exclui categoria mantendo ao menos um item', () => {
    const initialCatalog = readCashMovementCategoryCatalog();
    const added = addCashMovementCategory(initialCatalog, 'ENTRADA', 'vale refeição');

    expect(added.error).toBeNull();
    expect(added.catalog.ENTRADA).toContain('VALE REFEIÇÃO');

    const duplicated = addCashMovementCategory(added.catalog, 'ENTRADA', 'PIX');
    expect(duplicated.error).toBe('Categoria já cadastrada.');

    const updated = updateCashMovementCategory(added.catalog, 'ENTRADA', 'VALE REFEIÇÃO', 'voucher');
    expect(updated.error).toBeNull();
    expect(updated.catalog.ENTRADA).toContain('VOUCHER');
    expect(updated.catalog.ENTRADA).not.toContain('VALE REFEIÇÃO');

    const deleted = deleteCashMovementCategory({ ENTRADA: ['PIX'], SAIDA: ['TROCO'] }, 'ENTRADA', 'PIX');
    expect(deleted.error).toBe('Mantenha pelo menos uma categoria cadastrada.');
  });
});
