import { describe, expect, it } from 'vitest';

import type { FiscalReceipt } from '@/fiscal/types';
import { RegisterPendingFiscalDocument } from '@/modules/fiscal/application/use-cases/RegisterPendingFiscalDocument';
import { RetryPendingFiscalDocuments } from '@/modules/fiscal/application/use-cases/RetryPendingFiscalDocuments';
import type { FiscalDocument, FiscalDocumentStatus } from '@/modules/fiscal/domain/entities/FiscalDocument';
import type { FiscalDocumentRepository } from '@/modules/fiscal/domain/ports/FiscalDocumentRepository';
import type { FiscalAuthorizationResult, FiscalGateway } from '@/modules/fiscal/domain/ports/FiscalGateway';

class InMemoryFiscalDocumentRepository implements FiscalDocumentRepository {
  documents = new Map<string, FiscalDocument>();

  async findById(id: string) {
    return this.documents.get(id) ?? null;
  }

  async list() {
    return [...this.documents.values()];
  }

  async listByStatus(statuses: FiscalDocumentStatus[]) {
    return [...this.documents.values()].filter((document) => statuses.includes(document.status));
  }

  async save(document: FiscalDocument) {
    this.documents.set(document.id, document);
  }
}

class SequenceFiscalGateway implements FiscalGateway {
  constructor(private readonly results: FiscalAuthorizationResult[]) {}

  async authorizeNfce() {
    const result = this.results.shift();
    if (!result) {
      throw new Error('Nenhum resultado fiscal configurado para o teste.');
    }
    return result;
  }
}

const makeReceipt = (): FiscalReceipt => ({
  tipo: 'NFCE',
  emitente: {
    razaoSocial: 'Restaurante Teste LTDA',
    cnpj: '00000000000000',
    inscricaoEstadual: '000000000000',
    endereco: {
      logradouro: 'Rua Teste',
      numero: '1',
      bairro: 'Centro',
      municipio: 'São Paulo',
      uf: 'SP',
      cep: '00000000'
    }
  },
  nfce: {
    modelo: '65',
    serie: '1',
    numero: '000000001',
    chaveAcesso: '35260700000000000000650010000000011000000001',
    protocoloAutorizacao: '',
    dataEmissao: new Date().toISOString(),
    dataAutorizacao: '',
    ambiente: 'HOMOLOGACAO',
    qrCodeUrl: '',
    cscId: '1'
  },
  operador: 'Caixa',
  pdv: 'CAIXA PRINCIPAL',
  itens: [
    {
      codigo: '001',
      descricao: 'Coca lata zero 350 ml.',
      ncm: '22021000',
      cfop: '5102',
      unidade: 'UN',
      quantidade: 1,
      valorUnitario: 7.5,
      valorTotal: 7.5,
      cstCsosn: '500'
    }
  ],
  pagamentos: [{ tipo: 'DINHEIRO', valor: 7.5 }],
  totalProdutos: 7.5,
  descontoTotal: 0,
  acrescimoTotal: 0,
  totalDocumento: 7.5,
  troco: 0
});

describe('fiscal document queue', () => {
  it('keeps NFC-e pending offline and authorizes it on retry', async () => {
    const repository = new InMemoryFiscalDocumentRepository();
    const gateway = new SequenceFiscalGateway([
      { status: 'OFFLINE', lastError: 'Sem internet' },
      {
        status: 'AUTHORIZED',
        accessKey: '35260700000000000000650010000000011000000001',
        protocol: '135260000000000',
        qrCodeUrl: 'https://nfce.test/qrcode',
        authorizedXml: '<xml />',
        cstat: '100',
        xmotivo: 'Autorizado',
        authorizedAt: new Date()
      }
    ]);

    const register = new RegisterPendingFiscalDocument(repository, gateway);
    const pending = await register.execute({ saleId: 'sale-1', receipt: makeReceipt() });

    expect(pending.status).toBe('OFFLINE');
    expect(pending.attempts).toBe(1);

    await repository.save({ ...pending, nextRetryAt: new Date(Date.now() - 1_000) });
    const retry = new RetryPendingFiscalDocuments(repository, gateway);
    const [authorized] = await retry.execute();

    expect(authorized.status).toBe('AUTHORIZED');
    expect(authorized.protocol).toBe('135260000000000');
  });
});
