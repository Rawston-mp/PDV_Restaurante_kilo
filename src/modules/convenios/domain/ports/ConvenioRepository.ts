import type { Convenio } from '@/modules/convenios/domain/entities/Convenio';

export interface ConvenioRepository {
  findById(id: string): Promise<Convenio | null>;
  list(): Promise<Convenio[]>;
  save(convenio: Convenio): Promise<void>;
  delete(id: string): Promise<void>;
}
