export type ComandaStatus =
  | 'ABERTA'
  | 'EM_USO_BALANCA'
  | 'PRONTA_PARA_CAIXA'
  | 'EM_FECHAMENTO'
  | 'FECHADA_ORCAMENTO'
  | 'FECHADA_VENDA'
  | 'CANCELADA'
  | 'ARQUIVADA';

export type ComandaLockOwner = 'COMANDA_A' | 'COMANDA_B';

export type ComandaLockStationId = 'BALANCA_A' | 'BALANCA_B';

export type ComandaLock = {
  owner: ComandaLockOwner;
  stationId: ComandaLockStationId;
  acquiredAt: string;
  heartbeatAt: string;
  expiresAt: string;
};

type LegacyComandaStatus = 'PESAGEM_EM_ANDAMENTO' | 'ENCERRADA' | 'FINALIZADA';

export type ComandaTransition = {
  from: ComandaStatus;
  to: ComandaStatus;
  at: string;
  reason?: string;
};

export type ComandaRecord = {
  numero: string;
  status: ComandaStatus;
  createdAt: string;
  updatedAt: string;
  lock: ComandaLock | null;
  transitions: ComandaTransition[];
};

export type ComandaStateSnapshot = {
  activeComandaNumero: string | null;
  comandas: ComandaRecord[];
  updatedAt: string;
};

export const COMANDA_STATUSES: ComandaStatus[] = [
  'ABERTA',
  'EM_USO_BALANCA',
  'PRONTA_PARA_CAIXA',
  'EM_FECHAMENTO',
  'FECHADA_ORCAMENTO',
  'FECHADA_VENDA',
  'CANCELADA',
  'ARQUIVADA'
];

const transitionMap: Record<ComandaStatus, ComandaStatus[]> = {
  ABERTA: ['EM_USO_BALANCA', 'PRONTA_PARA_CAIXA', 'CANCELADA'],
  EM_USO_BALANCA: ['EM_USO_BALANCA', 'PRONTA_PARA_CAIXA', 'CANCELADA'],
  PRONTA_PARA_CAIXA: ['EM_FECHAMENTO', 'CANCELADA'],
  EM_FECHAMENTO: ['FECHADA_ORCAMENTO', 'FECHADA_VENDA', 'PRONTA_PARA_CAIXA', 'CANCELADA'],
  FECHADA_ORCAMENTO: ['ARQUIVADA'],
  FECHADA_VENDA: ['ARQUIVADA'],
  CANCELADA: ['ARQUIVADA'],
  ARQUIVADA: []
};

const canTransition = (from: ComandaStatus, to: ComandaStatus) => transitionMap[from].includes(to);

const nowIso = () => new Date().toISOString();

const DEFAULT_LOCK_TTL_SECONDS = 120;

const parseIsoTime = (value: string) => {
  const time = Date.parse(value);
  return Number.isNaN(time) ? null : time;
};

const isLockExpired = (lock: ComandaLock, nowMs = Date.now()) => {
  const expiresAt = parseIsoTime(lock.expiresAt);
  return expiresAt === null || expiresAt <= nowMs;
};

const sanitizeTtl = (ttlSeconds?: number) => {
  if (typeof ttlSeconds !== 'number' || !Number.isFinite(ttlSeconds) || ttlSeconds <= 0) {
    return DEFAULT_LOCK_TTL_SECONDS;
  }

  return Math.min(Math.floor(ttlSeconds), 900);
};

const legacyStatusMap: Record<LegacyComandaStatus, ComandaStatus> = {
  PESAGEM_EM_ANDAMENTO: 'EM_USO_BALANCA',
  ENCERRADA: 'FECHADA_VENDA',
  FINALIZADA: 'FECHADA_VENDA'
};

const normalizeStatus = (status: ComandaStatus | LegacyComandaStatus): ComandaStatus =>
  legacyStatusMap[status as LegacyComandaStatus] ?? (status as ComandaStatus);

const isInactiveStatus = (status: ComandaStatus) =>
  status === 'FECHADA_ORCAMENTO' || status === 'FECHADA_VENDA' || status === 'CANCELADA' || status === 'ARQUIVADA';

const normalizeLock = (lock: ComandaRecord['lock']): ComandaRecord['lock'] => {
  if (!lock) {
    return null;
  }

  const lockOwner = lock.owner?.toUpperCase();
  const stationId = lock.stationId?.toUpperCase();

  if ((lockOwner !== 'COMANDA_A' && lockOwner !== 'COMANDA_B') || (stationId !== 'BALANCA_A' && stationId !== 'BALANCA_B')) {
    return null;
  }

  const acquiredAt = lock.acquiredAt || nowIso();
  const heartbeatAt = lock.heartbeatAt || acquiredAt;
  const expiresAt = lock.expiresAt || heartbeatAt;

  return {
    owner: lockOwner,
    stationId,
    acquiredAt,
    heartbeatAt,
    expiresAt
  } as ComandaLock;
};

