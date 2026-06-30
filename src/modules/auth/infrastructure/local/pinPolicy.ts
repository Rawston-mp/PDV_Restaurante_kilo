import { getRoleLabel, type Role } from '@/modules/auth/domain/types/Role';

export type PinKind = 'LOGIN' | 'SENSITIVE';

export type PinChangeInput = {
  kind: PinKind;
  role: Role;
  currentPin: string;
  nextPin: string;
};

export type PinOperationResult = {
  success: boolean;
  message: string;
};

const loginStorageKey = 'pdv.auth.loginPins';
const sensitiveStorageKey = 'pdv.auth.sensitivePins';

export const defaultLoginPins: Record<Role, string> = {
  ADMIN: '9000',
  GERENTE: '7700',
  CAIXA: '2025',
  ATENDENTE: '3300',
  COMANDA_A: '1111',
  COMANDA_B: '2222'
};

export const defaultSensitivePins: Record<Role, string> = {
  ADMIN: '9900',
  GERENTE: '7700',
  CAIXA: '2200',
  ATENDENTE: '3300',
  COMANDA_A: '1100',
  COMANDA_B: '2201'
};

let memoryLoginPins = { ...defaultLoginPins };
let memorySensitivePins = { ...defaultSensitivePins };

const hasStorage = () =>
  typeof window !== 'undefined' &&
  !!window.localStorage &&
  typeof window.localStorage.getItem === 'function';

const getStorageKey = (kind: PinKind) => (kind === 'LOGIN' ? loginStorageKey : sensitiveStorageKey);

const getDefaultPins = (kind: PinKind) => (kind === 'LOGIN' ? defaultLoginPins : defaultSensitivePins);

const getMemoryPins = (kind: PinKind) => (kind === 'LOGIN' ? memoryLoginPins : memorySensitivePins);

const setMemoryPins = (kind: PinKind, nextPins: Record<Role, string>) => {
  if (kind === 'LOGIN') {
    memoryLoginPins = nextPins;
    return;
  }

  memorySensitivePins = nextPins;
};

const readPins = (kind: PinKind): Record<Role, string> => {
  if (!hasStorage()) {
    return getMemoryPins(kind);
  }

  const raw = window.localStorage.getItem(getStorageKey(kind));
  if (!raw) {
    return { ...getDefaultPins(kind) };
  }

  try {
    const parsed = JSON.parse(raw) as Record<Role, string>;
    const defaults = getDefaultPins(kind);

    const pins = {
      ...defaults,
      ...parsed
    };
    return migrateLegacyDefaultPins(kind, pins);
  } catch {
    return { ...getDefaultPins(kind) };
  }
};

const migrateLegacyDefaultPins = (kind: PinKind, pins: Record<Role, string>) => {
  if (kind !== 'LOGIN') {
    return pins;
  }

  return {
    ...pins,
    GERENTE: pins.GERENTE === '7070' ? defaultLoginPins.GERENTE : pins.GERENTE,
    ATENDENTE: pins.ATENDENTE === '3030' ? defaultLoginPins.ATENDENTE : pins.ATENDENTE
  };
};

const persistPins = (kind: PinKind, pins: Record<Role, string>) => {
  if (!hasStorage()) {
    setMemoryPins(kind, pins);
    return;
  }

  window.localStorage.setItem(getStorageKey(kind), JSON.stringify(pins));
};

const isPinStrongEnough = (pin: string) => {
  if (!/^\d{4,8}$/.test(pin)) {
    return false;
  }

  if (/^(\d)\1+$/.test(pin)) {
    return false;
  }

  return true;
};

export const verifyLoginPin = (role: Role, pin: string): boolean => {
  const pins = readPins('LOGIN');
  return pins[role] === pin;
};

export const verifySensitivePin = (role: Role, pin: string): boolean => {
  const pins = readPins('SENSITIVE');
  return pins[role] === pin;
};

export const changeRolePin = (input: PinChangeInput): PinOperationResult => {
  const pins = readPins(input.kind);

  if (pins[input.role] !== input.currentPin) {
    return {
      success: false,
      message: 'PIN atual inválido para o perfil selecionado.'
    };
  }

  if (!isPinStrongEnough(input.nextPin)) {
    return {
      success: false,
      message: 'O novo PIN deve ter de 4 a 8 dígitos e não pode repetir o mesmo número.'
    };
  }

  if (input.currentPin === input.nextPin) {
    return {
      success: false,
      message: 'Novo PIN deve ser diferente do atual.'
    };
  }

  const nextPins = {
    ...pins,
    [input.role]: input.nextPin
  };

  persistPins(input.kind, nextPins);

  return {
    success: true,
    message: `PIN ${input.kind === 'LOGIN' ? 'de login' : 'sensível'} atualizado com sucesso.`
  };
};

export const getPinPolicySummary = () => {
  const loginPins = readPins('LOGIN');
  const sensitivePins = readPins('SENSITIVE');

  return {
    loginStrengthIssues: Object.values(loginPins).filter((pin) => !isPinStrongEnough(pin)).length,
    sensitiveStrengthIssues: Object.values(sensitivePins).filter((pin) => !isPinStrongEnough(pin)).length
  };
};

export const getDefaultPinHint = () => {
  const orderedRoles: Role[] = ['ADMIN', 'CAIXA', 'COMANDA_A', 'COMANDA_B', 'GERENTE', 'ATENDENTE'];
  return `PIN login: ${orderedRoles.map((role) => `${getRoleLabel(role)} ${defaultLoginPins[role]}`).join(', ')}.`;
};
