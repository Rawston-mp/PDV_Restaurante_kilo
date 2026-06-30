export type FiscalDocumentKind = 'CPF' | 'CNPJ';

export const onlyDigits = (value: string) => value.replace(/\D/g, '');

const hasRepeatedDigits = (value: string) => /^(\d)\1+$/.test(value);

export const normalizeCpf = (value: string) => onlyDigits(value).slice(0, 11);

export const normalizeCnpj = (value: string) => onlyDigits(value).slice(0, 14);

export const normalizeCpfCnpj = (value: string) => onlyDigits(value).slice(0, 14);

export const normalizeCep = (value: string) => onlyDigits(value).slice(0, 8);

export const formatCpf = (value: string) => {
  const digits = normalizeCpf(value);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
  if (digits.length <= 9) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
};

export const formatCnpj = (value: string) => {
  const digits = normalizeCnpj(value);
  if (digits.length <= 2) return digits;
  if (digits.length <= 5) return `${digits.slice(0, 2)}.${digits.slice(2)}`;
  if (digits.length <= 8) return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5)}`;
  if (digits.length <= 12) return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8)}`;
  return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(12)}`;
};

export const formatCpfCnpj = (value: string) => {
  const digits = normalizeCpfCnpj(value);
  return digits.length <= 11 ? formatCpf(digits) : formatCnpj(digits);
};

export const formatCep = (value: string) => {
  const digits = normalizeCep(value);
  return digits.length > 5 ? `${digits.slice(0, 5)}-${digits.slice(5)}` : digits;
};

export const isValidCpf = (value: string) => {
  const digits = normalizeCpf(value);
  if (digits.length !== 11 || hasRepeatedDigits(digits)) {
    return false;
  }

  const calculateDigit = (base: string, factor: number) => {
    const total = base
      .split('')
      .reduce((sum, digit) => sum + Number(digit) * factor--, 0);
    const remainder = (total * 10) % 11;
    return remainder === 10 ? 0 : remainder;
  };

  const firstDigit = calculateDigit(digits.slice(0, 9), 10);
  const secondDigit = calculateDigit(digits.slice(0, 10), 11);
  return firstDigit === Number(digits[9]) && secondDigit === Number(digits[10]);
};

export const isValidCnpj = (value: string) => {
  const digits = normalizeCnpj(value);
  if (digits.length !== 14 || hasRepeatedDigits(digits)) {
    return false;
  }

  const calculateDigit = (base: string, weights: number[]) => {
    const total = base
      .split('')
      .reduce((sum, digit, index) => sum + Number(digit) * weights[index], 0);
    const remainder = total % 11;
    return remainder < 2 ? 0 : 11 - remainder;
  };

  const firstDigit = calculateDigit(digits.slice(0, 12), [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  const secondDigit = calculateDigit(digits.slice(0, 13), [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  return firstDigit === Number(digits[12]) && secondDigit === Number(digits[13]);
};

export const isValidCpfCnpj = (value: string) => {
  const digits = normalizeCpfCnpj(value);
  if (digits.length === 11) return isValidCpf(digits);
  if (digits.length === 14) return isValidCnpj(digits);
  return false;
};

export const getCpfCnpjKind = (value: string): FiscalDocumentKind | null => {
  const digits = normalizeCpfCnpj(value);
  if (digits.length === 11) return 'CPF';
  if (digits.length === 14) return 'CNPJ';
  return null;
};

export const isValidCep = (value: string) => normalizeCep(value).length === 8;
