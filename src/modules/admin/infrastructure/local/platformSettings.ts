import type { Role } from '@/modules/auth/domain/types/Role';

export const STORE_SETTINGS_STORAGE_KEY = 'pdv.platform.stores';
export const LOCAL_PERIPHERAL_SETTINGS_STORAGE_KEY = 'pdv.local.peripherals';

export type StoreSettings = {
  id: string;
  name: string;
  legalName: string;
  tradeName: string;
  cnpj: string;
  stateRegistration: string;
  zipCode: string;
  address: string;
  number: string;
  complement: string;
  district: string;
  city: string;
  state: string;
  foundingYear: string;
  responsibleName: string;
  responsibleCpf: string;
  active: boolean;
  allowedRoles: Role[];
  createdAt: string;
  updatedAt: string;
};

export type PeripheralStatus = 'ATIVO' | 'INATIVO' | 'ERRO';

export type ScalePeripheralSettings = {
  id: string;
  name: string;
  enabled: boolean;
  model: 'PRIX 3/16';
  serialNumber: string;
  connection: 'SERIAL_RS232';
  port: string;
  baudRate: string;
  parity: 'NONE' | 'EVEN' | 'ODD';
  dataBits: string;
  stopBits: string;
  timeoutMs: string;
  status: PeripheralStatus;
  lastTestAt?: string;
  lastTestMessage?: string;
};

export type PrinterConnection = 'USB' | 'SERIAL' | 'ETHERNET';

export type PrinterPeripheralSettings = {
  enabled: boolean;
  model: 'Elgin i9 Full';
  description: string;
  connection: PrinterConnection;
  driverName: string;
  serialPort: string;
  ipAddress: string;
  networkPort: string;
  status: PeripheralStatus;
  lastTestAt?: string;
  lastTestMessage?: string;
};

export type LocalPeripheralSettings = {
  computerName: string;
  scales: ScalePeripheralSettings[];
  /** @deprecated Mantido apenas para migração de configurações locais antigas. */
  scale: ScalePeripheralSettings;
  cashierPrinter: PrinterPeripheralSettings;
  kitchenPrinter: PrinterPeripheralSettings;
  updatedAt: string;
};

export const storeRoleOptions: Role[] = ['ADMIN', 'GERENTE', 'CAIXA', 'ATENDENTE', 'COMANDA_A', 'COMANDA_B'];

const defaultStoreRoles: Role[] = ['ADMIN', 'GERENTE', 'CAIXA', 'ATENDENTE', 'COMANDA_A', 'COMANDA_B'];
let memoryStoreSettings: StoreSettings[] | null = null;
let memoryPeripheralSettings: LocalPeripheralSettings | null = null;

const hasStorage = () =>
  typeof window !== 'undefined' &&
  !!window.localStorage &&
  typeof window.localStorage.getItem === 'function';

const nowIso = () => new Date().toISOString();

const createDefaultStore = (): StoreSettings => {
  const timestamp = nowIso();
  return {
    id: 'store-development',
    name: 'Desenvolvimento',
    legalName: 'Desenvolvimento',
    tradeName: 'Desenvolvimento',
    cnpj: '',
    stateRegistration: '',
    zipCode: '',
    address: '',
    number: '',
    complement: '',
    district: '',
    city: '',
    state: 'SP',
    foundingYear: '',
    responsibleName: '',
    responsibleCpf: '',
    active: true,
    allowedRoles: defaultStoreRoles,
    createdAt: timestamp,
    updatedAt: timestamp
  };
};

const sanitizeRoleList = (roles: unknown): Role[] => {
  if (!Array.isArray(roles)) {
    return defaultStoreRoles;
  }

  const validRoles = roles.filter((role): role is Role => storeRoleOptions.includes(role as Role));
  return validRoles.length > 0 ? [...new Set(validRoles)] : defaultStoreRoles;
};

const sanitizeStore = (store: Partial<StoreSettings>): StoreSettings | null => {
  const legacyName = String(store.name ?? '').trim();
  const legalName = String(store.legalName ?? legacyName).trim();
  const tradeName = String(store.tradeName ?? legacyName).trim();
  const name = tradeName || legalName;
  if (!name) {
    return null;
  }

  const timestamp = nowIso();
  return {
    id: String(store.id || `store-${crypto.randomUUID()}`),
    name,
    legalName: legalName || name,
    tradeName: tradeName || name,
    cnpj: String(store.cnpj ?? ''),
    stateRegistration: String(store.stateRegistration ?? ''),
    zipCode: String(store.zipCode ?? ''),
    address: String(store.address ?? ''),
    number: String(store.number ?? ''),
    complement: String(store.complement ?? ''),
    district: String(store.district ?? ''),
    city: String(store.city ?? ''),
    state: String(store.state ?? 'SP'),
    foundingYear: String(store.foundingYear ?? ''),
    responsibleName: String(store.responsibleName ?? ''),
    responsibleCpf: String(store.responsibleCpf ?? ''),
    active: store.active !== false,
    allowedRoles: sanitizeRoleList(store.allowedRoles),
    createdAt: String(store.createdAt ?? timestamp),
    updatedAt: String(store.updatedAt ?? timestamp)
  };
};

