import type { NfceNumberControlRepository } from '../../domain/ports/NfceNumberControlRepository';
import type { NfceNumberControlInput } from '../../domain/entities/NfceNumberControl';

/**
 * GenerateNextNfceNumberUseCase
 *
 * Gera o próximo número de NFC-e de forma atômica.
 * Garante que não haja duplicidade de numeração mesmo em ambiente multi-terminal.
 */
export class GenerateNextNfceNumberUseCase {
  constructor(private repository: NfceNumberControlRepository) {}

  async execute(input: NfceNumberControlInput): Promise<string> {
    // Busca controle existente
    let control = await this.repository.findByCnpjAmbienteSerie(input);

    if (!control) {
      // Cria novo controle se não existir
      const now = new Date();
      control = {
        id: `${input.cnpj}-${input.ambiente}-${input.serie}`,
        cnpj: input.cnpj,
        ambiente: input.ambiente,
        serie: input.serie,
        ultimoNumero: '0',
        proximoNumero: '1',
        createdAt: now,
        updatedAt: now,
      };
      await this.repository.save(control);
      return '1';
    }

    // Incrementa de forma atômica
    const proximo = await this.repository.incrementNumero(control.id);
    return proximo;
  }
}
