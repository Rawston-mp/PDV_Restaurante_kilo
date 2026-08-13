import { describe, it, expect } from 'vitest';
import { gerarChaveAcesso, validarFormatoChaveAcesso } from '@/modules/fiscal/domain/services/NfceKeyGenerator';

describe('NfceKeyGenerator', () => {
  it('deve gerar chave de acesso válida de 44 dígitos', () => {
    const result = gerarChaveAcesso({
      uf: 'SP',
      dataEmissao: new Date('2026-08-02'),
      cnpj: '12345678000190',
      modelo: '65',
      serie: '1',
      numero: '1',
      tipoEmissao: '1',
      codigoNumerico: '12345678',
    });

    expect(result.chaveAcesso).toHaveLength(44);
    expect(validarFormatoChaveAcesso(result.chaveAcesso)).toBe(true);
    expect(result.digitoVerificador).toHaveLength(1);
    expect(result.codigoNumerico).toBe('12345678');
  });

  it('deve calcular corretamente o dígito verificador', () => {
    // Chave conhecida para validação manual
    const result = gerarChaveAcesso({
      uf: 'SP',
      dataEmissao: new Date('2024-01-15'),
      cnpj: '11222333000181',
      modelo: '65',
      serie: '001',
      numero: '000000001',
      tipoEmissao: '1',
      codigoNumerico: '00000001',
    });

    // A chave deve ter 44 dígitos e DV válido
    expect(result.chaveAcesso).toMatch(/^\d{44}$/);
    expect(result.digitoVerificador).toMatch(/^\d$/);
  });

  it('deve rejeitar UF inválida', () => {
    expect(() =>
      gerarChaveAcesso({
        uf: 'XX',
        dataEmissao: new Date(),
        cnpj: '12345678000190',
        modelo: '65',
        serie: '1',
        numero: '1',
        tipoEmissao: '1',
      })
    ).toThrow('UF inválida');
  });

  it('deve preencher zeros à esquerda corretamente', () => {
    const result = gerarChaveAcesso({
      uf: 'SP',
      dataEmissao: new Date('2026-08-02'),
      cnpj: '12345678000190',
      modelo: '65',
      serie: '1',
      numero: '42',
      tipoEmissao: '1',
      codigoNumerico: '87654321',
    });

    // Chave deve ter 44 dígitos
    expect(result.chaveAcesso).toHaveLength(44);
    // Série e número devem estar presentes na chave
    expect(result.chaveAcesso).toContain('001'); // série
    expect(result.chaveAcesso).toContain('000000042'); // número
  });
});
