import { CreateClient } from '@/modules/clients/application/use-cases/CreateClient';
import { DexieClientRepository } from '@/modules/clients/infrastructure/repositories/DexieClientRepository';

const clientRepository = new DexieClientRepository();

export const clientsContainer = {
  clientRepository,
  createClient: new CreateClient(clientRepository)
};
