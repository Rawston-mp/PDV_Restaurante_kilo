import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

import { App } from '@/app/App';
import { AuthProvider } from '@/modules/auth/presentation/providers/AuthProvider';
import { saveStoreSettings } from '@/modules/admin/infrastructure/local/platformSettings';

afterEach(() => {
  cleanup();
  window.localStorage?.removeItem('pdv.auth.user');
  saveStoreSettings([]);
});

describe('Login multi-loja', () => {
  it('exige PIN mesmo quando havia sessão salva no computador', () => {
    const storedValues = new Map<string, string>();
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      value: {
        getItem: (key: string) => storedValues.get(key) ?? null,
        setItem: (key: string, value: string) => {
          storedValues.set(key, value);
        },
        removeItem: (key: string) => {
          storedValues.delete(key);
        }
      }
    });

    window.localStorage.setItem(
      'pdv.auth.user',
      JSON.stringify({
        id: 'u-admin-default',
        name: 'Administrador',
        role: 'ADMIN',
        storeId: 'store-development',
        storeName: 'Desenvolvimento'
      })
    );

    render(
      <MemoryRouter initialEntries={['/']}>
        <AuthProvider>
          <App />
        </AuthProvider>
      </MemoryRouter>
    );

    expect(screen.getByText('Acessar o sistema')).toBeTruthy();
    expect(screen.queryByText('Usuário logado')).toBeNull();
    expect(window.localStorage.getItem('pdv.auth.user')).toBeNull();
  });
  it('exibe lojas vinculadas e bloqueia seleção sem vínculo operacional', async () => {
    const now = new Date('2026-06-28T12:00:00.000Z').toISOString();
    saveStoreSettings([
      {
        id: 'store-manager',
        name: 'Loja Gerente',
        legalName: 'Loja Gerente LTDA',
        tradeName: 'Loja Gerente',
        logoUrl: '',
        welcomeTitle: 'Bem-vindo ao PDV!',
        welcomeSubtitle: 'Tudo pronto para você realizar ótimas vendas.',
        cnpj: '',
        stateRegistration: '',
        zipCode: '',
        address: '',
        number: '',
        complement: '',
        district: '',
        city: '',
        state: 'SP',
        foundingYear: '',
        responsibleName: '',
        responsibleCpf: '',
        active: true,
        accessNoticeEnabled: false,
        accessNoticeDays: '10',
        supportCompanyName: '',
        supportPhone: '',
        supportWhatsapp: '',
        supportEmail: '',
        allowedRoles: ['GERENTE'],
        createdAt: now,
        updatedAt: now
      },
      {
        id: 'store-cashier',
        name: 'Loja Caixa',
        legalName: 'Loja Caixa LTDA',
        tradeName: 'Loja Caixa',
        logoUrl: 'https://example.com/logo-caixa.png',
        welcomeTitle: 'Bem-vindo ao Caixa!',
        welcomeSubtitle: 'Atendimento liberado para a loja selecionada.',
        cnpj: '12345678000190',
        stateRegistration: '',
        zipCode: '',
        address: 'Rua Caixa',
        number: '100',
        complement: '',
        district: 'Centro',
        city: 'São Paulo',
        state: 'SP',
        foundingYear: '',
        responsibleName: '',
        responsibleCpf: '',
        active: true,
        accessNoticeEnabled: false,
        accessNoticeDays: '10',
        supportCompanyName: '',
        supportPhone: '',
        supportWhatsapp: '',
        supportEmail: '',
        allowedRoles: ['CAIXA'],
        createdAt: now,
        updatedAt: now
      }
    ]);

    render(
      <MemoryRouter initialEntries={['/caixa']}>
        <AuthProvider>
          <App />
        </AuthProvider>
      </MemoryRouter>
    );

    const storeSelect = screen.getByLabelText('Loja') as HTMLSelectElement;
    expect(storeSelect.value).toBe('store-cashier');
    expect(storeSelect.options).toHaveLength(1);
    expect(storeSelect.options[0].textContent).toBe('Loja Caixa');
    expect(screen.queryByRole('button', { name: 'Loja Gerente' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Loja Caixa' })).toBeNull();

    fireEvent.change(screen.getByLabelText('Senha'), { target: { value: '2025' } });
    fireEvent.click(screen.getByRole('button', { name: 'Entrar' }));

    expect(await screen.findByText('Usuário logado')).toBeTruthy();
    expect(screen.getByText('Loja: Loja Caixa')).toBeTruthy();
    expect(await screen.findByText('Bem-vindo ao Caixa!')).toBeTruthy();
    expect(screen.getByText('Atendimento liberado para a loja selecionada.')).toBeTruthy();
    expect(screen.getAllByText('Loja Caixa').length).toBeGreaterThan(0);
    expect(screen.getByText('12.345.678/0001-90')).toBeTruthy();
    expect(screen.getByText('Rua Caixa, 100 - Centro - São Paulo/SP')).toBeTruthy();
  });
});
