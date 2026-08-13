import type { NfceNumberControl, NfceNumberControlInput } from '../entities/NfceNumberControl';

export interface NfceNumberControlRepository {
  findByCnpjAmbienteSerie(input: NfceNumberControlInput): Promise<NfceNumberControl | null>;
  save(control: NfceNumberControl): Promise<void>;
  incrementNumero(id: string): Promise<string>; // Retorna o próximo número gerado
}
