import type { CashMovement } from '@/modules/finance/domain/entities/CashMovement';
import type { CashMovementRepository } from '@/modules/finance/domain/ports/CashMovementRepository';
import { API_BASE_URL } from '@/shared/infrastructure/api/runtimeEndpoint';

type ApiFinanceEntry = {
  id: string;
  finance_code?: string | null;
  movement_type?: string | null;
  category?: string | null;
  amount?: string | number | null;
  description?: string | null;
  convenio_id?: string | null;
  convenio_name?: string | null;
  payment_method?: string | null;
  launched_at?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  source_json?: Record<string, unknown> | null;
};

type FinanceResponse = {
  ok: boolean;
  entries?: ApiFinanceEntry[];
  entry?: ApiFinanceEntry;
  message?: string;
};

const endpoint = (path: string) => `${API_BASE_URL}${path}`;

const readFinanceResponse = async (response: Response): Promise<FinanceResponse> => {
  const contentType = response.headers.get('content-type') ?? '';
  if (!contentType.toLowerCase().includes('application/json')) {
    const preview = (await response.text()).slice(0, 80).replace(/\s+/g, ' ').trim();
    throw new Error(
      `Endpoint financeiro retornou resposta inválida (${response.url || 'URL desconhecida'}): ${preview || 'sem conteúdo'}`
    );
  }

  return response.json() as Promise<FinanceResponse>;
};

const toDate = (value: unknown) => {
  if (value instanceof Date) {
    return value;
  }

  if (typeof value === 'string' && value.trim()) {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed;
    }
  }

  return new Date();
};

const toNumber = (value: unknown) => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string' && value.trim()) {
    const normalized = value.includes(',')
      ? value.replace(/\./g, '').replace(',', '.')
      : value;
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  return 0;
};

const toCashMovement = (entry: ApiFinanceEntry): CashMovement => {
  const source = entry.source_json ?? {};
  return {
    id: entry.id,
    movementCode: String(source.movementCode ?? entry.finance_code ?? entry.id),
    movementType: entry.movement_type === 'SAIDA' ? 'SAIDA' : 'ENTRADA',
    category: String(entry.category ?? source.category ?? ''),
    amount: toNumber(entry.amount),
    description: String(entry.description ?? source.description ?? ''),
    launchedAt: toDate(entry.launched_at ?? source.launchedAt),
    convenioId: entry.convenio_id ? String(entry.convenio_id) : undefined,
    convenioName: entry.convenio_name ? String(entry.convenio_name) : undefined,
    paymentMethod: entry.payment_method ? String(entry.payment_method) : undefined,
    version: Number(source.version ?? 1),
    createdAt: toDate(entry.created_at ?? source.createdAt),
    updatedAt: toDate(entry.updated_at ?? source.updatedAt)
  };
};

const isNewer = (left: CashMovement, right: CashMovement) =>
  toDate(left.updatedAt).getTime() > toDate(right.updatedAt).getTime();

export class ApiBackedCashMovementRepository implements CashMovementRepository {
  constructor(private readonly localRepository: CashMovementRepository) {}

  async findById(id: string): Promise<CashMovement | null> {
    try {
      const response = await fetch(endpoint(`/api/v1/financeiro/${encodeURIComponent(id)}`));
      if (!response.ok) {
        throw new Error('Lançamento financeiro não encontrado no backend.');
      }

      const payload = await readFinanceResponse(response);
      if (!payload.entry) {
        return null;
      }

      const cashMovement = toCashMovement(payload.entry);
      await this.localRepository.save(cashMovement);
      return cashMovement;
    } catch {
      return this.localRepository.findById(id);
    }
  }

  async list(): Promise<CashMovement[]> {
    const localMovements = await this.localRepository.list();

    try {
      const response = await fetch(endpoint('/api/v1/financeiro'));
      if (!response.ok) {
        throw new Error('Backend financeiro indisponível.');
      }

      const payload = await readFinanceResponse(response);
      const remoteMovements = (payload.entries ?? []).map(toCashMovement);
      const merged = this.mergeByFreshness(localMovements, remoteMovements);

      await Promise.all(merged.map((movement) => this.localRepository.save(movement)));
      await Promise.all(
        merged
          .filter((movement) => {
            const remote = remoteMovements.find((candidate) => candidate.id === movement.id);
            return !remote || isNewer(movement, remote);
          })
          .map((movement) => this.push(movement))
      );

      return this.sort(merged);
    } catch {
      return this.sort(localMovements);
    }
  }

  async save(cashMovement: CashMovement): Promise<void> {
    await this.localRepository.save(cashMovement);

    try {
      const saved = await this.push(cashMovement);
      await this.localRepository.save(saved);
    } catch {
      // O lançamento local preserva a operação quando backend/banco estiver indisponível.
    }
  }

  async delete(id: string): Promise<void> {
    await this.localRepository.delete(id);

    try {
      await fetch(endpoint(`/api/v1/financeiro/${encodeURIComponent(id)}`), {
        method: 'DELETE'
      });
    } catch {
      // Exclusão remota será resolvida em sincronização futura.
    }
  }

  private mergeByFreshness(localMovements: CashMovement[], remoteMovements: CashMovement[]) {
    const byId = new Map<string, CashMovement>();

    for (const movement of remoteMovements) {
      byId.set(movement.id, movement);
    }

    for (const movement of localMovements) {
      const current = byId.get(movement.id);
      if (!current || isNewer(movement, current)) {
        byId.set(movement.id, movement);
      }
    }

    return [...byId.values()];
  }

  private sort(movements: CashMovement[]) {
    return [...movements].sort((left, right) => right.launchedAt.getTime() - left.launchedAt.getTime());
  }

  private async push(cashMovement: CashMovement): Promise<CashMovement> {
    const response = await fetch(endpoint('/api/v1/financeiro'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        id: cashMovement.id,
        financeCode: cashMovement.movementCode,
        tab: cashMovement.movementType === 'SAIDA' ? 'DESPESAS' : 'RECEITA',
        movementType: cashMovement.movementType,
        category: cashMovement.category,
        amount: cashMovement.amount,
        description: cashMovement.description,
        convenioId: cashMovement.convenioId,
        convenioName: cashMovement.convenioName,
        paymentMethod: cashMovement.paymentMethod,
        status: cashMovement.movementType === 'SAIDA' ? 'PAGO' : 'RECEBIDO',
        launchedAt: cashMovement.launchedAt.toISOString(),
        sourceJson: cashMovement
      })
    });
    const payload = await readFinanceResponse(response);

    if (!response.ok || !payload.entry) {
      throw new Error(payload.message ?? 'Falha ao salvar lançamento financeiro no backend.');
    }

    return toCashMovement(payload.entry);
  }
}
