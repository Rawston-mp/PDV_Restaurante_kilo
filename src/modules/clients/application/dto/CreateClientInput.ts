import type { ClientConsumptionEntry } from '@/modules/clients/domain/entities/Client';

export type CreateClientInput = {
  id: string;
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