const buildLock = (owner: ComandaLockOwner, stationId: ComandaLockStationId, ttlSeconds?: number): ComandaLock => {
  const acquiredAt = nowIso();
  const ttl = sanitizeTtl(ttlSeconds);
  const expiresAt = new Date(Date.now() + ttl * 1000).toISOString();

  return {
    owner,
    stationId,
    acquiredAt,
    heartbeatAt: acquiredAt,
    expiresAt
  };
};

const refreshLock = (lock: ComandaLock, ttlSeconds?: number): ComandaLock => {
  const heartbeatAt = nowIso();
  const ttl = sanitizeTtl(ttlSeconds);
  const expiresAt = new Date(Date.now() + ttl * 1000).toISOString();

  return {
    ...lock,
    heartbeatAt,
    expiresAt
  };
};

export class ComandaLockConflictError extends Error {
  readonly lock: ComandaLock;

  constructor(lock: ComandaLock) {
    super('Comanda ja esta em uso por outra balanca.');
    this.name = 'ComandaLockConflictError';
    this.lock = lock;
  }
}

export class ComandaLockOwnershipError extends Error {
  constructor() {
    super('Lock da comanda pertence a outra estacao.');
    this.name = 'ComandaLockOwnershipError';
  }
}

export class ComandaLockNotFoundError extends Error {
  constructor() {
    super('Comanda sem lock ativo.');
    this.name = 'ComandaLockNotFoundError';
  }
}

export class ComandaStateMachineService {
  private readonly comandas = new Map<string, ComandaRecord>();
  private activeComandaNumero: string | null = null;

  private clearExpiredLock(record: ComandaRecord) {
    if (!record.lock || !isLockExpired(record.lock)) {
      return { record, expired: false };
    }

    const updated: ComandaRecord = {
      ...record,
      lock: null,
      updatedAt: nowIso()
    };

    this.comandas.set(updated.numero, updated);

    return { record: updated, expired: true };
  }

  loadSnapshot(snapshot: ComandaStateSnapshot) {
    this.comandas.clear();
    for (const comanda of snapshot.comandas) {
      const normalizedComanda: ComandaRecord = {
        ...comanda,
        status: normalizeStatus(comanda.status),
        lock: normalizeLock(comanda.lock ?? null),
        transitions: comanda.transitions.map((transition) => ({
          ...transition,
          from: normalizeStatus(transition.from),
          to: normalizeStatus(transition.to)
        }))
      };

      this.comandas.set(normalizedComanda.numero, normalizedComanda);
    }

    const activeComanda = snapshot.activeComandaNumero
      ? this.comandas.get(snapshot.activeComandaNumero)
      : null;
    this.activeComandaNumero = activeComanda && !isInactiveStatus(activeComanda.status)
      ? activeComanda.numero
      : null;
  }

  snapshot(): ComandaStateSnapshot {
    return {
      activeComandaNumero: this.activeComandaNumero,
      comandas: [...this.comandas.values()],
      updatedAt: nowIso()
    };
  }

  open(numero: string) {
    const normalized = numero.trim();
    if (!normalized) {
      throw new Error('Numero da comanda e obrigatorio.');
    }

    const existing = this.comandas.get(normalized);
    if (existing) {
      if (existing.status === 'ARQUIVADA') {
        throw new Error('Comanda arquivada nao pode ser reaberta.');
      }

      if (existing.status === 'FECHADA_ORCAMENTO' || existing.status === 'FECHADA_VENDA') {
        throw new Error('Comanda fechada nao pode receber novos itens.');
      }

      if (existing.status === 'CANCELADA') {
        throw new Error('Comanda cancelada nao pode ser reaberta sem autorizacao.');
      }

      this.activeComandaNumero = normalized;
      return existing;
    }

    const createdAt = nowIso();
    const created: ComandaRecord = {
      numero: normalized,
      status: 'ABERTA',
      createdAt,
      updatedAt: createdAt,
      lock: null,
      transitions: []
    };

    this.comandas.set(normalized, created);
    this.activeComandaNumero = normalized;

    return created;
  }

  get(numero: string) {
    const existing = this.comandas.get(numero.trim()) ?? null;
    if (!existing) {
      return null;
    }

    return this.clearExpiredLock(existing).record;
  }

  getActive() {
    if (!this.activeComandaNumero) {
      return null;
    }

    return this.comandas.get(this.activeComandaNumero) ?? null;
  }

  getAll() {
    return [...this.comandas.values()];
  }

  deactivateActive() {
    this.activeComandaNumero = null;
  }