export const readStoreSettings = (): StoreSettings[] => {
  if (!hasStorage()) {
    if (!memoryStoreSettings) {
      memoryStoreSettings = [createDefaultStore()];
    }

    return memoryStoreSettings;
  }

  const raw = window.localStorage.getItem(STORE_SETTINGS_STORAGE_KEY);
  if (!raw) {
    const defaults = [createDefaultStore()];
    saveStoreSettings(defaults);
    return defaults;
  }

  try {
    const parsed = JSON.parse(raw) as Array<Partial<StoreSettings>>;
    const stores = parsed.map(sanitizeStore).filter((store): store is StoreSettings => Boolean(store));
    return stores.length > 0 ? stores : [createDefaultStore()];
  } catch {
    return [createDefaultStore()];
  }
};

export const saveStoreSettings = (stores: StoreSettings[]) => {
  const sanitized = stores.map(sanitizeStore).filter((store): store is StoreSettings => Boolean(store));
  const nextStores = sanitized.length > 0 ? sanitized : [createDefaultStore()];

  if (hasStorage()) {
    window.localStorage.setItem(STORE_SETTINGS_STORAGE_KEY, JSON.stringify(nextStores));
  } else {
    memoryStoreSettings = nextStores;
  }

  return nextStores;
};

export const findStoreSettingById = (storeId: string) =>
  readStoreSettings().find((store) => store.id === storeId) ?? null;

export const getActiveStoreSettings = () => readStoreSettings().filter((store) => store.active);

export const roleCanAccessStore = (role: Role, store: StoreSettings) => (
  store.active && (role === 'ADMIN' || store.allowedRoles.includes(role))
);

export const getStoreSettingsForRole = (role: Role) =>
  getActiveStoreSettings().filter((store) => roleCanAccessStore(role, store));

const createDefaultScale = (index = 0): ScalePeripheralSettings => ({
  id: `scale-${index + 1}`,
  name: index === 0 ? 'Balança principal' : `Balança ${index + 1}`,
  enabled: true,
  model: 'PRIX 3/16',
  serialNumber: '12389113',
  connection: 'SERIAL_RS232',
  port: 'COM1',
  baudRate: '9600',
  parity: 'NONE',
  dataBits: '8',
  stopBits: '1',
  timeoutMs: '3000',
  status: 'INATIVO'
});

const createDefaultPrinter = (description: string): PrinterPeripheralSettings => ({
  enabled: true,
  model: 'Elgin i9 Full',
  description,
  connection: 'USB',
  driverName: 'Elgin i9 Full',
  serialPort: '',
  ipAddress: '',
  networkPort: '9100',
  status: 'INATIVO'
});

const createDefaultPeripheralSettings = (): LocalPeripheralSettings => ({
  computerName: typeof window !== 'undefined' ? window.navigator.platform || 'Computador local' : 'Computador local',
  scales: [createDefaultScale()],
  scale: createDefaultScale(),
  cashierPrinter: createDefaultPrinter('Impressora do caixa'),
  kitchenPrinter: {
    ...createDefaultPrinter('Impressora da copa'),
    enabled: false,
    connection: 'ETHERNET'
  },
  updatedAt: nowIso()
});

const sanitizeScale = (scale?: Partial<ScalePeripheralSettings>, index = 0): ScalePeripheralSettings => {
  const defaults = createDefaultScale(index);
  return {
    ...defaults,
    ...scale,
    id: String(scale?.id || defaults.id),
    name: String(scale?.name || defaults.name),
    model: 'PRIX 3/16',
    serialNumber: String(scale?.serialNumber ?? defaults.serialNumber),
    connection: 'SERIAL_RS232',
    port: String(scale?.port ?? defaults.port).toUpperCase(),
    baudRate: String(scale?.baudRate ?? defaults.baudRate),
    parity: scale?.parity === 'EVEN' || scale?.parity === 'ODD' ? scale.parity : 'NONE',
    dataBits: String(scale?.dataBits ?? defaults.dataBits),
    stopBits: String(scale?.stopBits ?? defaults.stopBits),
    timeoutMs: String(scale?.timeoutMs ?? defaults.timeoutMs),
    status: scale?.status === 'ATIVO' || scale?.status === 'ERRO' ? scale.status : 'INATIVO'
  };
};

