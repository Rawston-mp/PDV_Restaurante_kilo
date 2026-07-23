export type ComandaStatus =
  | 'ABERTA'
  | 'EM_USO_BALANCA'
  | 'PRONTA_PARA_CAIXA'
  | 'EM_FECHAMENTO'
  | 'FECHADA_ORCAMENTO'
  | 'FECHADA_VENDA'
  | 'CANCELADA'
  | 'ARQUIVADA';

export type ComandaLockStationId = 'BALANCA_A' | 'BALANCA_B';

export type ComandaLock = {
  stationId: ComandaLockStationId;
  acquiredAt: string;
  heartbeatAt: string;
  expiresAt: string;
  owner?: string;
};

type LegacyComandaStatus = 'PESAGEM_EM_ANDAMENTO' | 'ENCERRADA' | 'FINALIZADA';

export type ComandaTransition = {
  from: ComandaStatus;
  to: ComandaStatus;
  at: string;
  reason?: string;
};

export type ComandaItemRecord = {
  id: string;
  nome: string;
  precoUnitario: number;
  peso?: number;
  quantidade: number;
  categoriaId: string;
  subtotal: number;
  porUnidade: boolean;
  createdAt?: string;
  updatedAt?: string;
};

export type ComandaPesagemRecord = {
  id: string;
  peso: number;
  origem?: string;
  stationId?: ComandaLockStationId;
  owner?: string;
  itemId?: string;
  productName?: string;
  reason?: string;
  createdAt: string;
};

export type ComandaPesagemInput = {
  id?: string;
  peso: number;
  origem?: string;
  stationId?: ComandaLockStationId;
  owner?: string;
  itemId?: string;
  productName?: string;
  reason?: string;
};

export type ComandaRecord = {
  numero: string;
  status: ComandaStatus;
  createdAt: string;
  updatedAt: string;
  lock: ComandaLock | null;
  transitions: ComandaTransition[];
  items: ComandaItemRecord[];
  pesagens: ComandaPesagemRecord[];
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

const buildGeneratedId = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

const normalizeFiniteNumber = (value: unknown) => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string') {
    const parsed = Number(value.replace(',', '.'));
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return null;
};

const normalizeText = (value: unknown) => (typeof value === 'string' ? value.trim() : '');

const normalizeOptionalIso = (value: unknown) => {
  if (typeof value !== 'string') {
    return undefined;
  }

  return Number.isNaN(Date.parse(value)) ? undefined : value;
};

const normalizeComandaItems = (items: unknown): ComandaItemRecord[] => {
  if (!Array.isArray(items)) {
    return [];
  }

  return items.reduce<ComandaItemRecord[]>((acc, rawItem) => {
    if (typeof rawItem !== 'object' || rawItem === null) {
      return acc;
    }

    const item = rawItem as Partial<ComandaItemRecord>;
    const id = normalizeText(item.id);
    const nome = normalizeText(item.nome);
    const precoUnitario = normalizeFiniteNumber(item.precoUnitario);
    const quantidade = normalizeFiniteNumber(item.quantidade);

    if (!id || !nome || precoUnitario === null || quantidade === null || precoUnitario < 0 || quantidade <= 0) {
      return acc;
    }

    const peso = normalizeFiniteNumber(item.peso);
    const subtotal = normalizeFiniteNumber(item.subtotal) ?? Number((precoUnitario * quantidade).toFixed(2));

    acc.push({
      id,
      nome,
      precoUnitario,
      quantidade,
      peso: peso !== null && peso > 0 ? Number(peso.toFixed(3)) : undefined,
      categoriaId: normalizeText(item.categoriaId) || 'GERAL',
      subtotal: Number(subtotal.toFixed(2)),
      porUnidade: Boolean(item.porUnidade),
      createdAt: normalizeOptionalIso(item.createdAt),
      updatedAt: normalizeOptionalIso(item.updatedAt)
    });

    return acc;
  }, []);
};

