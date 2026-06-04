import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';

import { App } from '@/app/App';
import { AuthProvider } from '@/modules/auth/presentation/providers/AuthProvider';

type SocketHandler = (payload?: unknown) => void;

const socketHandlers = new Map<string, SocketHandler>();
const socketMock = {
  on: vi.fn((event: string, handler: SocketHandler) => {
    socketHandlers.set(event, handler);
  }),
  disconnect: vi.fn()
};

vi.mock('socket.io-client', () => ({
  io: vi.fn(() => socketMock)
}));

describe('New order flow e2e', () => {
  it('acessa pagina, abre comanda, usa peso da balanca e avanca status', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url =
          typeof input === 'string'
            ? input
            : input instanceof URL
              ? input.href
              : input.url;
        const method = init?.method ?? 'GET';

        if (url.endsWith('/comandas/status') && method === 'GET') {
          return new Response(JSON.stringify({ comandaAtiva: false }), { status: 200 });
        }

        if (url.endsWith('/comandas/abrir') && method === 'POST') {
          return new Response(JSON.stringify({ comandaAtiva: true }), { status: 200 });
        }

        if (url.endsWith('/comandas/fechar') && method === 'POST') {
          return new Response(JSON.stringify({ comandaAtiva: false }), { status: 200 });
        }

        return new Response('{}', { status: 200 });
      });

    vi.stubGlobal('fetch', fetchMock);

    render(
      <MemoryRouter initialEntries={['/orders/new']}>
        <AuthProvider>
          <App />
        </AuthProvider>
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole('button', { name: 'Abrir comanda' }));
    expect(await screen.findByText(/Comanda ativa:\s*sim/)).toBeTruthy();

    fireEvent.change(screen.getByLabelText('Mesa'), { target: { value: '15' } });
    fireEvent.click(screen.getByRole('button', { name: 'Criar pedido' }));

    expect(await screen.findByText(/Pedido criado:/)).toBeTruthy();

    fireEvent.change(screen.getByLabelText('Nome do item'), { target: { value: 'Suco' } });
    fireEvent.change(screen.getByLabelText('Preco unitario'), { target: { value: '100' } });
    fireEvent.click(screen.getByLabelText('Item por peso'));

    socketHandlers.get('connect')?.();
    socketHandlers.get('atualizar_peso')?.({ peso: 0.455 });
    socketHandlers.get('atualizar_peso')?.({ peso: 0.456 });
    socketHandlers.get('atualizar_peso')?.({ peso: 0.454 });
    socketHandlers.get('atualizar_peso')?.({ peso: 0.456 });
    expect(await screen.findByText('Peso recebido: 0.455 kg')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Usar peso da balanca' }));

    fireEvent.click(screen.getByRole('button', { name: 'Adicionar item ao pedido' }));

    expect(await screen.findByText('Total atual: R$ 45.50')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Avancar status do pedido' }));
    expect(await screen.findByText('Status atual: EM_PREPARO')).toBeTruthy();

    vi.unstubAllGlobals();
  });
});
