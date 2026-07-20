export const CERTIFICATE_SETTINGS_STORAGE_KEY = 'pdv.certificate.settings';
export const SEFAZ_PRODUCTION_READY = false;

export const CERTIFICATE_MODEL_OPTIONS = ['A1', 'A3'] as const;
export const CERTIFICATE_IMPORT_SOURCE_OPTIONS = ['MAQUINA', 'PENDRIVE'] as const;
export const DEFAULT_CERTIFICATE_RENEW_ALERT_DAYS = 20;

export const BR_UF_OPTIONS = [
  'AC', 'AL', 'AM', 'AP', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MG', 'MS', 'MT',
  'PA', 'PB', 'PE', 'PI', 'PR', 'RJ', 'RN', 'RO', 'RR', 'RS', 'SC', 'SE', 'SP', 'TO'
] as const;

export type CertificateModel = (typeof CERTIFICATE_MODEL_OPTIONS)[number];
export type CertificateImportSource = (typeof CERTIFICATE_IMPORT_SOURCE_OPTIONS)[number];

export type DigitalCertificateSettings = {
  alias: string;
  companyName: string;
  cnpj: string;
  stateRegistration?: string;
  cnae?: string;
  taxRegime?: string;
  addressLine1?: string;
  addressLine2?: string;
  cityUf?: string;
  model: CertificateModel;
  uf: string;
  cscId: string;
  cscCode: string;
  nfceEnvironment?: 'HOMOLOGACAO' | 'PRODUCAO';
  nfceSerie?: string;
  nfceNextNumber?: string;
  accountingEmail?: string;
  fileName: string;
  fileSize: number;
  fileExtension: string;
  importSource: CertificateImportSource;
  expirationDate: string;
  renewAlertDays: number;
  importedAt: string;
  updatedAt: string;
};

type UfRule = {
  message: string;
  cscIdPattern: RegExp;
  cscCodePattern: RegExp;
  cscMinLength: number;
  cscMaxLength: number;
};

const defaultUfRule: UfRule = {
  message: 'Valide CSC ativo e parâmetros de NFC-e junto à SEFAZ estadual.',
  cscIdPattern: /^\d{1,10}$/,
  cscCodePattern: /^[A-Za-z0-9]+$/,
  cscMinLength: 16,
  cscMaxLength: 64
};

const ufRules: Record<string, UfRule> = {
  SP: {
    message: 'SP: exija CSC e CSC ID válidos e mantenha certificado aderente às regras estaduais de NFC-e.',
    cscIdPattern: /^\d{1,6}$/,
    cscCodePattern: /^[A-Za-z0-9]+$/,
    cscMinLength: 36,
    cscMaxLength: 36
  },
  MG: {
    message: 'MG: valide CSC com tamanho controlado e sincronismo de relógio para evitar rejeição em autorização.',
    cscIdPattern: /^\d{1,6}$/,
    cscCodePattern: /^[A-Za-z0-9]+$/,
    cscMinLength: 20,
    cscMaxLength: 40
  },
  RS: {
    message: 'RS: confirme CSC e CSC ID dentro do padrão estadual e revise política de contingência de emissão.',
    cscIdPattern: /^\d{1,6}$/,
    cscCodePattern: /^[A-Za-z0-9]+$/,
    cscMinLength: 16,
    cscMaxLength: 36
  },
  RJ: {
    message: 'RJ: mantenha CSC e CSC ID válidos e atualizados para evitar bloqueio de autorização NFC-e.',
    cscIdPattern: /^\d{1,6}$/,
    cscCodePattern: /^[A-Za-z0-9]+$/,
    cscMinLength: 16,
    cscMaxLength: 36
  }
};

const normalizeDigits = (value: string) => value.replace(/\D/g, '');

const getRuleForUf = (uf: string) => ufRules[uf] ?? defaultUfRule;

export const formatCertificateFileSize = (sizeInBytes: number | null) => {
  if (!sizeInBytes || sizeInBytes <= 0) {
    return '-';
  }

  const kb = sizeInBytes / 1024;
  if (kb < 1024) {
    return `${kb.toFixed(1)} KB`;
  }

  return `${(kb / 1024).toFixed(2)} MB`;
};

export const isValidCnpjFormat = (value: string) => /^\d{14}$/.test(normalizeDigits(value));

export const getUfNfceRuleMessage = (uf: string) => `${uf}: ${getRuleForUf(uf).message}`;

export const validateCscByUf = (input: { uf: string; cscId: string; cscCode: string }) => {
  const { uf, cscId, cscCode } = input;
  const rule = getRuleForUf(uf);

  if (!cscId.trim()) {
    return `CSC ID é obrigatório para a UF ${uf}.`;
  }

  if (!rule.cscIdPattern.test(cscId.trim())) {
    return `CSC ID inválido para ${uf}. Informe somente números no padrão esperado.`;
  }

  const normalizedCsc = cscCode.trim();
  if (!normalizedCsc) {
    return `CSC é obrigatório para a UF ${uf}.`;
  }

  if (!rule.cscCodePattern.test(normalizedCsc)) {
    return `CSC inválido para ${uf}. Use apenas caracteres alfanuméricos.`;
  }

  if (normalizedCsc.length < rule.cscMinLength || normalizedCsc.length > rule.cscMaxLength) {
    if (rule.cscMinLength === rule.cscMaxLength) {
      return `CSC inválido para ${uf}. Use exatamente ${rule.cscMinLength} caracteres.`;
    }

    return `CSC inválido para ${uf}. Use entre ${rule.cscMinLength} e ${rule.cscMaxLength} caracteres.`;
  }

  return null;
};

export const parseDigitalCertificateSettings = (rawValue: string | null): DigitalCertificateSettings | null => {
  if (!rawValue) {
    return null;
  }

  try {
    return JSON.parse(rawValue) as DigitalCertificateSettings;
  } catch {
    return null;
  }
};

export const loadDigitalCertificateSettings = (): DigitalCertificateSettings | null => {
  return parseDigitalCertificateSettings(localStorage.getItem(CERTIFICATE_SETTINGS_STORAGE_KEY));
};

export const getCertificateExpiryStatus = (
  input: { expirationDate: string; renewAlertDays?: number | string },
  now = new Date()
) => {
  if (!input.expirationDate) {
    return null;
  }

  const expireDate = new Date(`${input.expirationDate}T23:59:59`);
  if (Number.isNaN(expireDate.getTime())) {
    return null;
  }

  const diffMs = expireDate.getTime() - now.getTime();
  const daysRemaining = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  const renewAlertDays = Number(input.renewAlertDays) || DEFAULT_CERTIFICATE_RENEW_ALERT_DAYS;

  return {
    daysRemaining,
    isExpired: daysRemaining < 0,
    isNearExpire: daysRemaining >= 0 && daysRemaining <= renewAlertDays
  };
};

export const getCertificateFiscalBlockReason = () => {
  const settings = loadDigitalCertificateSettings();
  if (!settings) {
    return null;
  }

  const expiry = getCertificateExpiryStatus({
    expirationDate: settings.expirationDate,
    renewAlertDays: settings.renewAlertDays
  });

  if (expiry?.isExpired) {
    return 'Emissão fiscal bloqueada: certificado digital vencido. Atualize o certificado no painel Admin.';
  }

  return null;
};
