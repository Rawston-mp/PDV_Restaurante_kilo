/**
 * Gera a Chave de Acesso NFC-e (44 dígitos) conforme algoritmo oficial da SEFAZ.
 * 
 * Formato da chave:
 * cUF (2) + AAMM (4) + CNPJ (14) + mod (2) + serie (3) + nNF (9) + tpEmis (1) + cNF (8) + cDV (1)
 * 
 * cDV = dígito verificador calculado por módulo 11 (pesos 2 a 9)
 */

export type ChaveAcessoInput = {
  uf: string;                    // Código UF (ex: '35' para SP)
  dataEmissao: Date;             // Data de emissão
  cnpj: string;                  // CNPJ do emitente (somente números)
  modelo: '65';                  // Modelo NFC-e
  serie: string;                 // Série (1-3 dígitos)
  numero: string;                // Número da NFC-e (1-9 dígitos)
  tipoEmissao: '1' | '6' | '7';  // 1=Normal, 6=Contingência FS-DA, 7=Contingência SVC-AN
  codigoNumerico?: string;       // Código numérico aleatório (8 dígitos). Se não informado, será gerado.
};

export type ChaveAcessoResult = {
  chaveAcesso: string;           // Chave completa de 44 dígitos
  digitoVerificador: string;     // DV (1 dígito)
  codigoNumerico: string;        // cNF usado (8 dígitos)
};

/**
 * Códigos de UF do Brasil
 */
const UF_CODES: Record<string, string> = {
  AC: '12', AL: '27', AM: '13', AP: '16', BA: '29', CE: '23', DF: '53',
  ES: '32', GO: '52', MA: '21', MG: '31', MS: '50', MT: '51', PA: '15',
  PB: '25', PE: '26', PI: '22', PR: '41', RJ: '33', RN: '24', RO: '11',
  RR: '14', RS: '43', SC: '42', SE: '28', SP: '35', TO: '17'
};

/**
 * Gera código numérico aleatório de 8 dígitos
 */
function generateCodigoNumerico(): string {
  return Math.floor(10000000 + Math.random() * 90000000).toString();
}

/**
 * Calcula o dígito verificador (módulo 11, pesos 2 a 9)
 */
function calcularDigitoVerificador(chave43: string): string {
  const pesos = [2, 3, 4, 5, 6, 7, 8, 9];
  let soma = 0;
  let pesoIndex = 0;

  // Percorre a chave de trás para frente
  for (let i = chave43.length - 1; i >= 0; i--) {
    soma += parseInt(chave43[i], 10) * pesos[pesoIndex];
    pesoIndex = (pesoIndex + 1) % pesos.length;
  }

  const resto = soma % 11;
  const dv = resto < 2 ? 0 : 11 - resto;
  return dv.toString();
}

/**
 * Gera a Chave de Acesso completa de 44 dígitos
 */
export function gerarChaveAcesso(input: ChaveAcessoInput): ChaveAcessoResult {
  const ufCode = UF_CODES[input.uf.toUpperCase()];
  if (!ufCode) {
    throw new Error(`UF inválida: ${input.uf}`);
  }

  // AAMM (ano 2 dígitos + mês 2 dígitos)
  const ano = input.dataEmissao.getFullYear().toString().slice(-2);
  const mes = (input.dataEmissao.getMonth() + 1).toString().padStart(2, '0');
  const aamm = `${ano}${mes}`;

  // CNPJ (14 dígitos, somente números)
  const cnpjLimpo = input.cnpj.replace(/\D/g, '').padStart(14, '0');

  // Modelo (2 dígitos)
  const modelo = input.modelo;

  // Série (3 dígitos)
  const serie = input.serie.padStart(3, '0').slice(-3);

  // Número (9 dígitos)
  const numero = input.numero.padStart(9, '0').slice(-9);

  // Tipo de emissão (1 dígito)
  const tipoEmissao = input.tipoEmissao;

  // Código numérico (8 dígitos)
  const codigoNumerico = input.codigoNumerico || generateCodigoNumerico();

  // Monta os primeiros 43 dígitos
  const chave43 = [
    ufCode,
    aamm,
    cnpjLimpo,
    modelo,
    serie,
    numero,
    tipoEmissao,
    codigoNumerico
  ].join('');

  if (chave43.length !== 43) {
    throw new Error(`Chave parcial inválida: ${chave43.length} dígitos (esperado 43)`);
  }

  // Calcula dígito verificador
  const digitoVerificador = calcularDigitoVerificador(chave43);

  // Chave completa
  const chaveAcesso = chave43 + digitoVerificador;

  return {
    chaveAcesso,
    digitoVerificador,
    codigoNumerico
  };
}

/**
 * Valida se uma chave de acesso tem formato correto (44 dígitos)
 */
export function validarFormatoChaveAcesso(chave: string): boolean {
  return /^\d{44}$/.test(chave);
}