const normalizeComandaPesagens = (pesagens: unknown): ComandaPesagemRecord[] => {
  if (!Array.isArray(pesagens)) {
    return [];
  }

  return pesagens.reduce<ComandaPesagemRecord[]>((acc, rawPesagem) => {
    if (typeof rawPesagem !== 'object' || rawPesagem === null) {
      return acc;
    }

    const pesagem = rawPesagem as Partial<ComandaPesagemRecord>;
    const peso = normalizeFiniteNumber(pesagem.peso);
    const createdAt = normalizeOptionalIso(pesagem.createdAt);

    if (peso === null || peso <= 0 || !createdAt) {
      return acc;
    }

    const stationId = pesagem.stationId === 'BALANCA_A' || pesagem.stationId === 'BALANCA_B' ? pesagem.stationId : undefined;

    acc.push({
      id: normalizeText(pesagem.id) || buildGeneratedId('pesagem'),
      peso: Number(peso.toFixed(3)),
      origem: normalizeText(pesagem.origem) || undefined,
      stationId,
      owner: normalizeText(pesagem.owner) || undefined,
      itemId: normalizeText(pesagem.itemId) || undefined,
      productName: normalizeText(pesagem.productName) || undefined,
      reason: normalizeText(pesagem.reason) || undefined,
      createdAt
    });

    return acc;
  }, []);
};

const ensureMutableItemsStatus = (status: ComandaStatus) => {
  if (isInactiveStatus(status) || status === 'EM_FECHAMENTO') {
    throw new Error(`Comanda em status ${status} não aceita alteração de itens.`);
  }
};

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

const isReusableClosedStatus = (status: ComandaStatus) =>
  status === 'FECHADA_ORCAMENTO' || status === 'FECHADA_VENDA' || status === 'ARQUIVADA';

const normalizeLock = (lock: ComandaRecord['lock']): ComandaRecord['lock'] => {
  if (!lock) {
    return null;
  }

  const stationId = lock.stationId?.toUpperCase();

  if (stationId !== 'BALANCA_A' && stationId !== 'BALANCA_B') {
    return null;
  }

  const acquiredAt = lock.acquiredAt || nowIso();
  const heartbeatAt = lock.heartbeatAt || acquiredAt;
  const expiresAt = lock.expiresAt || heartbeatAt;

  return {
    stationId,
    acquiredAt,
    heartbeatAt,
    expiresAt,
    owner: lock.owner
  } as ComandaLock;
};

