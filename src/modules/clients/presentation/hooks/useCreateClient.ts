import { useState } from 'react';

import type { ClientConsumptionEntry } from '@/modules/clients/domain/entities/Client';
import { clientsContainer } from '@/modules/clients/infrastructure/container/clientsContainer';

type Input = {
  clientCode: string;
  fullName: string;
  cpf: string;
  cep: string;
  address: string;
  number: string;
  neighborhood: string;
  state: string;
  city: string;
  complement: string;
  phone: string;
  mobile: string;
  email: string;
  active: boolean;
  consumptionHistory: ClientConsumptionEntry[];
};

export function useCreateClient() {
  const [saving, setSaving] = useState(false);

  const createClient = async (input: Input) => {
    setSaving(true);
    try {
      return await clientsContainer.createClient.execute({
        id: `cli-${crypto.randomUUID()}`,
        ...input
      });
    } finally {
      setSaving(false);
    }
  };

  return { createClient, saving };
}
