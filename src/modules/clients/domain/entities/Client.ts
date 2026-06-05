export type ClientConsumptionEntry = {
  id: string;
  description: string;
  launchedAt: string;
};

export type Client = {
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
  version: number;
  createdAt: Date;
  updatedAt: Date;
};
