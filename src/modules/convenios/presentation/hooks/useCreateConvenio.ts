import { useState } from 'react';

import { conveniosContainer } from '@/modules/convenios/infrastructure/container/conveniosContainer';

type Input = {
  convenioCode: string;
  name: string;
  cpfCnpj?: string;
  paymentMethod: 'PIX' | 'DINHEIRO' | 'TRANSFERENCIA' | 'FIADO' | 'CARTAO' | 'OUTRO';
  cashFlow: 'ENTRADA' | 'SAIDA' | 'AMBOS';
  bankName: string;
  accountName: string;
  active: boolean;
  notes: string;
};

export function useCreateConvenio() {
  const [saving, setSaving] = useState(false);

  const createConvenio = async (input: Input) => {
    setSaving(true);
    try {
      return await conveniosContainer.createConvenio.execute({
        id: `conv-${crypto.randomUUID()}`,
        ...input
      });
    } finally {
      setSaving(false);
    }
  };

  return { createConvenio, saving };
}
