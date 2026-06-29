import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

import { App } from '@/app/App';
import { AuthProvider } from '@/modules/auth/presentation/providers/AuthProvider';

afterEach(() => {
  cleanup();
});

describe('Cashier access', () => {
  it('não mostra nem permite acesso de Caixa aos Cadastros', async () => {
    render(
      <MemoryRouter initialEntries={['/cadastro']}>
        <AuthProvider>
          <App />
        </AuthProvider>
      </MemoryRouter>
    );

    fireEvent.change(screen.getByLabelText('Usuário'), { target: { value: 'CAIXA' } });
    fireEvent.change(screen.getByLabelText('Senha'), { target: { value: '2025' } });
    fireEvent.click(screen.getByRole('button', { name: 'Entrar' }));

    expect(await screen.findByText('Usuário logado')).toBeTruthy();
    expect(screen.queryByRole('link', { name: 'Cadastros' })).toBeNull();
    expect(screen.getByText('Acesso negado para o perfil atual.')).toBeTruthy();
  });

  it('permite Caixa consultar Produtos sem exibir Novo cadastro', async () => {
    render(
      <MemoryRouter initialEntries={['/products']}>
        <AuthProvider>
          <App />
        </AuthProvider>
      </MemoryRouter>
    );

    fireEvent.change(screen.getByLabelText('Usuário'), { target: { value: 'CAIXA' } });
    fireEvent.change(screen.getByLabelText('Senha'), { target: { value: '2025' } });
    fireEvent.click(screen.getByRole('button', { name: 'Entrar' }));

    expect(await screen.findByText('Usuário logado')).toBeTruthy();
    expect(await screen.findByRole('heading', { name: 'Produtos' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: '+ Novo cadastro' })).toBeNull();
    expect(screen.queryByText('Produtos > Cadastro')).toBeNull();
  });
});
