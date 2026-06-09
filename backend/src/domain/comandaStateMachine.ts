export type ComandaStatus =
  | 'ABERTA'
  | 'PESAGEM_EM_ANDAMENTO'
  | 'PRONTA_PARA_CAIXA'
  | 'ENCERRADA'
  | 'FINALIZADA'
  | 'ARQUIVADA';

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

const transitionMap: Record<ComandaStatus, ComandaStatus[]> = {
  ABERTA: ['PESAGEM_EM_ANDAMENTO'],
  PESAGEM_EM_ANDAMENTO: ['PESAGEM_EM_ANDAMENTO', 'PRONTA_PARA_CAIXA'],
  PRONTA_PARA_CAIXA: ['ENCERRADA'],
  ENCERRADA: ['FINALIZADA'],
  FINALIZADA: ['ARQUIVADA'],
  ARQUIVADA: []
};

const canTransition = (from: ComandaStatus, to: ComandaStatus) => transitionMap[from].includes(to);

const nowIso = () => new Date().toISOString();

export class ComandaStateMachineService {
  private readonly comandas = new Map<string, ComandaRecord>();
  private activeComandaNumero: string | null = null;

  loadSnapshot(snapshot: ComandaStateSnapshot) {
    this.comandas.clear();
    for (const comanda of snapshot.comandas) {
      this.comandas.set(comanda.numero, comanda);
    }

    this.activeComandaNumero = snapshot.activeComandaNumero;
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

      if (existing.status === 'FINALIZADA') {
        throw new Error('Comanda finalizada nao pode ser reaberta.');
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

    if (to === 'ENCERRADA' || to === 'FINALIZADA' || to === 'ARQUIVADA') {
      if (this.activeComandaNumero === normalized) {
        this.activeComandaNumero = null;
      }
    }

    return updated;
  }

  markPesagemEmAndamento(numero: string, reason = 'peso_recebido') {
    const existing = this.get(numero);
    if (!existing) {
      throw new Error('Comanda nao encontrada.');
    }

    if (existing.status === 'ABERTA') {
      return this.transition(numero, 'PESAGEM_EM_ANDAMENTO', reason);
    }

    if (existing.status === 'PESAGEM_EM_ANDAMENTO') {
      return existing;
    }

    throw new Error(`Comanda em status ${existing.status} nao aceita pesagem.`);
  }

  canEmitWeight() {
    const active = this.getActive();
    if (!active) {
      return false;
    }

    return active.status === 'ABERTA' || active.status === 'PESAGEM_EM_ANDAMENTO';
  }
}
