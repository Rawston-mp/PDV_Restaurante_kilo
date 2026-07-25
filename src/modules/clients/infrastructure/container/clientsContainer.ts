import { CreateClient } from '@/modules/clients/application/use-cases/CreateClient';
import { DexieClientRepository } from '@/modules/clients/infrastructure/repositories/DexieClientRepository';
import { ApiBackedCatalogRepository } from '@/shared/infrastructure/api/catalogApiRepository';

const clientRepository = new ApiBackedCatalogRepository('clients', new DexieClientRepository());

export const clientsContainer = {
  clientRepository,
  createClient: new CreateClient(clientRepository)
};
