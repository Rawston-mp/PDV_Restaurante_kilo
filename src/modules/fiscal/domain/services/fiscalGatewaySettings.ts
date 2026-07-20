export const FISCAL_GATEWAY_SETTINGS_STORAGE_KEY = 'pdv.fiscal.gateway.settings';

export type FiscalGatewayEnvironment = 'SANDBOX' | 'PRODUCTION';

export type FiscalGatewaySettings = {
  enabled: boolean;
  environment: FiscalGatewayEnvironment;
  sandboxApiKey: string;
  productionApiKey: string;
  webhookUrl: string;
  webhookEvent: 'invoice.status_changed';
  allowOfflineContingency: boolean;
  updatedAt: string;
};

export const FISCAL_GATEWAY_API_BASE_URLS: Record<FiscalGatewayEnvironment, string> = {
  SANDBOX: 'https://sandbox-api.pdvtouch.local/v1',
  PRODUCTION: 'https://api.pdvtouch.local/v1'
};

export const FISCAL_GATEWAY_WEBHOOK_RETRY_POLICY = [
  { attempt: 1, interval: '5 minutos' },
  { attempt: 2, interval: '30 minutos' },
  { attempt: 3, interval: '1 hora' },
  { attempt: 4, interval: '4 horas' },
  { attempt: 5, interval: '16 horas' }
];

export const FISCAL_GATEWAY_RATE_LIMITS = {
  requestsPerMinute: 60,
  requestsPerSecond: 5
};

export const defaultFiscalGatewaySettings = (): FiscalGatewaySettings => ({
  enabled: false,
  environment: 'SANDBOX',
  sandboxApiKey: '',
  productionApiKey: '',
  webhookUrl: '',
  webhookEvent: 'invoice.status_changed',
  allowOfflineContingency: false,
  updatedAt: new Date().toISOString()
});

export const parseFiscalGatewaySettings = (rawValue: string | null): FiscalGatewaySettings => {
  if (!rawValue) {
    return defaultFiscalGatewaySettings();
  }

  try {
    return {
      ...defaultFiscalGatewaySettings(),
      ...JSON.parse(rawValue)
    } as FiscalGatewaySettings;
  } catch {
    return defaultFiscalGatewaySettings();
  }
};

export const loadFiscalGatewaySettings = () => {
  return parseFiscalGatewaySettings(localStorage.getItem(FISCAL_GATEWAY_SETTINGS_STORAGE_KEY));
};

export const saveFiscalGatewaySettings = (settings: FiscalGatewaySettings) => {
  const nextSettings = {
    ...settings,
    updatedAt: new Date().toISOString()
  };
  localStorage.setItem(FISCAL_GATEWAY_SETTINGS_STORAGE_KEY, JSON.stringify(nextSettings));
  return nextSettings;
};

export const maskApiKey = (apiKey: string) => {
  const trimmed = apiKey.trim();
  if (!trimmed) {
    return 'Não informada';
  }

  if (trimmed.length <= 8) {
    return '********';
  }

  return `${trimmed.slice(0, 4)}****${trimmed.slice(-4)}`;
};
