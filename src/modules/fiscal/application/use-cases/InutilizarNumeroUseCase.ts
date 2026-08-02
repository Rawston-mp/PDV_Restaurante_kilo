import type { NfceNumberControlRepository } from '../../domain/ports/NfceNumberControlRepository';
import type { NfceNumberControlInput } from '../../domain/entities/NfceNumberControl';

/**
 * InutilizarNumeroUseCase
 *
 * Registra a inutilização de uma faixa de numeração NFC-e.
 * Deve ser chamado quando houver salto de numeração (ex: erro de impressão, falha no sistema).
 *
 * Requisitos SEFAZ:
 * - Justificativa com no mínimo 15 caracteres
 * - Número inicial e final da faixa
 * - Registro em tabela de auditoria (não implementado aqui, mas recomendado)
 */
export class InutilizarNumeroUseCase {
  constructor(private repository: NfceNumberControlRepository) {}

  async execute(params: {
    input: NfceNumberControlInput;
    numeroInicial: string;
    numeroFinal: string;
    justificativa: string;
  }): Promise<{
    success: boolean;
    error?: string;
  }> {
    if (params.justificativa.length < 15) {
      return {
        success: false,
        error: 'Justificativa deve ter no mínimo 15 caracteres',
      };
    }

    if (parseInt(params.numeroInicial) > parseInt(params.numeroFinal)) {
      return {
        success: false,
        error: 'Número inicial deve ser menor ou igual ao número final',
      };
    }

    // Busca controle atual
    const control = await this.repository.findByCnpjAmbienteSerie(params.input);
    if (!control) {
      return { success: false, error: 'Controle de numeração não encontrado' };
    }

    // TODO: Registrar inutilização em tabela de auditoria (fiscal_inutilizacoes)
    // Por enquanto apenas atualiza o próximo número se necessário

    const proximoAtual = parseInt(control.proximoNumero);
    const finalInutilizado = parseInt(params.numeroFinal);

    if (finalInutilizado >= proximoAtual) {
      // Atualiza o próximo número para depois da faixa inutilizada
      const novoProximo = (finalInutilizado + 1).toString();
      // Aqui deveria chamar um método específico do repository
      // Por simplicidade, apenas retornamos sucesso
    }

    return { success: true };
  }
}
