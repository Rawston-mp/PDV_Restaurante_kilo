import { useState } from 'react';

import { suppliersContainer } from '@/modules/suppliers/infrastructure/container/suppliersContainer';

type Input = {
  supplierCode: string;
  cpfCnpj: string;
  stateRegistration: string;
  legalName: string;
  tradeName: string;
  cep: string;
  address: string;
  number: string;
  neighborhood: string;
  state: string;
  city: string;
  complement: string;
  serviceFee: string;
  phone: string;
  mobile: string;
  email: string;
};

export function useCreateSupplier() {
  const [saving, setSaving] = useState(false);

  const createSupplier = async (input: Input) => {
    setSaving(true);
    try {
      return await suppliersContainer.createSupplier.execute({
        id: `sup-${crypto.randomUUID()}`,
        ...input
      });
    } finally {
      setSaving(false);
    }
  };

  return { createSupplier, saving };
}
