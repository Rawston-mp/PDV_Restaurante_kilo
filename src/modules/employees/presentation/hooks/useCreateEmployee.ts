import { useState } from 'react';

import { employeesContainer } from '@/modules/employees/infrastructure/container/employeesContainer';

type Input = {
  employeeCode: string;
  fullName: string;
  cpf: string;
  role: string;
  birthDate: string;
  gender: 'MASCULINO' | 'FEMININO';
  admissionDate: string;
  dismissalDate: string;
  notes: string;
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
};

export function useCreateEmployee() {
  const [saving, setSaving] = useState(false);

  const createEmployee = async (input: Input) => {
    setSaving(true);
    try {
      return await employeesContainer.createEmployee.execute({
        id: `emp-${crypto.randomUUID()}`,
        ...input
      });
    } finally {
      setSaving(false);
    }
  };

  return { createEmployee, saving };
}
