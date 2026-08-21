import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { PaymentPanel } from '@/modules/cashier/presentation/components/PaymentPanel';

vi.mock('@/modules/clients/presentation/hooks/useClientsQuery', () => ({
  useClientsQuery: () => ({ clients: [] })
}));

afterEach(() => {
  cleanup();
});

describe('Payment document shortcuts', () => {
  it('alterna entre Orçamento com F2 e NFC-e com F3', () => {
    render(
      <PaymentPanel
        total={10}
        items={[]}
        initialDocumentMode="ORCAMENTO"
        onBack={() => undefined}
        onConfirm={() => undefined}
      />
    );

    expect(screen.getByLabelText('Documento selecionado: Orçamento')).toBeTruthy();

    fireEvent.keyDown(window, { key: 'F3', code: 'F3' });
    expect(screen.getByLabelText('Documento selecionado: Fiscal')).toBeTruthy();

    fireEvent.keyDown(window, { key: 'F2', code: 'F2' });
    expect(screen.getByLabelText('Documento selecionado: Orçamento')).toBeTruthy();
  });

  it('exibe somente o nome e o ID fiscal do produto na mesma linha', () => {
    render(
      <PaymentPanel
        total={26.5}
        items={[{
          id: 'product-48',
          name: 'Frango ao molho',
          quantity: 1,
          unitPrice: 26.5,
          unit: 'UN',
          productCode: '48',
          ncm: '0207.14.00',
          cfop: '5102',
          taxSituationCode: '61',
          fiscalType: 'VENDA',
          barcode: '7890000000000'
        }]}
        onBack={() => undefined}
        onConfirm={() => undefined}
      />
    );

    const itemLine = screen.getByText('Frango ao molho').closest('p');
    expect(itemLine?.textContent).toContain('Frango ao molhoID 48');
    expect(screen.queryByText(/NCM|CFOP|CST|EAN/)).toBeNull();
  });
});
