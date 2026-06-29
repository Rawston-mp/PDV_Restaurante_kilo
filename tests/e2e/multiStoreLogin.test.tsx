import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

import { App } from '@/app/App';
import { AuthProvider } from '@/modules/auth/presentation/providers/AuthProvider';
import { saveStoreSettings } from '@/modules/admin/infrastructure/local/platformSettings';

afterEach(() => {
  cleanup();
  saveStoreSettings([]);
});

describe('Login multi-loja', () => {
  it('exibe lojas vinculadas e bloqueia seleção sem vínculo operacional', async () => {
    const now = new Date('2026-06-28T12:00:00.000Z').toISOString();
    saveStoreSettings([
      {
        id: 'store-manager',
        name: 'Loja Gerente',
        legalName: 'Loja Gerente LTDA',
        tradeName: 'Loja Gerente',
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
        allowedRoles: ['GERENTE'],
        createdAt: now,
        updatedAt: now
      },
      {
        id: 'store-cashier',
        name: 'Loja Caixa',
        legalName: 'Loja Caixa LTDA',
        tradeName: 'Loja Caixa',
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
  });
});
