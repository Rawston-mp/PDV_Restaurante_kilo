import type { Client } from '@/modules/clients/domain/entities/Client';

export interface ClientRepository {
  findById(id: string): Promise<Client | null>;
  list(): Promise<Client[]>;
  save(client: Client): Promise<void>;
  delete(id: string): Promise<void>;
}
