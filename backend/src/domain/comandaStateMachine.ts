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
  owner?: ComandaLockOwner;
  stationId?: ComandaLockStationId;
  itemId?: string;
  productName?: string;
  createdAt: string;
};

export type ComandaPesagemInput = {
  id?: string;
  peso: number;
  origem?: string;
  owner?: ComandaLockOwner;
  stationId?: ComandaLockStationId;
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

    const owner = pesagem.owner === 'COMANDA_A' || pesagem.owner === 'COMANDA_B' ? pesagem.owner : undefined;
    const stationId = pesagem.stationId === 'BALANCA_A' || pesagem.stationId === 'BALANCA_B' ? pesagem.stationId : undefined;

    acc.push({
      id: normalizeText(pesagem.id) || buildGeneratedId('pesagem'),
      peso: Number(peso.toFixed(3)),
      origem: normalizeText(pesagem.origem) || undefined,
      owner,
      stationId,
      itemId: normalizeText(pesagem.itemId) || undefined,
      productName: normalizeText(pesagem.productName) || undefined,
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
      if (existing.status === 'ARQUIVADA') {
        throw new Error('A comanda arquivada não pode ser reaberta.');
      }

      if (existing.status === 'FECHADA_ORCAMENTO' || existing.status === 'FECHADA_VENDA') {
        throw new Error('A comanda fechada não pode receber novos itens.');
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

  markEmUsoBalanca(numero: string, reason = 'peso_recebido') {
    const existing = this.get(numero);
    if (!existing) {
      throw new Error('Comanda não encontrada.');
    }

    if (existing.status === 'ABERTA') {
      return this.transition(numero, 'EM_USO_BALANCA', reason);
    }

    if (existing.status === 'EM_USO_BALANCA') {
      return existing;
    }

    throw new Error(`Comanda em status ${existing.status} não aceita pesagem.`);
  }

  markPesagemEmAndamento(numero: string, reason = 'peso_recebido') {
    return this.markEmUsoBalanca(numero, reason);
  }

  setItems(numero: string, items: ComandaItemRecord[], _reason = 'items_sync') {
    const existing = this.get(numero);
    if (!existing) {
      throw new Error('Comanda não encontrada.');
    }

    ensureMutableItemsStatus(existing.status);

    const updatedAt = nowIso();
    const normalizedItems = normalizeComandaItems(items).map((item) => ({
      ...item,
      createdAt: item.createdAt ?? updatedAt,
      updatedAt
    }));

    const updated: ComandaRecord = {
      ...existing,
      items: normalizedItems,
      updatedAt
    };

    this.comandas.set(updated.numero, updated);

    return updated;
  }

  addItem(numero: string, item: ComandaItemRecord, reason = 'item_added') {
    const existing = this.get(numero);
    if (!existing) {
      throw new Error('Comanda não encontrada.');
    }

    ensureMutableItemsStatus(existing.status);

    const normalizedItems = normalizeComandaItems([item]);
    if (normalizedItems.length === 0) {
      throw new Error('Item da comanda inválido.');
    }

    return this.setItems(numero, [normalizedItems[0], ...existing.items], reason);
  }

  recordPesagem(numero: string, input: ComandaPesagemInput) {
    const peso = normalizeFiniteNumber(input.peso);
    if (peso === null || peso <= 0) {
      throw new Error('Peso da pesagem deve ser maior que zero.');
    }

    const record = this.markEmUsoBalanca(numero, input.reason ?? 'pesagem_registrada');
    const createdAt = nowIso();
    const pesagem: ComandaPesagemRecord = {
      id: normalizeText(input.id) || buildGeneratedId('pesagem'),
      peso: Number(peso.toFixed(3)),
      origem: normalizeText(input.origem) || undefined,
      owner: input.owner,
      stationId: input.stationId,
      itemId: normalizeText(input.itemId) || undefined,
      productName: normalizeText(input.productName) || undefined,
      createdAt
    };

    const updated: ComandaRecord = {
      ...record,
      pesagens: [pesagem, ...record.pesagens],
      updatedAt: createdAt
    };

    this.comandas.set(updated.numero, updated);

    return {
      comanda: updated,
      pesagem
    };
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
      throw new Error('Comanda não encontrada.');
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
      throw new Error('Comanda não encontrada.');
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
      throw new Error('Comanda não encontrada.');
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