const sanitizeScaleList = (settings: Partial<LocalPeripheralSettings>): ScalePeripheralSettings[] => {
  const source = Array.isArray(settings.scales) && settings.scales.length > 0
    ? settings.scales
    : settings.scale
      ? [settings.scale]
      : [createDefaultScale()];

  return source.map((scale, index) => sanitizeScale(scale, index));
};

const sanitizePrinter = (
  printer: Partial<PrinterPeripheralSettings> | undefined,
  fallbackDescription: string
): PrinterPeripheralSettings => {
  const defaults = createDefaultPrinter(fallbackDescription);
  const connection = printer?.connection === 'SERIAL' || printer?.connection === 'ETHERNET' ? printer.connection : 'USB';
  return {
    ...defaults,
    ...printer,
    model: 'Elgin i9 Full',
    description: String(printer?.description || fallbackDescription),
    connection,
    status: printer?.status === 'ATIVO' || printer?.status === 'ERRO' ? printer.status : 'INATIVO'
  };
};

export const readLocalPeripheralSettings = (): LocalPeripheralSettings => {
  if (!hasStorage()) {
    if (!memoryPeripheralSettings) {
      memoryPeripheralSettings = createDefaultPeripheralSettings();
    }

    return memoryPeripheralSettings;
  }

  const raw = window.localStorage.getItem(LOCAL_PERIPHERAL_SETTINGS_STORAGE_KEY);
  if (!raw) {
    const defaults = createDefaultPeripheralSettings();
    saveLocalPeripheralSettings(defaults);
    return defaults;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<LocalPeripheralSettings>;
    const scales = sanitizeScaleList(parsed);
    return {
      computerName: String(parsed.computerName || 'Computador local'),
      scales,
      scale: scales[0],
      cashierPrinter: sanitizePrinter(parsed.cashierPrinter, 'Impressora do caixa'),
      kitchenPrinter: sanitizePrinter(parsed.kitchenPrinter, 'Impressora da copa'),
      updatedAt: String(parsed.updatedAt || nowIso())
    };
  } catch {
    return createDefaultPeripheralSettings();
  }
};

export const saveLocalPeripheralSettings = (settings: LocalPeripheralSettings) => {
  const scales = sanitizeScaleList(settings);
  const nextSettings: LocalPeripheralSettings = {
    computerName: settings.computerName.trim() || 'Computador local',
    scales,
    scale: scales[0],
    cashierPrinter: sanitizePrinter(settings.cashierPrinter, 'Impressora do caixa'),
    kitchenPrinter: sanitizePrinter(settings.kitchenPrinter, 'Impressora da copa'),
    updatedAt: nowIso()
  };

  if (hasStorage()) {
    window.localStorage.setItem(LOCAL_PERIPHERAL_SETTINGS_STORAGE_KEY, JSON.stringify(nextSettings));
  } else {
    memoryPeripheralSettings = nextSettings;
  }

  return nextSettings;
};

export const runScaleCommunicationTest = (scale: ScalePeripheralSettings): ScalePeripheralSettings => {
  const testedAt = nowIso();
  if (!scale.enabled) {
    return {
      ...scale,
      status: 'INATIVO',
      lastTestAt: testedAt,
      lastTestMessage: 'Balança desativada neste computador.'
    };
  }

  if (!scale.port.trim()) {
    return {
      ...scale,
      status: 'ERRO',
      lastTestAt: testedAt,
      lastTestMessage: 'Informe a porta COM da PRIX 3/16 para testar a leitura.'
    };
  }

  return {
    ...scale,
    status: 'ATIVO',
    lastTestAt: testedAt,
    lastTestMessage: `Teste local preparado para ${scale.model} na ${scale.port}. A leitura real depende da ponte serial/driver instalado no Windows.`
  };
};

export const runPrinterCommunicationTest = (printer: PrinterPeripheralSettings): PrinterPeripheralSettings => {
  const testedAt = nowIso();
  if (!printer.enabled) {
    return {
      ...printer,
      status: 'INATIVO',
      lastTestAt: testedAt,
      lastTestMessage: `${printer.description} desativada neste computador.`
    };
  }

  const missingConnection =
    (printer.connection === 'USB' && !printer.driverName.trim()) ||
    (printer.connection === 'SERIAL' && !printer.serialPort.trim()) ||
    (printer.connection === 'ETHERNET' && (!printer.ipAddress.trim() || !printer.networkPort.trim()));

  if (missingConnection) {
    return {
      ...printer,
      status: 'ERRO',
      lastTestAt: testedAt,
      lastTestMessage: 'Complete os dados da conexão antes do teste de impressão.'
    };
  }

  return {
    ...printer,
    status: 'ATIVO',
    lastTestAt: testedAt,
    lastTestMessage: `Teste de impressão preparado para ${printer.model} via ${printer.connection}. A impressão real depende do driver do fabricante instalado.`
  };
};
