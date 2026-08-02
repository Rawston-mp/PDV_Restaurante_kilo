import { describe, it, expect, beforeEach } from 'vitest';
import { NfceXmlBuilder } from '@/modules/fiscal/domain/services/NfceXmlBuilder';
import type { FiscalReceipt } from '@/fiscal/types';
import type { DigitalCertificateSettings } from '@/shared/domain/services/digitalCertificateRules';

describe('NfceXmlBuilder', () => {
  let builder: NfceXmlBuilder;
  let mockReceipt: FiscalReceipt;
  let mockCert: DigitalCertificateSettings;

  beforeEach(() => {
    builder = new NfceXmlBuilder();

    mockReceipt = {
      tipo: 'NFCE',
      emitente: {
        razaoSocial: 'RESTAURANTE TESTE LTDA',
        nomeFantasia: 'Teste Restaurante',
        cnpj: '12.345.678/0001-90',
        inscricaoEstadual: '123456789',
        endereco: {
          logradouro: 'Rua Teste',
          numero: '123',
          bairro: 'Centro',
          municipio: 'São Paulo',
          uf: 'SP',
          cep: '01000-000',
        },
      },
      nfce: {
        modelo: '65',
        serie: '1',
        numero: '1',
        chaveAcesso: '',
        protocoloAutorizacao: '',
        dataEmissao: '2026-08-02T10:00:00-03:00',
        dataAutorizacao: '2026-08-02T10:00:05-03:00',
        ambiente: 'HOMOLOGACAO',
        qrCodeUrl: '',
      },
      operador: 'caixa01',
      pdv: 'PDV-01',
      itens: [
        {
          codigo: '001',
          descricao: 'Almoço por quilo',
          ncm: '21069090',
          cfop: '5102',
          unidade: 'KG',
          quantidade: 0.5,
          valorUnitario: 50.0,
          valorTotal: 25.0,
          cstCsosn: '102',
        },
      ],
      pagamentos: [
        {
          tipo: 'PIX',
          valor: 25.0,
        },
      ],
      totalProdutos: 25.0,
      descontoTotal: 0,
      acrescimoTotal: 0,
      totalDocumento: 25.0,
      troco: 0,
    };

    mockCert = {
      alias: 'Teste',
      companyName: 'RESTAURANTE TESTE LTDA',
      cnpj: '12345678000190',
      uf: 'SP',
      cscId: '000001',
      cscCode: 'ABCDEF123456',
      nfceEnvironment: 'HOMOLOGACAO',
      nfceSerie: '1',
      nfceNextNumber: '1',
      fileName: 'cert.pfx',
      fileSize: 1234,
      fileExtension: '.pfx',
      importSource: 'MAQUINA',
      expirationDate: '2030-01-01',
      renewAlertDays: 20,
      importedAt: '2026-01-01',
      updatedAt: '2026-01-01',
      model: 'A1',
    };
  });

  it('deve gerar XML NFC-e válido com chave de acesso', async () => {
    const result = await builder.buildNfceXml(mockReceipt, mockCert, '1');

    expect(result.xml).toContain('<?xml version="1.0"');
    expect(result.xml).toContain('<NFe xmlns="http://www.portalfiscal.inf.br/nfe">');
    expect(result.xml).toContain('<infNFe Id="NFe');
    expect(result.accessKey).toHaveLength(44);
    expect(result.numero).toBe('000000001');
    expect(result.serie).toBe('001');
  });

  it('deve incluir marca dágua de homologação', async () => {
    const result = await builder.buildNfceXml(mockReceipt, mockCert, '1');
    expect(result.xml).toContain('EMITIDO EM AMBIENTE DE HOMOLOGACAO - SEM VALOR FISCAL');
  });

  it('deve incluir dados do emitente corretamente', async () => {
    const result = await builder.buildNfceXml(mockReceipt, mockCert, '1');
    expect(result.xml).toContain('12345678000190'); // CNPJ limpo
    expect(result.xml).toContain('RESTAURANTE TESTE LTDA');
  });

  it('deve incluir item com NCM, CFOP e CST', async () => {
    const result = await builder.buildNfceXml(mockReceipt, mockCert, '1');
    expect(result.xml).toContain('21069090'); // NCM
    expect(result.xml).toContain('5102'); // CFOP
    expect(result.xml).toContain('CSOSN>102</CSOSN>');
  });

  it('deve incluir pagamento PIX', async () => {
    const result = await builder.buildNfceXml(mockReceipt, mockCert, '1');
    expect(result.xml).toContain('<tPag>17</tPag>'); // PIX = 17
  });
});