  transition(numero: string, to: ComandaStatus, reason?: string) {
    const normalized = numero.trim();
    const existing = this.comandas.get(normalized);
    if (!existing) {
      throw new Error('Comanda nao encontrada.');
    }

    const { record } = this.clearExpiredLock(existing);

    if (!canTransition(record.status, to)) {
      throw new Error(`Transicao invalida: ${record.status} -> ${to}.`);
    }

    const at = nowIso();
    const updated: ComandaRecord = {
      ...record,
      status: to,
      updatedAt: at,
      lock: isInactiveStatus(to) ? null : record.lock,
      transitions: [
        ...record.transitions,
        {
          from: record.status,
          to,
          at,
          reason
        }
      ]
    };

    this.comandas.set(normalized, updated);

    if (isInactiveStatus(to)) {
      if (this.activeComandaNumero === normalized) {
        this.activeComandaNumero = null;
      }
    }

    return updated;
  }

  markEmUsoBalanca(numero: string, reason = 'peso_recebido') {
    const existing = this.get(numero);
    if (!existing) {
      throw new Error('Comanda nao encontrada.');
    }

    if (existing.status === 'ABERTA') {
      return this.transition(numero, 'EM_USO_BALANCA', reason);
    }

    if (existing.status === 'EM_USO_BALANCA') {
      return existing;
    }

    throw new Error(`Comanda em status ${existing.status} nao aceita pesagem.`);
  }

  markPesagemEmAndamento(numero: string, reason = 'peso_recebido') {
    return this.markEmUsoBalanca(numero, reason);
  }

  acquireLock(
    numero: string,
    params: {
      owner: ComandaLockOwner;
      stationId: ComandaLockStationId;
      ttlSeconds?: number;
    }
  ) {
    const existing = this.get(numero);
    if (!existing) {
      throw new Error('Comanda nao encontrada.');
    }

    const { owner, stationId, ttlSeconds } = params;
    const { record, expired } = this.clearExpiredLock(existing);

    if (record.lock) {
      if (record.lock.owner === owner && record.lock.stationId === stationId) {
        const renewedLock = refreshLock(record.lock, ttlSeconds);
        const renewedRecord: ComandaRecord = {
          ...record,
          lock: renewedLock,
          updatedAt: renewedLock.heartbeatAt
        };

        this.comandas.set(renewedRecord.numero, renewedRecord);

        return {
          comanda: renewedRecord,
          lock: renewedLock,
          expiredPreviousLock: expired
        };
      }

      throw new ComandaLockConflictError(record.lock);
    }

    const lock = buildLock(owner, stationId, ttlSeconds);
    const updated: ComandaRecord = {
      ...record,
      lock,
      updatedAt: lock.heartbeatAt
    };

    this.comandas.set(updated.numero, updated);

    return {
      comanda: updated,
      lock,
      expiredPreviousLock: expired
    };
  }

  renewLock(
    numero: string,
    params: {
      owner: ComandaLockOwner;
      stationId: ComandaLockStationId;
      ttlSeconds?: number;
    }
  ) {
    const existing = this.get(numero);
    if (!existing) {
      throw new Error('Comanda nao encontrada.');
    }

    const { owner, stationId, ttlSeconds } = params;
    const { record } = this.clearExpiredLock(existing);

    if (!record.lock) {
      throw new ComandaLockNotFoundError();
    }

    if (record.lock.owner !== owner || record.lock.stationId !== stationId) {
      throw new ComandaLockOwnershipError();
    }

    const lock = refreshLock(record.lock, ttlSeconds);
    const updated: ComandaRecord = {
      ...record,
      lock,
      updatedAt: lock.heartbeatAt
    };

    this.comandas.set(updated.numero, updated);

    return {
      comanda: updated,
      lock
    };
  }

  releaseLock(
    numero: string,
    params: {
      owner: ComandaLockOwner;
      stationId: ComandaLockStationId;
    }
  ) {
    const existing = this.get(numero);
    if (!existing) {
      throw new Error('Comanda nao encontrada.');
    }

    const { owner, stationId } = params;
    const { record } = this.clearExpiredLock(existing);

    if (!record.lock) {
      throw new ComandaLockNotFoundError();
    }

    if (record.lock.owner !== owner || record.lock.stationId !== stationId) {
      throw new ComandaLockOwnershipError();
    }

    const updated: ComandaRecord = {
      ...record,
      lock: null,
      updatedAt: nowIso()
    };

    this.comandas.set(updated.numero, updated);

    return updated;
  }

  canEmitWeight() {
    const active = this.getActive();
    if (!active) {
      return false;
    }

    return active.status === 'ABERTA' || active.status === 'EM_USO_BALANCA';
  }
}
