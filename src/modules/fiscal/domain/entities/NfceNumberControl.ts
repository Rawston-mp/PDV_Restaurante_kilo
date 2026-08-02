export type NfceNumberControl = {
  id: string;
  cnpj: string;
  ambiente: 'HOMOLOGACAO' | 'PRODUCAO';
  serie: string;
  ultimoNumero: string;
  proximoNumero: string;
  updatedAt: Date;
  createdAt: Date;
};

export type NfceNumberControlInput = {
  cnpj: string;
  ambiente: 'HOMOLOGACAO' | 'PRODUCAO';
  serie: string;
};
