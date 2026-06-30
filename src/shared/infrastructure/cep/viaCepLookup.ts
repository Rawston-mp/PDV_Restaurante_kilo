import { normalizeCep } from '@/shared/domain/services/documentValidation';

export type CepAddress = {
  cep: string;
  street: string;
  district: string;
  city: string;
  state: string;
};

type ViaCepResponse = {
  cep?: string;
  logradouro?: string;
  bairro?: string;
  localidade?: string;
  uf?: string;
  erro?: boolean;
};

export const lookupCepAddress = async (value: string): Promise<CepAddress | null> => {
  const cep = normalizeCep(value);
  if (cep.length !== 8) {
    return null;
  }

  const response = await fetch(`https://viacep.com.br/ws/${cep}/json/`, {
    signal: AbortSignal.timeout(6000)
  });

  if (!response.ok) {
    throw new Error('Falha na consulta de CEP.');
  }

  const data = (await response.json()) as ViaCepResponse;
  if (data.erro) {
    return null;
  }

  return {
    cep,
    street: data.logradouro ?? '',
    district: data.bairro ?? '',
    city: data.localidade ?? '',
    state: data.uf ?? ''
  };
};
