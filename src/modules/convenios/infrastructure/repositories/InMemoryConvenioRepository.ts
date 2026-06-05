import type { Convenio } from '@/modules/convenios/domain/entities/Convenio';
import type { ConvenioRepository } from '@/modules/convenios/domain/ports/ConvenioRepository';

export class InMemoryConvenioRepository implements ConvenioRepository {
  private readonly convenios = new Map<string, Convenio>();

  async findById(id: string): Promise<Convenio | null> {
    return this.convenios.get(id) ?? null;
  }

  async list(): Promise<Convenio[]> {
    return Array.from(this.convenios.values());
  }

  async save(convenio: Convenio): Promise<void> {
    this.convenios.set(convenio.id, convenio);
  }

  async delete(id: string): Promise<void> {
    this.convenios.delete(id);
  }
}
