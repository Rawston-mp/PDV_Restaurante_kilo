import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { CashierPage } from '@/modules/cashier/presentation/pages/CashierPage';
import type { Product } from '@/modules/products/domain/entities/Product';
import type { ItemComanda } from '@/types/comanda';
import { COMANDA_CANCELLED_STORAGE_KEY } from '@/shared/infrastructure/storage/comandaCache';

const productsQueryMock = vi.hoisted(() => ({
  products: [] as Product[]
}));

vi.mock('@/modules/auth/presentation/providers/AuthProvider', () => ({
  useAuth: () => ({
    user: { id: 'admin', name: 'Administrador', role: 'ADMIN' },
    signOut: vi.fn()
  })
}));

vi.mock('@/modules/products/presentation/hooks/useProductsQuery', () => ({
  useProductsQuery: () => ({ products: productsQueryMock.products, setProducts: vi.fn() })
}));

vi.mock('@/modules/clients/presentation/hooks/useClientsQuery', () => ({
  useClientsQuery: () => ({ clients: [], setClients: vi.fn() })
}));

describe('Carregamento da comanda no caixa', () => {
  const storage = new Map<string, string>();

  beforeEach(() => {
    storage.clear();
    productsQueryMock.products = [];
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      value: {
        getItem: (key: string) => storage.get(key) ?? null,
        setItem: (key: string, value: string) => storage.set(key, value),
        removeItem: (key: string) => storage.delete(key),
        clear: () => storage.clear()
      }
    });
    storage.set('pdv.cashier.active-session', JSON.stringify({
      isOpen: true,
      sequence: 1,
      openedAt: '2026-07-15T12:00:00.000Z',
      openedBy: 'Administrador'
    }));
    vi.restoreAllMocks();
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('bloqueia operações do caixa até abrir uma sessão', async () => {
    storage.delete('pdv.cashier.active-session');
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(new Response(JSON.stringify({ ok: true, comandas: [] }), { status: 200 }))));

    render(<CashierPage />);

    expect(screen.getByText('Caixa fechado')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Abrir caixa' })).toBeTruthy();
    expect(screen.queryByPlaceholderText('Digite produto, código ou comanda e pressione Enter')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Abrir caixa' }));

    expect(await screen.findByPlaceholderText('Digite produto, código ou comanda e pressione Enter')).toBeTruthy();
    expect(screen.getByText('Caixa aberto. As operações de venda estão liberadas.')).toBeTruthy();
  });

  it('não sobrescreve os itens do backend com um carrinho vazio durante a abertura', async () => {
    let resolveItems: ((response: Response) => void) | undefined;
    const itemsResponse = new Promise<Response>((resolve) => {
      resolveItems = resolve;
    });

    const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      const method = init?.method ?? 'GET';

      if (url.endsWith('/api/v1/comandas') && method === 'GET') {
        return Promise.resolve(new Response(JSON.stringify({
          ok: true,
          comandas: [{ numero: '1', status: 'PRONTA_PARA_CAIXA' }]
        }), { status: 200 }));
      }

      if (url.endsWith('/api/v1/comandas/1/items') && method === 'GET') {
        return itemsResponse;
      }

      return Promise.resolve(new Response('{}', { status: 200 }));
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<CashierPage />);

    const input = screen.getByPlaceholderText('Digite produto, código ou comanda e pressione Enter');
    fireEvent.change(input, { target: { value: '1' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith('http://localhost:3001/api/v1/comandas/1/items');
    });

    expect(fetchMock.mock.calls.some(([request, options]) => {
      const url = typeof request === 'string' ? request : request instanceof URL ? request.href : request.url;
      return url.endsWith('/api/v1/comandas/1/items') && options?.method === 'PUT';
    })).toBe(false);

    await act(async () => {
      resolveItems?.(new Response(JSON.stringify({
        ok: true,
        items: [{
          id: 'item-1',
          nome: 'Costela bovina',
          precoUnitario: 29.5,
          quantidade: 0.5,
          categoriaId: 'Por quilo',
          subtotal: 14.75,
          porUnidade: false,
          peso: 0.5
        }]
      }), { status: 200 }));
      await itemsResponse;
    });

    expect(await screen.findByText('Costela bovina')).toBeTruthy();
    expect(screen.getAllByText('R$ 14,75').length).toBeGreaterThan(0);
    expect(fetchMock.mock.calls.some(([request, options]) => {
      const url = typeof request === 'string' ? request : request instanceof URL ? request.href : request.url;
      return url.endsWith('/api/v1/comandas/1/items') && options?.method === 'PUT';
    })).toBe(false);

  });

  it('sai da comanda com Ctrl+X sem fechar ou cancelar o atendimento', async () => {
    const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      const method = init?.method ?? 'GET';

      if (url.endsWith('/api/v1/comandas') && method === 'GET') {
        return Promise.resolve(new Response(JSON.stringify({
          ok: true,
          comandas: [{ numero: '1', status: 'PRONTA_PARA_CAIXA' }]
        }), { status: 200 }));
      }

      if (url.endsWith('/api/v1/comandas/1/items') && method === 'GET') {
        return Promise.resolve(new Response(JSON.stringify({
          ok: true,
          items: [{
            id: 'item-1',
            nome: 'Self-Service',
            precoUnitario: 59.9,
            quantidade: 0.5,
            categoriaId: 'Por quilo',
            subtotal: 29.95,
            porUnidade: false,
            peso: 0.5
          }]
        }), { status: 200 }));
      }

      return Promise.resolve(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<CashierPage />);

    const input = screen.getByPlaceholderText('Digite produto, código ou comanda e pressione Enter');
    fireEvent.change(input, { target: { value: '1' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(await screen.findByText('Self-Service')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Manter comanda aberta' })).toBeTruthy();

    fireEvent.keyDown(window, { key: 'F2' });
    expect(await screen.findByText('Forma de Pagamento')).toBeTruthy();

    fireEvent.keyDown(window, { key: 'x', ctrlKey: true });

    expect(await screen.findByText('Sem comanda')).toBeTruthy();
    expect(screen.queryByText('Self-Service')).toBeNull();
    expect(screen.getByText('Comanda #1 mantida aberta para continuar o atendimento.')).toBeTruthy();

    await waitFor(() => {
      expect(fetchMock.mock.calls.some(([request, options]) => {
        const url = typeof request === 'string' ? request : request instanceof URL ? request.href : request.url;
        if (!url.endsWith('/api/v1/comandas/1/items') || options?.method !== 'PUT') {
          return false;
        }

        const body = JSON.parse(String(options.body)) as { reason?: string };
        return body.reason === 'caixa_leave_open';
      })).toBe(true);
    });

    expect(fetchMock.mock.calls.some(([request, options]) => {
      const url = typeof request === 'string' ? request : request instanceof URL ? request.href : request.url;
      return url.endsWith('/api/v1/comandas/1/status') && options?.method === 'PUT';
    })).toBe(false);
  });

  it('mantém a comanda aberta pelo botão do cabeçalho', async () => {
    const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      const method = init?.method ?? 'GET';

      if (url.endsWith('/api/v1/comandas') && method === 'GET') {
        return Promise.resolve(new Response(JSON.stringify({
          ok: true,
          comandas: [{ numero: '1', status: 'PRONTA_PARA_CAIXA' }]
        }), { status: 200 }));
      }

      if (url.endsWith('/api/v1/comandas/1') && method === 'GET') {
        return Promise.resolve(new Response(JSON.stringify({
          ok: true,
          comanda: { numero: '1', status: 'PRONTA_PARA_CAIXA' }
        }), { status: 200 }));
      }

      if (url.endsWith('/api/v1/comandas/1/items') && method === 'GET') {
        return Promise.resolve(new Response(JSON.stringify({
          ok: true,
          items: [{
            id: 'item-1',
            nome: 'Gelatina',
            precoUnitario: 3,
            quantidade: 1,
            categoriaId: 'Sobremesa',
            subtotal: 3,
            porUnidade: true
          }]
        }), { status: 200 }));
      }

      return Promise.resolve(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<CashierPage />);

    const input = screen.getByPlaceholderText('Digite produto, código ou comanda e pressione Enter') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '1' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(await screen.findByText('Gelatina')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Manter comanda aberta' }));

    expect(await screen.findByText('Sem comanda')).toBeTruthy();
    expect(screen.queryByText('Gelatina')).toBeNull();
    expect(screen.getByText('Comanda #1 mantida aberta para continuar o atendimento.')).toBeTruthy();

    await waitFor(() => {
      expect(fetchMock.mock.calls.some(([request, options]) => {
        const url = typeof request === 'string' ? request : request instanceof URL ? request.href : request.url;
        if (!url.endsWith('/api/v1/comandas/1/items') || options?.method !== 'PUT') {
          return false;
        }

        const body = JSON.parse(String(options.body)) as { reason?: string };
        return body.reason === 'caixa_leave_open';
      })).toBe(true);
    });
  });

  it('fecha pelo recebimento com dinheiro usando Enter duas vezes', async () => {
    const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      const method = init?.method ?? 'GET';

      if (url.endsWith('/api/v1/comandas') && method === 'GET') {
        return Promise.resolve(new Response(JSON.stringify({
          ok: true,
          comandas: [{ numero: '1', status: 'PRONTA_PARA_CAIXA' }]
        }), { status: 200 }));
      }

      if (url.endsWith('/api/v1/comandas/1') && method === 'GET') {
        return Promise.resolve(new Response(JSON.stringify({
          ok: true,
          comanda: { numero: '1', status: 'PRONTA_PARA_CAIXA' }
        }), { status: 200 }));
      }

      if (url.endsWith('/api/v1/comandas/1/items') && method === 'GET') {
        return Promise.resolve(new Response(JSON.stringify({
          ok: true,
          items: [{
            id: 'item-1',
            nome: 'Gelatina',
            precoUnitario: 3,
            quantidade: 1,
            categoriaId: 'Sobremesa',
            subtotal: 3,
            porUnidade: true
          }]
        }), { status: 200 }));
      }

      if (url.endsWith('/api/v1/comandas/close-batch') && method === 'POST') {
        return Promise.resolve(new Response(JSON.stringify({ ok: true, comandas: [] }), { status: 200 }));
      }

      return Promise.resolve(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    });
    vi.stubGlobal('fetch', fetchMock);
    vi.spyOn(window, 'open').mockReturnValue(null);

    render(<CashierPage />);

    const input = screen.getByPlaceholderText('Digite produto, código ou comanda e pressione Enter') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '1' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(await screen.findByText('Gelatina')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Receber' }));

    const orcamentoButton = await screen.findByRole('button', { name: /Orçamento F2/i });
    expect(orcamentoButton.className).toContain('border-orange-400');
    const orcamentoBadge = screen.getByLabelText('Documento selecionado: Orçamento');
    expect(orcamentoBadge.className).toContain('text-red-700');

    fireEvent.keyDown(window, { key: 'Enter' });
    const paymentsPanel = (await screen.findByText('Pagamentos')).closest('div');
    expect(paymentsPanel).toBeTruthy();
    expect(within(paymentsPanel as HTMLElement).getByText('Dinheiro')).toBeTruthy();

    fireEvent.keyDown(window, { key: 'Enter' });

    await waitFor(() => {
      const batchClose = fetchMock.mock.calls.find(([request, options]) => {
        const url = typeof request === 'string' ? request : request instanceof URL ? request.href : request.url;
        return url.endsWith('/api/v1/comandas/close-batch') && options?.method === 'POST';
      });
      expect(batchClose).toBeTruthy();
      const body = JSON.parse(String(batchClose?.[1]?.body)) as { documentMode?: string };
      expect(body.documentMode).toBe('ORCAMENTO');
    });
  });

  it('abre o recebimento em NFC-e pelo atalho F3', async () => {
    productsQueryMock.products = [{
      id: 'product-self-service',
      productCode: '001',
      name: 'Self-Service',
      category: 'Por quilo',
      price: 59.9,
      byWeight: true,
      stock: 10,
      ncm: '2106.90.29',
      cfop: '5102 - VENDA',
      taxSituationCode: '500',
      cstIcms: '0',
      fiscalType: 'Sem substituição tributária',
      aliqIcms: '0,00',
      aliqPis: '0,00',
      aliqCofins: '0,00',
      version: 1,
      createdAt: new Date(),
      updatedAt: new Date()
    }];

    const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      const method = init?.method ?? 'GET';

      if (url.endsWith('/api/v1/comandas') && method === 'GET') {
        return Promise.resolve(new Response(JSON.stringify({
          ok: true,
          comandas: [{ numero: '1', status: 'PRONTA_PARA_CAIXA' }]
        }), { status: 200 }));
      }

      if (url.endsWith('/api/v1/comandas/1') && method === 'GET') {
        return Promise.resolve(new Response(JSON.stringify({
          ok: true,
          comanda: { numero: '1', status: 'PRONTA_PARA_CAIXA' }
        }), { status: 200 }));
      }

      if (url.endsWith('/api/v1/comandas/1/items') && method === 'GET') {
        return Promise.resolve(new Response(JSON.stringify({
          ok: true,
          items: [{
            id: 'item-1',
            nome: 'Self-Service',
            precoUnitario: 59.9,
            quantidade: 0.5,
            categoriaId: 'Por quilo',
            subtotal: 29.95,
            porUnidade: false,
            peso: 0.5
          }]
        }), { status: 200 }));
      }

      if (url.endsWith('/api/v1/comandas/close-batch') && method === 'POST') {
        return Promise.resolve(new Response(JSON.stringify({ ok: true, comandas: [] }), { status: 200 }));
      }

      return Promise.resolve(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    });
    vi.stubGlobal('fetch', fetchMock);
    vi.spyOn(window, 'open').mockReturnValue(null);

    render(<CashierPage />);

    const input = screen.getByPlaceholderText('Digite produto, código ou comanda e pressione Enter') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '1' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(await screen.findByText('Self-Service')).toBeTruthy();
    fireEvent.keyDown(window, { key: 'F3' });

    const nfceButton = await screen.findByRole('button', { name: /NFC-e F3/i });
    expect(nfceButton.className).toContain('border-emerald-400');
    const fiscalBadge = screen.getByLabelText('Documento selecionado: Fiscal');
    expect(fiscalBadge.className).toContain('text-emerald-700');

    fireEvent.click(screen.getByRole('button', { name: '+ Adicionar pagamento' }));
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar e Fechar' }));

    await waitFor(() => {
      const batchClose = fetchMock.mock.calls.find(([request, options]) => {
        const url = typeof request === 'string' ? request : request instanceof URL ? request.href : request.url;
        return url.endsWith('/api/v1/comandas/close-batch') && options?.method === 'POST';
      });
      expect(batchClose).toBeTruthy();
      const body = JSON.parse(String(batchClose?.[1]?.body)) as { documentMode?: string };
      expect(body.documentMode).toBe('NFCE');
    });
  });

  it('abre o teclado virtual do caixa com Ctrl+C e esconde com Esc', () => {
    const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      const method = init?.method ?? 'GET';

      if (url.endsWith('/api/v1/comandas') && method === 'GET') {
        return Promise.resolve(new Response(JSON.stringify({ ok: true, comandas: [] }), { status: 200 }));
      }

      return Promise.resolve(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<CashierPage />);

    const input = screen.getByPlaceholderText('Digite produto, código ou comanda e pressione Enter') as HTMLInputElement;
    expect(screen.queryByRole('region', { name: 'Teclado virtual do caixa' })).toBeNull();

    fireEvent.keyDown(window, { key: 'c', ctrlKey: true });

    expect(screen.getByRole('region', { name: 'Teclado virtual do caixa' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: '1' }));
    expect(input.value).toBe('1');

    fireEvent.keyDown(window, { key: 'Escape' });

    expect(screen.queryByRole('region', { name: 'Teclado virtual do caixa' })).toBeNull();
  });

  it('permite venda avulsa no caixa sem abrir comanda', async () => {
    productsQueryMock.products = [{
      id: 'product-gelatina',
      productCode: '43',
      name: 'Gelatina',
      category: 'Sobremesa',
      price: 3,
      byWeight: false,
      stock: 10,
      version: 1,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T00:00:00.000Z')
    }];

    const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      const method = init?.method ?? 'GET';

      if (url.endsWith('/api/v1/comandas') && method === 'GET') {
        return Promise.resolve(new Response(JSON.stringify({ ok: true, comandas: [] }), { status: 200 }));
      }

      return Promise.resolve(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    });
    vi.stubGlobal('fetch', fetchMock);
    vi.spyOn(window, 'open').mockReturnValue(null);

    render(<CashierPage />);

    fireEvent.click(screen.getByRole('button', { name: 'Adicionar Gelatina' }));

    expect(await screen.findByRole('button', { name: 'Aumentar Gelatina' })).toBeTruthy();
    expect(screen.getByText('Venda avulsa')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Atualizar comanda' })).toBeNull();

    const input = screen.getByPlaceholderText('Digite produto, código ou comanda e pressione Enter') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'gel' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(await screen.findByText('2 un · R$ 3,00 / un')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Receber' }));
    expect(await screen.findByText('Forma de Pagamento')).toBeTruthy();

    fireEvent.keyDown(window, { key: 'Enter' });
    const paymentsPanel = (await screen.findByText('Pagamentos')).closest('div');
    expect(paymentsPanel).toBeTruthy();
    expect(within(paymentsPanel as HTMLElement).getByText('Dinheiro')).toBeTruthy();

    fireEvent.keyDown(window, { key: 'Enter' });

    expect(await screen.findByText('Venda avulsa fechada como orçamento não fiscal.')).toBeTruthy();
    expect(fetchMock.mock.calls.some(([request, options]) => {
      const url = typeof request === 'string' ? request : request instanceof URL ? request.href : request.url;
      return url.endsWith('/api/v1/comandas/close-batch') && options?.method === 'POST';
    })).toBe(false);
  });

  it('adiciona produto pesquisado pelo teclado virtual sem trocar a comanda aberta', async () => {
    productsQueryMock.products = [{
      id: 'product-gelatina',
      productCode: '43',
      name: 'Gelatina',
      category: 'Sobremesa',
      price: 3,
      byWeight: false,
      stock: 10,
      version: 1,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T00:00:00.000Z')
    }];

    const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      const method = init?.method ?? 'GET';

      if (url.endsWith('/api/v1/comandas') && method === 'GET') {
        return Promise.resolve(new Response(JSON.stringify({
          ok: true,
          comandas: [{ numero: '1', status: 'PRONTA_PARA_CAIXA' }]
        }), { status: 200 }));
      }

      if (url.endsWith('/api/v1/comandas/1/items') && method === 'GET') {
        return Promise.resolve(new Response(JSON.stringify({ ok: true, items: [] }), { status: 200 }));
      }

      return Promise.resolve(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<CashierPage />);

    const comandaInput = screen.getByPlaceholderText('Digite produto, código ou comanda e pressione Enter') as HTMLInputElement;
    fireEvent.change(comandaInput, { target: { value: '1' } });
    fireEvent.keyDown(comandaInput, { key: 'Enter' });

    expect(await screen.findByText('#1')).toBeTruthy();
    expect(await screen.findByText('Gelatina')).toBeTruthy();

    fireEvent.keyDown(window, { key: 'c', ctrlKey: true });
    expect(screen.getByRole('region', { name: 'Teclado virtual do caixa' })).toBeTruthy();
    expect(screen.getAllByRole('button', { name: 'Adicionar' }).length).toBeGreaterThan(0);

    const productInput = screen.getByPlaceholderText('Digite para buscar produto e pressione Enter para adicionar') as HTMLInputElement;
    fireEvent.click(screen.getByRole('button', { name: 'G' }));
    fireEvent.click(screen.getByRole('button', { name: 'E' }));
    fireEvent.click(screen.getByRole('button', { name: 'L' }));
    expect(productInput.value).toBe('gel');

    fireEvent.click(screen.getAllByRole('button', { name: 'Adicionar' })[0]);

    expect(await screen.findByRole('button', { name: 'Aumentar Gelatina' })).toBeTruthy();
    expect(screen.getByText('#1')).toBeTruthy();
    expect(screen.queryByText('Sem comanda')).toBeNull();
    expect(fetchMock.mock.calls.some(([request]) => {
      const url = typeof request === 'string' ? request : request instanceof URL ? request.href : request.url;
      return url.endsWith('/api/v1/comandas/43/items') || url.endsWith('/api/v1/comandas/gel/items');
    })).toBe(false);
  });

  it('não traz de volta item excluído ao atualizar comanda durante sincronização', async () => {
    let backendItems: ItemComanda[] = [
      {
        id: 'item-1',
        nome: 'Self-Service',
        precoUnitario: 59.9,
        quantidade: 0.5,
        categoriaId: 'Por quilo',
        subtotal: 29.95,
        porUnidade: false,
        peso: 0.5
      },
      {
        id: 'item-2',
        nome: 'Gelatina',
        precoUnitario: 3,
        quantidade: 1,
        categoriaId: 'Sobremesa',
        subtotal: 3,
        porUnidade: true
      }
    ];
    let pendingPutItems: ItemComanda[] | null = null;
    let releasePut: (() => void) | undefined;
    const putRelease = new Promise<void>((resolve) => {
      releasePut = resolve;
    });

    const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      const method = init?.method ?? 'GET';

      if (url.endsWith('/api/v1/comandas') && method === 'GET') {
        return Promise.resolve(new Response(JSON.stringify({
          ok: true,
          comandas: [{ numero: '1', status: 'PRONTA_PARA_CAIXA' }]
        }), { status: 200 }));
      }

      if (url.endsWith('/api/v1/comandas/1/items') && method === 'GET') {
        return Promise.resolve(new Response(JSON.stringify({ ok: true, items: backendItems }), { status: 200 }));
      }

      if (url.endsWith('/api/v1/comandas/1/items') && method === 'PUT') {
        const body = JSON.parse(String(init?.body)) as { items: ItemComanda[] };
        pendingPutItems = body.items;
        return putRelease.then(() => {
          backendItems = pendingPutItems ?? backendItems;
          return new Response(JSON.stringify({ ok: true, items: backendItems }), { status: 200 });
        });
      }

      return Promise.resolve(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<CashierPage />);

    const input = screen.getByPlaceholderText('Digite produto, código ou comanda e pressione Enter');
    fireEvent.change(input, { target: { value: '1' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(await screen.findByText('Self-Service')).toBeTruthy();
    expect(await screen.findByText('Gelatina')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Remover Gelatina' }));
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar' }));

    await waitFor(() => {
      expect(pendingPutItems?.map((item) => item.nome)).toEqual(['Self-Service']);
    });
    expect(screen.queryByText('Gelatina')).toBeNull();
    expect((screen.getByRole('button', { name: 'Salvando comanda...' }) as HTMLButtonElement).disabled).toBe(true);

    fireEvent.click(screen.getByRole('button', { name: 'Salvando comanda...' }));
    expect(screen.queryByText('Gelatina')).toBeNull();

    await act(async () => {
      releasePut?.();
      await putRelease;
    });

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Atualizar comanda' })).toBeTruthy();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Atualizar comanda' }));

    await waitFor(() => {
      expect(screen.queryByText('Gelatina')).toBeNull();
      expect(screen.getByText('Self-Service')).toBeTruthy();
    });
  });

  it('bloqueia reabertura de comanda cancelada localmente mesmo se o backend ainda devolver itens', async () => {
    const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      const method = init?.method ?? 'GET';

      if (url.endsWith('/api/v1/comandas') && method === 'GET') {
        return Promise.resolve(new Response(JSON.stringify({
          ok: true,
          comandas: [{ numero: '1', status: 'PRONTA_PARA_CAIXA' }]
        }), { status: 200 }));
      }

      if (url.endsWith('/api/v1/comandas/1') && method === 'GET') {
        return Promise.resolve(new Response(JSON.stringify({
          ok: true,
          comanda: { numero: '1', status: 'PRONTA_PARA_CAIXA' }
        }), { status: 200 }));
      }

      if (url.endsWith('/api/v1/comandas/1/items') && method === 'GET') {
        return Promise.resolve(new Response(JSON.stringify({
          ok: true,
          items: [{
            id: 'item-1',
            nome: 'Filé de Frango',
            precoUnitario: 29.5,
            quantidade: 1,
            categoriaId: 'Por quilo',
            subtotal: 29.5,
            porUnidade: true
          }]
        }), { status: 200 }));
      }

      if (url.endsWith('/api/v1/comandas/1/status') && method === 'PUT') {
        return Promise.resolve(new Response(JSON.stringify({ ok: false }), { status: 500 }));
      }

      return Promise.resolve(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<CashierPage />);

    const input = screen.getByPlaceholderText('Digite produto, código ou comanda e pressione Enter') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '1' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(await screen.findByText('Filé de Frango')).toBeTruthy();
    fireEvent.keyDown(window, { key: 'F8' });
    fireEvent.click(await screen.findByRole('button', { name: 'Confirmar' }));

    expect(await screen.findByText('Comanda #1 cancelada localmente. Confirme a sincronização quando o backend voltar.')).toBeTruthy();
    expect(screen.getByText('Sem comanda')).toBeTruthy();
    expect(screen.queryByText('Filé de Frango')).toBeNull();

    const inputAfterCancel = screen.getByPlaceholderText('Digite produto, código ou comanda e pressione Enter') as HTMLInputElement;
    fireEvent.change(inputAfterCancel, { target: { value: '1' } });
    fireEvent.keyDown(inputAfterCancel, { key: 'Enter' });

    expect(await screen.findByText('Comanda #1 está cancelada localmente e não pode ser aberta no caixa.')).toBeTruthy();
    expect(screen.queryByText('Filé de Frango')).toBeNull();
    expect(screen.getByText('Sem comanda')).toBeTruthy();
  });

  it('permite abrir comanda reaproveitada quando o backend tem movimentação mais recente que o cancelamento local', async () => {
    storage.set(COMANDA_CANCELLED_STORAGE_KEY, JSON.stringify({
      '1': {
        cancelledAt: '2026-06-25T20:00:00.000Z',
        reason: 'cancelada_localmente_no_caixa'
      }
    }));

    const freshComanda = {
      numero: '1',
      status: 'PRONTA_PARA_CAIXA',
      updatedAt: '2026-06-25T20:05:00.000Z'
    };

    const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      const method = init?.method ?? 'GET';

      if (url.endsWith('/api/v1/comandas') && method === 'GET') {
        return Promise.resolve(new Response(JSON.stringify({
          ok: true,
          comandas: [freshComanda]
        }), { status: 200 }));
      }

      if (url.endsWith('/api/v1/comandas/1') && method === 'GET') {
        return Promise.resolve(new Response(JSON.stringify({
          ok: true,
          comanda: freshComanda
        }), { status: 200 }));
      }

      if (url.endsWith('/api/v1/comandas/1/items') && method === 'GET') {
        return Promise.resolve(new Response(JSON.stringify({
          ok: true,
          items: [{
            id: 'item-1',
            nome: 'Gelatina',
            precoUnitario: 3,
            quantidade: 1,
            categoriaId: 'Sobremesa',
            subtotal: 3,
            porUnidade: true
          }]
        }), { status: 200 }));
      }

      return Promise.resolve(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<CashierPage />);

    const input = screen.getByPlaceholderText('Digite produto, código ou comanda e pressione Enter') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '1' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(await screen.findByText('Gelatina')).toBeTruthy();
    expect(screen.queryByText('Comanda #1 está cancelada localmente e não pode ser aberta no caixa.')).toBeNull();
    expect(screen.getByText('#1')).toBeTruthy();
  });

  it('junta várias comandas com Ctrl+U preservando a origem dos itens', async () => {
    const itemsByComanda: Record<string, ItemComanda[]> = {
      '1': [{
        id: 'item-1', nome: 'Self-Service', precoUnitario: 59.9, quantidade: 0.5,
        categoriaId: 'Por quilo', subtotal: 29.95, porUnidade: false, peso: 0.5
      }],
      '2': [{
        id: 'item-2', nome: 'Coca-Cola', precoUnitario: 7.5, quantidade: 1,
        categoriaId: 'Bebidas', subtotal: 7.5, porUnidade: true
      }],
      '3': [{
        id: 'item-3', nome: 'Gelatina', precoUnitario: 3, quantidade: 1,
        categoriaId: 'Sobremesa', subtotal: 3, porUnidade: true
      }]
    };
    const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      const method = init?.method ?? 'GET';

      if (url.endsWith('/api/v1/comandas') && method === 'GET') {
        return Promise.resolve(new Response(JSON.stringify({
          ok: true,
          comandas: ['1', '2', '3'].map((numero) => ({ numero, status: 'PRONTA_PARA_CAIXA' }))
        }), { status: 200 }));
      }

      const itemsMatch = url.match(/\/api\/v1\/comandas\/(\d+)\/items$/);
      if (itemsMatch && method === 'GET') {
        return Promise.resolve(new Response(JSON.stringify({
          ok: true,
          items: itemsByComanda[itemsMatch[1]] ?? []
        }), { status: 200 }));
      }

      return Promise.resolve(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<CashierPage />);

    const input = screen.getByPlaceholderText('Digite produto, código ou comanda e pressione Enter');
    fireEvent.change(input, { target: { value: '1' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(await screen.findByText('Self-Service')).toBeTruthy();

    fireEvent.keyDown(window, { key: 'u', ctrlKey: true });
    expect(screen.getByPlaceholderText('Juntar com a #1: digite ou leia outra comanda e pressione Enter')).toBe(input);

    fireEvent.change(input, { target: { value: '2' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(await screen.findByText('Coca-Cola')).toBeTruthy();

    await waitFor(() => expect((input as HTMLInputElement).value).toBe(''));
    fireEvent.keyDown(window, { key: 'u', ctrlKey: true });
    fireEvent.change(input, { target: { value: '3' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(await screen.findByText('Gelatina')).toBeTruthy();
    expect(screen.getByText('Comandas #1 + #2 + #3')).toBeTruthy();
    expect(screen.getAllByText(/Comanda #2 ·/).length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole('button', { name: 'Aumentar Coca-Cola' }));

    await waitFor(() => {
      const comanda2Update = fetchMock.mock.calls.find(([request, options]) => {
        const url = typeof request === 'string' ? request : request instanceof URL ? request.href : request.url;
        return url.endsWith('/api/v1/comandas/2/items') && options?.method === 'PUT';
      });
      expect(comanda2Update).toBeTruthy();
      const body = JSON.parse(String(comanda2Update?.[1]?.body)) as { items: Array<{ nome: string }> };
      expect(body.items.map((item) => item.nome)).toEqual(['Coca-Cola']);
    });

    vi.spyOn(window, 'open').mockReturnValue(null);
    fireEvent.keyDown(window, { key: 'F2' });
    fireEvent.click(await screen.findByRole('button', { name: '+ Adicionar pagamento' }));
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar e Fechar' }));

    await waitFor(() => {
      const batchClose = fetchMock.mock.calls.find(([request, options]) => {
        const url = typeof request === 'string' ? request : request instanceof URL ? request.href : request.url;
        return url.endsWith('/api/v1/comandas/close-batch') && options?.method === 'POST';
      });
      expect(batchClose).toBeTruthy();
      const body = JSON.parse(String(batchClose?.[1]?.body)) as { numeros: string[]; documentMode?: string };
      expect(body.numeros).toEqual(['1', '2', '3']);
      expect(body.documentMode).toBe('ORCAMENTO');
    });
  });
});
