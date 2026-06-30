import { describe, expect, it } from 'vitest';

import {
  formatCep,
  formatCnpj,
  formatCpf,
  formatCpfCnpj,
  isValidCep,
  isValidCnpj,
  isValidCpf,
  isValidCpfCnpj,
  normalizeCep,
  normalizeCpfCnpj
} from '@/shared/domain/services/documentValidation';

describe('validação de documentos e CEP', () => {
  it('valida CPF real e rejeita CPF inválido', () => {
    expect(isValidCpf('529.982.247-25')).toBe(true);
    expect(isValidCpf('123.456.789-09')).toBe(true);
    expect(isValidCpf('111.111.111-11')).toBe(false);
    expect(isValidCpf('123.456.789-00')).toBe(false);
    expect(isValidCpf('123')).toBe(false);
  });

  it('valida CNPJ real e rejeita CNPJ inválido', () => {
    expect(isValidCnpj('11.222.333/0001-81')).toBe(true);
    expect(isValidCnpj('12.345.678/0001-95')).toBe(true);
    expect(isValidCnpj('00.000.000/0000-00')).toBe(false);
    expect(isValidCnpj('12.345.678/0001-99')).toBe(false);
    expect(isValidCnpj('123')).toBe(false);
  });

  it('valida CPF/CNPJ pelo tamanho e algoritmo', () => {
    expect(isValidCpfCnpj('52998224725')).toBe(true);
    expect(isValidCpfCnpj('11222333000181')).toBe(true);
    expect(isValidCpfCnpj('12345678900')).toBe(false);
    expect(isValidCpfCnpj('11222333000180')).toBe(false);
    expect(normalizeCpfCnpj('11.222.333/0001-81')).toBe('11222333000181');
  });

  it('formata e limita CPF, CNPJ, CPF/CNPJ e CEP', () => {
    expect(formatCpf('52998224725999')).toBe('529.982.247-25');
    expect(formatCnpj('11222333000181999')).toBe('11.222.333/0001-81');
    expect(formatCpfCnpj('11222333000181')).toBe('11.222.333/0001-81');
    expect(formatCep('01001000999')).toBe('01001-000');
  });

  it('valida CEP por quantidade de dígitos normalizados', () => {
    expect(isValidCep('01001-000')).toBe(true);
    expect(isValidCep('01001000')).toBe(true);
    expect(isValidCep('01001')).toBe(false);
    expect(normalizeCep('01001-000999')).toBe('01001000');
  });
});
