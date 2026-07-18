import { beforeEach, describe, expect, it } from 'vitest';

import {
  clearNfeProductDraft,
  clearNfeProductDraftResult,
  readNfeProductDraft,
  readNfeProductDraftResult,
  writeNfeProductDraft,
  writeNfeProductDraftResult
} from '@/modules/products/infrastructure/local/nfeProductDraft';

describe('Rascunho de produto importado da NF-e', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('preserva dados comerciais e fiscais para abrir o cadastro do produto', () => {
    writeNfeProductDraft({
      sourceItemId: 'xml-item-1',
      xmlProductCode: 'FORN-10',
      name: 'Arroz Tipo 1',
      barcode: '7890000000011',
      unit: 'KG',
      unitCost: '8.50',
      ncm: '10063021',
      cfop: '5102',
      origin: '0',
      cstOrCsosn: '102',
      aliqIcms: '0',
      cstPis: '07',
      aliqPis: '0',
      cstCofins: '07',
      aliqCofins: '0'
    });

    expect(readNfeProductDraft()).toMatchObject({
      sourceItemId: 'xml-item-1',
      name: 'Arroz Tipo 1',
      ncm: '10063021',
      cstOrCsosn: '102'
    });

    clearNfeProductDraft();
    expect(readNfeProductDraft()).toBeNull();
  });

  it('devolve o produto criado para vincular a linha da nota', () => {
    writeNfeProductDraftResult({
      sourceItemId: 'xml-item-1',
      productId: 'prd-1',
      productName: 'Arroz Tipo 1'
    });

    expect(readNfeProductDraftResult()).toEqual({
      sourceItemId: 'xml-item-1',
      productId: 'prd-1',
      productName: 'Arroz Tipo 1'
    });

    clearNfeProductDraftResult();
    expect(readNfeProductDraftResult()).toBeNull();
  });
});
