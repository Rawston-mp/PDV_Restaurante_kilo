import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';

import { App } from '@/app/App';
import { AuthProvider } from '@/modules/auth/presentation/providers/AuthProvider';

vi.mock('socket.io-client', () => ({
  io: vi.fn(() => ({
    on: vi.fn(),
    disconnect: vi.fn()
  }))
}));

describe('Scale routing', () => {
  it('redireciona Balança A para a tela de balanças mesmo quando a URL anterior era Produtos', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify({ ok: true }), { status: 200 }))
    );

    render(
      <MemoryRouter initialEntries={['/products']}>
        <AuthProvider>
          <App />
        </AuthProvider>
      </MemoryRouter>
    );

    fireEvent.change(screen.getByLabelText('Perfil'), { target: { value: 'COMANDA_A' } });
    fireEvent.change(screen.getByLabelText('Senha'), { target: { value: '1111' } });
    fireEvent.click(screen.getByRole('button', { name: 'Entrar' }));

    expect(await screen.findByLabelText('Número da comanda')).toBeTruthy();
    expect(screen.queryByText('Produtos > Cadastro')).toBeNull();

    vi.unstubAllGlobals();
  });
});