const buildLock = (stationId: ComandaLockStationId, ttlSeconds?: number): ComandaLock => {
  const acquiredAt = nowIso();
  const ttl = sanitizeTtl(ttlSeconds);
  const expiresAt = new Date(Date.now() + ttl * 1000).toISOString();

  return {
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
    super('Comanda já está em uso por outra balança.');
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
        })),
        items: normalizeComandaItems((comanda as Partial<ComandaRecord>).items),
        pesagens: normalizeComandaPesagens((comanda as Partial<ComandaRecord>).pesagens)
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
      throw new Error('O número da comanda é obrigatório.');
    }

    const existing = this.comandas.get(normalized);
    if (existing) {
      if (isReusableClosedStatus(existing.status)) {
        const openedAt = nowIso();
        const reopened: ComandaRecord = {
          numero: normalized,
          status: 'ABERTA',
          createdAt: openedAt,
          updatedAt: openedAt,
          lock: null,
          transitions: [
            ...existing.transitions,
            {
              from: existing.status,
              to: 'ABERTA',
              at: openedAt,
              reason: 'reutilizacao_cartao_fisico'
            }
          ],
          items: [],
          pesagens: []
        };

        this.comandas.set(normalized, reopened);
        this.activeComandaNumero = normalized;
        return reopened;
      }

      if (existing.status === 'CANCELADA') {
        throw new Error('A comanda cancelada não pode ser reaberta sem autorização.');
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
      transitions: [],
      items: [],
      pesagens: []
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
      throw new Error('Comanda não encontrada.');
    }

    const { record } = this.clearExpiredLock(existing);

    if (!canTransition(record.status, to)) {
      throw new Error(`Transição inválida: ${record.status} -> ${to}.`);
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

  closeMany(
    numeros: string[],
    targetStatus: Extract<ComandaStatus, 'FECHADA_ORCAMENTO' | 'FECHADA_VENDA'>,
    reason?: string
  ) {
    const normalizedNumbers = [...new Set(numeros.map((numero) => numero.trim()).filter(Boolean))];
    if (normalizedNumbers.length === 0) {
      throw new Error('Informe ao menos uma comanda para fechamento.');
    }

    const plans = normalizedNumbers.map((numero) => {
      const record = this.get(numero);
      if (!record) {
        throw new Error(`Comanda #${numero} não encontrada.`);
      }

      let transitions: ComandaStatus[];
      switch (record.status) {
        case 'ABERTA':
        case 'EM_USO_BALANCA':
          transitions = ['PRONTA_PARA_CAIXA', 'EM_FECHAMENTO', targetStatus];
          break;
        case 'PRONTA_PARA_CAIXA':
          transitions = ['EM_FECHAMENTO', targetStatus];
          break;
        case 'EM_FECHAMENTO':
          transitions = [targetStatus];
          break;
        case targetStatus:
          transitions = [];
          break;
        default:
          throw new Error(`Comanda #${numero} em status ${record.status} não pode ser fechada como ${targetStatus}.`);
      }

      let currentStatus: ComandaStatus = record.status;
      for (const nextStatus of transitions) {
        if (!canTransition(currentStatus, nextStatus)) {
          throw new Error(`Transição inválida para a comanda #${numero}: ${currentStatus} -> ${nextStatus}.`);
        }
        currentStatus = nextStatus;
      }

      return { numero, transitions };
    });

    return plans.map((plan) => {
      for (const status of plan.transitions) {
        this.transition(plan.numero, status, reason);
      }
      return this.get(plan.numero)!;
    });
  }

  isActive(active: ComandaRecord) {
    return active.status === 'ABERTA' || active.status === 'EM_USO_BALANCA';
  }

  // Acquire a lock for a comanda. Throws if already locked by another owner/station.
  acquireLock(
    numero: string,
    lockInfo: { owner: string; stationId: ComandaLockStationId },
    ttlSeconds?: number
  ) {
    const record = this.get(numero);
    if (!record) {
      throw new Error(`Comanda ${numero} não encontrada.`);
    }
    const { record: freshRecord } = this.clearExpiredLock(record);
    if (freshRecord.lock) {
      if (freshRecord.lock.owner !== lockInfo.owner || freshRecord.lock.stationId !== lockInfo.stationId) {
        throw new ComandaLockConflictError(freshRecord.lock);
      }
      return freshRecord;
    }
    const lock = { ...buildLock(lockInfo.stationId, ttlSeconds), owner: lockInfo.owner };
    const updated: ComandaRecord = { ...freshRecord, lock, updatedAt: nowIso() };
    this.comandas.set(updated.numero, updated);
    return updated;
  }

  // Renew an existing lock for the same owner/station.
  renewLock(
    numero: string,
    lockInfo: { owner: string; stationId: ComandaLockStationId },
    ttlSeconds?: number
  ) {
    const record = this.get(numero);
    if (!record) {
      throw new Error(`Comanda ${numero} não encontrada.`);
    }
    const { record: freshRecord } = this.clearExpiredLock(record);
    if (!freshRecord.lock) {
      throw new ComandaLockNotFoundError();
    }
    if (freshRecord.lock.owner !== lockInfo.owner || freshRecord.lock.stationId !== lockInfo.stationId) {
      throw new ComandaLockOwnershipError();
    }
    const refreshed = refreshLock(freshRecord.lock, ttlSeconds);
    const lock = { ...refreshed, owner: lockInfo.owner };
    const updated: ComandaRecord = { ...freshRecord, lock, updatedAt: nowIso() };
    this.comandas.set(updated.numero, updated);
    return updated;
  }

  // Release a lock for the given owner/station.
  releaseLock(
    numero: string,
    lockInfo: { owner: string; stationId: ComandaLockStationId }
  ) {
    const record = this.get(numero);
    if (!record) {
      throw new Error(`Comanda ${numero} não encontrada.`);
    }
    const { record: freshRecord } = this.clearExpiredLock(record);
    if (!freshRecord.lock) {
      throw new ComandaLockNotFoundError();
    }
    if (freshRecord.lock.owner !== lockInfo.owner || freshRecord.lock.stationId !== lockInfo.stationId) {
      throw new ComandaLockOwnershipError();
    }
    const updated: ComandaRecord = { ...freshRecord, lock: null, updatedAt: nowIso() };
    this.comandas.set(updated.numero, updated);
    return updated;
  }

  // Set items for a comanda.
  setItems(numero: string, items: ComandaItemRecord[]) {
    const record = this.get(numero);
    if (!record) {
      throw new Error(`Comanda ${numero} não encontrada.`);
    }
    ensureMutableItemsStatus(record.status);
    const updated: ComandaRecord = { ...record, items, updatedAt: nowIso() };
    this.comandas.set(updated.numero, updated);
    return updated;
  }

  // Record a pesagem and put the comanda in use on a balança.
  recordPesagem(
    numero: string,
    pesagem: {
      peso: number;
      origem?: string;
      owner?: string;
      stationId?: ComandaLockStationId;
      itemId?: string;
      productName?: string;
      reason?: string;
      id?: string;
    }
  ) {
    const record = this.get(numero);
    if (!record) {
      throw new Error(`Comanda ${numero} não encontrada.`);
    }

    const newPesagem: ComandaPesagemRecord = {
      id: normalizeText(pesagem.id) || buildGeneratedId('pesagem'),
      peso: Number(normalizeFiniteNumber(pesagem.peso)!.toFixed(3)),
      origem: normalizeText(pesagem.origem) || undefined,
      stationId: pesagem.stationId,
      owner: normalizeText(pesagem.owner) || undefined,
      itemId: normalizeText(pesagem.itemId) || undefined,
      productName: normalizeText(pesagem.productName) || undefined,
      reason: normalizeText(pesagem.reason) || undefined,
      createdAt: nowIso()
    };

    // Ensure lock exists if owner and stationId are provided
    let lock = record.lock;
    if (pesagem.owner && pesagem.stationId) {
      if (!lock || lock.owner !== pesagem.owner || lock.stationId !== pesagem.stationId) {
        lock = { ...buildLock(pesagem.stationId), owner: pesagem.owner };
      }
    }

    const updated: ComandaRecord = {
      ...record,
      status: 'EM_USO_BALANCA',
      lock,
      pesagens: [...record.pesagens, newPesagem],
      updatedAt: nowIso()
    };
    this.comandas.set(updated.numero, updated);
    return { comanda: updated, pesagem: newPesagem };
  }

  // Convenience method to mark comanda in use on a balança (with cancellation guard).
  markEmUsoBalanca(numero: string, stationId?: string) {
    const record = this.get(numero);
    if (!record) {
      throw new Error(`Comanda ${numero} não encontrada.`);
    }
    if (record.status === 'CANCELADA') {
      throw new Error('Comanda em status CANCELADA não aceita pesagem.');
    }
    const updated: ComandaRecord = {
      ...record,
      status: 'EM_USO_BALANCA',
      lock: stationId
        ? {
            stationId: stationId.toUpperCase() as ComandaLockStationId,
            acquiredAt: nowIso(),
            heartbeatAt: nowIso(),
            expiresAt: nowIso()
          }
        : record.lock,
      updatedAt: nowIso()
    };
    this.comandas.set(updated.numero, updated);
    return updated;
  }
}
