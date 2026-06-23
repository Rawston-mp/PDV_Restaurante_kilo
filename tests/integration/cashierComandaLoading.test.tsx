import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { CashierPage } from '@/modules/cashier/presentation/pages/CashierPage';
import type { ItemComanda } from '@/types/comanda';

vi.mock('@/modules/auth/presentation/providers/AuthProvider', () => ({
  useAuth: () => ({
    user: { id: 'admin', name: 'Administrador', role: 'ADMIN' },
    signOut: vi.fn()
  })
}));

vi.mock('@/modules/products/presentation/hooks/useProductsQuery', () => ({
  useProductsQuery: () => ({ products: [], setProducts: vi.fn() })
}));

vi.mock('@/modules/clients/presentation/hooks/useClientsQuery', () => ({
  useClientsQuery: () => ({ clients: [], setClients: vi.fn() })
}));

describe('Carregamento da comanda no caixa', () => {
  const storage = new Map<string, string>();

  beforeEach(() => {
    storage.clear();
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      value: {
        getItem: (key: string) => storage.get(key) ?? null,
        setItem: (key: string, value: string) => storage.set(key, value),
        removeItem: (key: string) => storage.delete(key),
        clear: () => storage.clear()
      }
    });
    vi.restoreAllMocks();
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
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

    const input = screen.getByPlaceholderText('Digite ou leia a comanda (número/código) e pressione Enter');
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

  it('sai da comanda com Ctrl+C sem fechar ou cancelar o atendimento', async () => {
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

    const input = screen.getByPlaceholderText('Digite ou leia a comanda (número/código) e pressione Enter');
    fireEvent.change(input, { target: { value: '1' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(await screen.findByText('Self-Service')).toBeTruthy();

    fireEvent.keyDown(window, { key: 'F2' });
    expect(await screen.findByText('Forma de Pagamento')).toBeTruthy();

    fireEvent.keyDown(window, { key: 'c', ctrlKey: true });

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

    const input = screen.getByPlaceholderText('Digite ou leia a comanda (número/código) e pressione Enter');
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
      const body = JSON.parse(String(batchClose?.[1]?.body)) as { numeros: string[] };
      expect(body.numeros).toEqual(['1', '2', '3']);
    });
  });
});
