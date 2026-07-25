import { CreateConvenio } from '@/modules/convenios/application/use-cases/CreateConvenio';
import { DexieConvenioRepository } from '@/modules/convenios/infrastructure/repositories/DexieConvenioRepository';
import { ApiBackedCatalogRepository } from '@/shared/infrastructure/api/catalogApiRepository';

const convenioRepository = new ApiBackedCatalogRepository('convenios', new DexieConvenioRepository());

export const conveniosContainer = {
  convenioRepository,
  createConvenio: new CreateConvenio(convenioRepository)
};
