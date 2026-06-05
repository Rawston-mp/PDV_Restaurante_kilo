import { CreateConvenio } from '@/modules/convenios/application/use-cases/CreateConvenio';
import { DexieConvenioRepository } from '@/modules/convenios/infrastructure/repositories/DexieConvenioRepository';

const convenioRepository = new DexieConvenioRepository();

export const conveniosContainer = {
  convenioRepository,
  createConvenio: new CreateConvenio(convenioRepository)
};
