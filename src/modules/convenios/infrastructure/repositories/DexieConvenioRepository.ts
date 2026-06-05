import type { Convenio } from '@/modules/convenios/domain/entities/Convenio';
import type { ConvenioRepository } from '@/modules/convenios/domain/ports/ConvenioRepository';
import { pdvDatabase } from '@/shared/infrastructure/db/PdvDatabase';

export class DexieConvenioRepository implements ConvenioRepository {
  async findById(id: string): Promise<Convenio | null> {
    const convenio = await pdvDatabase.convenios.get(id);
    return convenio ?? null;
  }

  async list(): Promise<Convenio[]> {
    return pdvDatabase.convenios.toArray();
  }

  async save(convenio: Convenio): Promise<void> {
    await pdvDatabase.convenios.put(convenio);
  }

  async delete(id: string): Promise<void> {
    await pdvDatabase.convenios.delete(id);
  }
}
