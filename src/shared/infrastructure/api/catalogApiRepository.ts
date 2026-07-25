import { API_BASE_URL } from '@/shared/infrastructure/api/runtimeEndpoint';

type BaseEntity = {
  id: string;
  name?: string;
  fullName?: string;
  legalName?: string;
  tradeName?: string;
  updatedAt: Date;
  createdAt: Date;
};

type Repository<T extends BaseEntity> = {
  findById(id: string): Promise<T | null>;
  list(): Promise<T[]>;
  save(entity: T): Promise<void>;
  delete(id: string): Promise<void>;
};

type ApiRecord = {
  id: string;
  data?: Record<string, unknown>;
  createdAt?: string;
  updatedAt?: string;
};

type CatalogResponse = {
  ok: boolean;
  records?: ApiRecord[];
  record?: ApiRecord;
  message?: string;
};

const endpoint = (path: string) => `${API_BASE_URL}${path}`;

const readCatalogResponse = async (response: Response): Promise<CatalogResponse> => {
  const contentType = response.headers.get('content-type') ?? '';
  if (!contentType.toLowerCase().includes('application/json')) {
    const preview = (await response.text()).slice(0, 80).replace(/\s+/g, ' ').trim();
    throw new Error(
      `Endpoint de cadastros retornou resposta inválida (${response.url || 'URL desconhecida'}): ${preview || 'sem conteúdo'}`
    );
  }

  return response.json() as Promise<CatalogResponse>;
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

const toEntity = <T extends BaseEntity>(record: ApiRecord): T => {
  const data = (record.data ?? {}) as Partial<T>;
  return {
    ...data,
    id: record.id,
    createdAt: toDate(data.createdAt ?? record.createdAt),
    updatedAt: toDate(data.updatedAt ?? record.updatedAt)
  } as T;
};

const isNewer = <T extends BaseEntity>(left: T, right: T) =>
  toDate(left.updatedAt).getTime() > toDate(right.updatedAt).getTime();

const sortByName = <T extends BaseEntity>(entities: T[]) =>
  [...entities].sort((left, right) => {
    const leftName = left.name ?? left.fullName ?? left.legalName ?? left.tradeName ?? '';
    const rightName = right.name ?? right.fullName ?? right.legalName ?? right.tradeName ?? '';
    return leftName.localeCompare(rightName, 'pt-BR', { numeric: true });
  });

export class ApiBackedCatalogRepository<T extends BaseEntity> implements Repository<T> {
  constructor(
    private readonly catalogEntity: string,
    private readonly localRepository: Repository<T>
  ) {}

  async findById(id: string): Promise<T | null> {
    try {
      const response = await fetch(endpoint(`/api/v1/catalog/${this.catalogEntity}/${encodeURIComponent(id)}`));
      if (!response.ok) {
        throw new Error('Cadastro não encontrado no backend.');
      }

      const payload = await readCatalogResponse(response);
      if (!payload.record) {
        return null;
      }

      const entity = toEntity<T>(payload.record);
      await this.localRepository.save(entity);
      return entity;
    } catch {
      return this.localRepository.findById(id);
    }
  }

  async list(): Promise<T[]> {
    const localEntities = await this.localRepository.list();

    try {
      const response = await fetch(endpoint(`/api/v1/catalog/${this.catalogEntity}`));
      if (!response.ok) {
        throw new Error('Backend de cadastros indisponível.');
      }

      const payload = await readCatalogResponse(response);
      const remoteEntities = (payload.records ?? []).map(toEntity<T>);
      const merged = this.mergeByFreshness(localEntities, remoteEntities);

      await Promise.all(merged.map((entity) => this.localRepository.save(entity)));
      await Promise.all(
        merged
          .filter((entity) => {
            const remote = remoteEntities.find((candidate) => candidate.id === entity.id);
            return !remote || isNewer(entity, remote);
          })
          .map((entity) => this.push(entity))
      );

      return sortByName(merged);
    } catch {
      return sortByName(localEntities);
    }
  }

  async save(entity: T): Promise<void> {
    await this.localRepository.save(entity);

    try {
      const saved = await this.push(entity);
      await this.localRepository.save(saved);
    } catch {
      // O cadastro local continua válido para operação offline/temporária.
    }
  }

  async delete(id: string): Promise<void> {
    await this.localRepository.delete(id);

    try {
      await fetch(endpoint(`/api/v1/catalog/${this.catalogEntity}/${encodeURIComponent(id)}`), {
        method: 'DELETE'
      });
    } catch {
      // Exclusão remota será resolvida em sincronização futura.
    }
  }

  private mergeByFreshness(localEntities: T[], remoteEntities: T[]) {
    const byId = new Map<string, T>();

    for (const entity of remoteEntities) {
      byId.set(entity.id, entity);
    }

    for (const entity of localEntities) {
      const current = byId.get(entity.id);
      if (!current || isNewer(entity, current)) {
        byId.set(entity.id, entity);
      }
    }

    return [...byId.values()];
  }

  private async push(entity: T): Promise<T> {
    const response = await fetch(endpoint(`/api/v1/catalog/${this.catalogEntity}/${encodeURIComponent(entity.id)}`), {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ record: entity })
    });
    const payload = await readCatalogResponse(response);

    if (!response.ok || !payload.record) {
      throw new Error(payload.message ?? 'Falha ao salvar cadastro no backend.');
    }

    return toEntity<T>(payload.record);
  }
}
