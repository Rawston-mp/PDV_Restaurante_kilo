import type { Client } from '@/modules/clients/domain/entities/Client';
import type { ClientRepository } from '@/modules/clients/domain/ports/ClientRepository';
import { pdvDatabase } from '@/shared/infrastructure/db/PdvDatabase';

export class DexieClientRepository implements ClientRepository {
  async findById(id: string): Promise<Client | null> {
    const client = await pdvDatabase.clients.get(id);
    return client ?? null;
  }

  async list(): Promise<Client[]> {
    return pdvDatabase.clients.toArray();
  }

  async save(client: Client): Promise<void> {
    await pdvDatabase.clients.put(client);
  }

  async delete(id: string): Promise<void> {
    await pdvDatabase.clients.delete(id);
  }
}
