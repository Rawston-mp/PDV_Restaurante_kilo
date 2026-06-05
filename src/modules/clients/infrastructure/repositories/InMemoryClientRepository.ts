import type { Client } from '@/modules/clients/domain/entities/Client';
import type { ClientRepository } from '@/modules/clients/domain/ports/ClientRepository';

export class InMemoryClientRepository implements ClientRepository {
  private readonly clients = new Map<string, Client>();

  async findById(id: string): Promise<Client | null> {
    return this.clients.get(id) ?? null;
  }

  async list(): Promise<Client[]> {
    return Array.from(this.clients.values());
  }

  async save(client: Client): Promise<void> {
    this.clients.set(client.id, client);
  }

  async delete(id: string): Promise<void> {
    this.clients.delete(id);
  }
}
