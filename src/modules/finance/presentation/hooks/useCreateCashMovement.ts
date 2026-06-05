import { useState } from 'react';

import { financeContainer } from '@/modules/finance/infrastructure/container/financeContainer';

type Input = {
  movementCode: string;
  movementType: 'ENTRADA' | 'SAIDA';
  category: string;
  amount: number;
  description: string;
  launchedAt: Date;
  convenioId?: string;
  convenioName?: string;
  paymentMethod?: string;
};

export function useCreateCashMovement() {
  const [saving, setSaving] = useState(false);

  const createCashMovement = async (input: Input) => {
    setSaving(true);
    try {
      return await financeContainer.createCashMovement.execute({
        id: `mov-${crypto.randomUUID()}`,
        ...input
      });
    } finally {
      setSaving(false);
    }
  };

  return { createCashMovement, saving };
}