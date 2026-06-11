export type ComandaStatus =
  | 'ABERTA'
  | 'EM_USO_BALANCA'
  | 'PRONTA_PARA_CAIXA'
  | 'EM_FECHAMENTO'
  | 'FECHADA_ORCAMENTO'
  | 'FECHADA_VENDA'
  | 'CANCELADA'
  | 'ARQUIVADA';

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

const legacyStatusMap: Record<LegacyComandaStatus, ComandaStatus> = {
  PESAGEM_EM_ANDAMENTO: 'EM_USO_BALANCA',
  ENCERRADA: 'FECHADA_VENDA',
  FINALIZADA: 'FECHADA_VENDA'
};

const normalizeStatus = (status: ComandaStatus | LegacyComandaStatus): ComandaStatus =>
  legacyStatusMap[status as LegacyComandaStatus] ?? (status as ComandaStatus);

const isInactiveStatus = (status: ComandaStatus) =>
  status === 'FECHADA_ORCAMENTO' || status === 'FECHADA_VENDA' || status === 'CANCELADA' || status === 'ARQUIVADA';

export class ComandaStateMachineService {
  private readonly comandas = new Map<string, ComandaRecord>();
  private activeComandaNumero: string | null = null;

  loadSnapshot(snapshot: ComandaStateSnapshot) {
    this.comandas.clear();
    for (const comanda of snapshot.comandas) {
      const normalizedComanda: ComandaRecord = {
        ...comanda,
        status: normalizeStatus(comanda.status),
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
      transitions: []
    };

    this.comandas.set(normalized, created);
    this.activeComandaNumero = normalized;

    return created;
  }

  get(numero: string) {
    return this.comandas.get(numero.trim()) ?? null;
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

    if (!canTransition(existing.status, to)) {
      throw new Error(`Transicao invalida: ${existing.status} -> ${to}.`);
    }

    const at = nowIso();
    const updated: ComandaRecord = {
      ...existing,
      status: to,
      updatedAt: at,
      transitions: [
        ...existing.transitions,
        {
          from: existing.status,
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

  canEmitWeight() {
    const active = this.getActive();
    if (!active) {
      return false;
    }

    return active.status === 'ABERTA' || active.status === 'EM_USO_BALANCA';
  }
}
