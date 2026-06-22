import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { CashierPage } from '@/modules/cashier/presentation/pages/CashierPage';

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
});
