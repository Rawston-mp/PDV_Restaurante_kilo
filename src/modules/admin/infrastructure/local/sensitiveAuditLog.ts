import type { Role } from '@/modules/auth/domain/types/Role';

export type SensitiveActionType = 'CLOSE_COMANDA' | 'CANCEL_ORDER';

export type SensitiveAuditEvent = {
  id: string;
  action: SensitiveActionType;
  actorRole: Role;
  actorName: string;
  outcome: 'SUCCESS' | 'DENIED';
  reason?: string;
  scaleId?: 'A' | 'B';
  createdAt: string;
};

const storageKey = 'pdv.audit.sensitiveActions';

const hasStorage = () =>
  typeof window !== 'undefined' &&
  !!window.localStorage &&
  typeof window.localStorage.getItem === 'function';

let memoryStore: SensitiveAuditEvent[] = [];

export const listSensitiveAuditEvents = (): SensitiveAuditEvent[] => {
  if (!hasStorage()) {
    return memoryStore;
  }

  const raw = window.localStorage.getItem(storageKey);
  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw) as SensitiveAuditEvent[];
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed;
  } catch {
    return [];
  }
};

const persistSensitiveAuditEvents = (events: SensitiveAuditEvent[]) => {
  if (!hasStorage()) {
    memoryStore = events;
    return;
  }

  window.localStorage.setItem(storageKey, JSON.stringify(events));
};

export const appendSensitiveAuditEvent = (
  event: Omit<SensitiveAuditEvent, 'id' | 'createdAt'>
): SensitiveAuditEvent => {
  const nextEvent: SensitiveAuditEvent = {
    id: `audit-${crypto.randomUUID()}`,
    createdAt: new Date().toISOString(),
    ...event
  };

  const current = listSensitiveAuditEvents();
  const next = [nextEvent, ...current].slice(0, 200);
  persistSensitiveAuditEvents(next);

  return nextEvent;
};

export const clearSensitiveAuditEvents = () => {
  persistSensitiveAuditEvents([]);
};
