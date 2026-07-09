# PDVTouch Restaurante - caminho para teste real e NFC-e

Este repositório é a base do PDVTouch para restaurante por kilo, com frontend em React/TypeScript, backend Node/Express, integração de peso, comandas, caixa, estoque, financeiro e preparação para emissão fiscal.

O objetivo deste documento é deixar claro o que já existe e o que ainda falta implementar antes de testar o sistema em um restaurante real com intenção de operar com NFC-e.

> Observação importante: este README é um roteiro técnico. As regras fiscais devem ser validadas com contador e com a SEFAZ-SP antes do uso em produção, porque parâmetros fiscais, prazos e exigências estaduais podem mudar.

## 1. Situação Atual

O restaurante já possui:

- Certificado digital.
- CNPJ habilitado para operar com emissão fiscal pelo sistema atual.
- Operação real funcionando em outro sistema.
- Dono do restaurante também atuando como desenvolvedor do PDVTouch.

O projeto já possui:

- Fluxo de comandas e fechamento no caixa.
- Seleção entre `NFC-e` e `Orçamento não fiscal` no recebimento.
- Cadastro de produtos com campos fiscais como NCM, CFOP, CST/CSOSN, PIS, COFINS, ICMS, EAN e tipo fiscal.
- Tela administrativa com configuração fiscal, certificado, UF, CSC e série.
- Regras para bloquear emissão quando certificado estiver vencido ou configuração fiscal estiver incompleta.
- Importação/entrada de estoque com dados de documento fiscal.
- Financeiro com despesas, receitas e conta corrente.
- Testes unitários e de integração para partes do fluxo de comandas, produtos, estoque e caixa.

## 2. Ponto Crítico

Hoje o fluxo `NFC-e` do sistema ainda não significa emissão fiscal autorizada.

O sistema permite fechar uma venda como `NFCE`, exibir informações fiscais e imprimir um comprovante, mas ainda falta o módulo fiscal completo para:

- Gerar XML NFC-e modelo 65 no layout correto.
- Assinar o XML com certificado A1.
- Transmitir para webservice da SEFAZ.
- Receber protocolo de autorização.
- Armazenar XML autorizado.
- Gerar DANFE NFC-e com QR Code válido.
- Cancelar NFC-e.
- Inutilizar numeração.
- Operar em contingência.
- Registrar rejeições, protocolos e auditoria fiscal.

Sem isso, o sistema ainda não deve substituir o emissor fiscal atual em produção.

## 3. O Que Falta Implementar

### Prioridade 0 - Bloqueadores para teste fiscal real

1. Criar módulo fiscal NFC-e
   - Criar um módulo dedicado, por exemplo `src/modules/fiscal`.
   - Separar domínio, casos de uso, adapters de XML, assinatura, SEFAZ e DANFE.
   - Não deixar a emissão fiscal acoplada diretamente ao componente do caixa.

2. Criar entidade/tabela de documentos fiscais
   - Sugestão: `fiscal_documents` ou `nfce_documents`.
   - Campos mínimos:
     - `id`
     - `sale_id`
     - `document_type`
     - `model`
     - `series`
     - `number`
     - `environment`
     - `status`
     - `access_key`
     - `protocol`
     - `signed_xml`
     - `authorized_xml`
     - `danfe_path`
     - `qr_code_url`
     - `cstat`
     - `xmotivo`
     - `issued_at`
     - `authorized_at`
     - `cancelled_at`
     - `contingency_reason`
     - `created_at`
     - `updated_at`

3. Controlar numeração fiscal
   - Controlar série e número da NFC-e por CNPJ, ambiente e série.
   - Impedir reutilização de número.
   - Garantir concorrência segura quando houver mais de um terminal.
   - Registrar inutilização quando houver salto de numeração.

4. Gerar XML NFC-e modelo 65
   - Montar XML a partir de venda, itens, pagamentos, empresa, cliente e regras fiscais.
   - Validar campos obrigatórios antes de transmitir.
   - Mapear corretamente CFOP, NCM, CSOSN/CST, ICMS, PIS, COFINS, unidade, EAN/GTIN e pagamentos.

5. Assinar XML com certificado A1
   - Carregar certificado de forma segura no backend.
   - Não armazenar senha do certificado em `localStorage`.
   - Criptografar segredo ou usar cofre/local protegido.
   - Bloquear emissão quando o certificado estiver vencido.

6. Integrar com SEFAZ
   - Criar adapter para ambiente de homologação e produção.
   - Implementar consulta de status do serviço.
   - Implementar autorização de NFC-e.
   - Tratar rejeições com `cStat` e `xMotivo`.
   - Implementar timeout, retry e fila de pendências.

7. Gerar QR Code e DANFE NFC-e
   - Gerar QR Code usando CSC e ID CSC.
   - Imprimir DANFE NFC-e em impressora térmica.
   - Exibir chave de acesso, protocolo, data/hora e link de consulta.

8. Cancelamento fiscal
   - Implementar cancelamento por chave de acesso/protocolo.
   - Registrar evento de cancelamento.
   - Bloquear alteração silenciosa de venda já autorizada.

9. Inutilização de numeração
   - Implementar inutilização quando houver quebra de sequência.
   - Registrar justificativa, faixa, protocolo e status.

10. Contingência
    - Criar modo de contingência/offline.
    - Registrar venda como pendente de transmissão.
    - Transmitir quando a conexão voltar.
    - Evitar duplicidade de venda.

11. Auditoria
    - Registrar quem emitiu, cancelou, estornou, reabriu, editou ou retransmitiu.
    - Registrar data/hora local e, quando houver, data/hora de autorização SEFAZ.
    - Manter histórico imutável de alterações sensíveis.

### Prioridade 1 - Necessário para piloto em restaurante

1. Validar cadastro fiscal de produtos
   - Produto sem NCM, CFOP, CST/CSOSN, PIS, COFINS ou ICMS não deve ser vendido em modo fiscal.
   - Criar relatório de produtos incompletos.
   - Permitir revisão rápida antes do piloto.

2. Validar configuração fiscal da empresa
   - CNPJ.
   - Inscrição estadual.
   - Razão social.
   - Endereço completo.
   - CRT/regime tributário.
   - UF.
   - Série NFC-e.
   - Número inicial.
   - CSC e ID CSC.
   - Ambiente: homologação ou produção.

3. Integrar caixa com emissão fiscal real
   - Ao confirmar pagamento em `NFC-e`, gerar venda fiscal.
   - Transmitir NFC-e.
   - Só considerar finalizada quando autorizada, emitida em contingência ou marcada como pendência fiscal controlada.
   - Não permitir que falha fiscal vire venda "paga" sem rastreio.

4. Criar painel de pendências fiscais
   - NFC-e rejeitada.
   - NFC-e aguardando transmissão.
   - NFC-e em contingência.
   - Cancelamento pendente.
   - Inutilização pendente.

5. Exportar XML
   - Exportar XML autorizado por período.
   - Exportar XML de cancelamento.
   - Exportar pacote para contador.
   - Manter armazenamento por pelo menos 5 anos, conforme orientação contábil.

6. Melhorar segurança operacional
   - Acesso fiscal apenas para usuário autorizado.
   - PIN ou login obrigatório para cancelamento, estorno, alteração fiscal e configuração do certificado.
   - Log de IP/terminal/usuário em ações sensíveis.

### Prioridade 2 - Melhorias para operação comercial

1. Dashboard fiscal
   - Total emitido.
   - Total cancelado.
   - Rejeições por motivo.
   - Pendências por terminal.

2. Monitoramento técnico
   - Logs estruturados.
   - Backup automático.
   - Alerta para certificado próximo do vencimento.
   - Alerta para muitas rejeições seguidas.

3. Multi-terminal
   - Sincronização segura entre caixas.
   - Controle de numeração centralizado.
   - Impedir emissão duplicada por queda de rede.

4. Relatórios para contador
   - XML por período.
   - Resumo por CFOP.
   - Resumo por CST/CSOSN.
   - Resumo por forma de pagamento.
   - Cancelamentos e inutilizações.

## 4. Estrutura Técnica Sugerida

```text
src/modules/fiscal/
  domain/
    entities/
      FiscalDocument.ts
    ports/
      FiscalGateway.ts
      FiscalDocumentRepository.ts
  application/
    use-cases/
      IssueNfce.ts
      CancelNfce.ts
      InutilizeNfceNumber.ts
      RetryPendingFiscalDocument.ts
  infrastructure/
    xml/
      NfceXmlBuilder.ts
    signature/
      A1CertificateSigner.ts
    sefaz/
      SefazSpNfceGateway.ts
    danfe/
      DanfeNfceRenderer.ts
  presentation/
    pages/
      FiscalPendingPage.tsx

backend/src/routes/
  fiscal.routes.ts

backend/src/services/
  fiscal/

database/
  schema.sql

tests/
  unit/fiscal/
  integration/fiscal/
```

## 5. Checklist de Homologação Técnica

Antes do teste em restaurante real, validar em homologação:

- Consultar status do serviço SEFAZ.
- Emitir NFC-e autorizada.
- Emitir NFC-e com CPF do cliente.
- Emitir NFC-e sem CPF do cliente.
- Emitir NFC-e com dinheiro.
- Emitir NFC-e com cartão.
- Emitir NFC-e com Pix.
- Emitir NFC-e com múltiplas formas de pagamento.
- Emitir NFC-e com desconto.
- Emitir NFC-e com produto por peso.
- Emitir NFC-e com item cancelado antes do fechamento.
- Forçar rejeição e exibir motivo claro.
- Corrigir rejeição e retransmitir.
- Cancelar NFC-e autorizada.
- Inutilizar numeração.
- Simular internet fora do ar.
- Emitir em contingência.
- Transmitir contingência quando a internet voltar.
- Imprimir DANFE NFC-e.
- Ler QR Code no celular.
- Conferir XML com contador.
- Conferir valores de ICMS/PIS/COFINS.
- Conferir estoque após venda.
- Conferir financeiro após venda.
- Conferir fechamento de caixa.

## 6. Checklist para Piloto no Restaurante

Executar somente depois de homologação técnica aprovada:

1. Fazer backup completo do sistema atual.
2. Manter o sistema atual disponível durante o piloto.
3. Validar todos os produtos vendidos no dia.
4. Validar certificado, CSC, série e numeração inicial.
5. Escolher um caixa e um horário de baixo movimento.
6. Emitir poucas vendas reais no início.
7. Conferir cada DANFE NFC-e.
8. Conferir cada XML autorizado.
9. Conferir valores no financeiro.
10. Conferir estoque.
11. Conferir cancelamento real, se houver caso controlado.
12. Registrar qualquer rejeição ou travamento.
13. Só ampliar uso após um dia completo sem perda fiscal ou divergência de caixa.

## 7. Critério de Pronto para Teste Real

Considerar o PDVTouch pronto para piloto real somente quando:

- Build de produção estiver passando.
- Testes automatizados principais estiverem passando.
- Pelo menos 50 NFC-e de homologação forem autorizadas.
- Rejeições forem tratadas sem travar o caixa.
- Cancelamento estiver funcionando.
- Inutilização estiver funcionando.
- Contingência estiver funcionando.
- XML autorizado estiver salvo e exportável.
- DANFE NFC-e estiver imprimindo corretamente.
- QR Code estiver consultável.
- Nenhuma venda paga puder desaparecer.
- Nenhuma venda fiscal puder ser editada sem auditoria.
- Contador tiver validado CFOP, NCM, CSOSN/CST, PIS, COFINS e regras do restaurante.

## 8. O Que Não Deve Ir Para Produção Ainda

Não colocar em produção fiscal enquanto:

- O botão `NFC-e` apenas imprimir comprovante local.
- Não houver XML autorizado pela SEFAZ.
- Não houver protocolo salvo.
- Não houver QR Code válido.
- Não houver controle de numeração.
- Não houver cancelamento.
- Não houver contingência.
- Não houver armazenamento dos XMLs.
- Não houver auditoria de estorno, cancelamento e edição.

## 9. Como Executar o Projeto

Pré-requisitos:

- Node.js 18+
- npm 8+

Instalação:

```bash
npm install
```

Desenvolvimento:

```bash
npm run dev
```

Esse comando inicia:

- Frontend: `http://localhost:5173`
- Backend: `http://localhost:3001`

Testes:

```bash
npm run test
```

Build de produção:

```bash
npm run build
```

Backend em desenvolvimento:

```bash
npm run backend:dev
```

Backend em modo start:

```bash
npm run backend:start
```

## 10. Aplicativo Desktop (Electron)

O pacote desktop do PDVTouch deve ser gerado pelo Electron Builder.

Comando recomendado:

```bash
npm run electron:pack
```

Artefatos gerados:

- Setup: `release-electron\PDVTouch-Restaurante-Setup-0.1.0.exe`
- Portable: `release-electron\PDVTouch-Restaurante-Portable-0.1.0.exe`
- Pasta descompactada: `release-electron\win-unpacked`

Para instalar no computador do cliente, usar o arquivo `PDVTouch-Restaurante-Setup-0.1.0.exe`. Não é necessário baixar o projeto completo pelo GitHub no computador do cliente.

### Regras obrigatórias do desktop

- O aplicativo instalado deve abrir na tela de login.
- O sistema deve exigir loja, usuário/perfil e PIN a cada abertura.
- Não deve existir login automático como Administrador ou qualquer usuário padrão.
- Sessões antigas salvas em `pdv.auth.user` devem ser removidas na inicialização.
- Não persistir login automático em `localStorage` sem uma regra explícita e aprovada de lembrar acesso.

### Prevenção de tela branca

No Electron empacotado, a interface é carregada por `file://`. Por isso:

- `vite.config.ts` deve manter `base: './'`.
- `src/main.tsx` deve usar `HashRouter` quando `window.location.protocol === 'file:'`.
- `dist/index.html` deve apontar para `./assets/...`, nunca `/assets/...`.
- `electron/main.cjs` deve carregar `dist/index.html` com `mainWindow.loadFile(...)`.

Antes de enviar um novo setup, validar:

```bash
npm run test -- tests/e2e/multiStoreLogin.test.tsx tests/e2e/cashierAccess.test.tsx tests/unit/platformSettings.test.ts
npm run build
npm run electron:pack
```

Também conferir no pacote gerado que não existem os padrões `defaultUser`, `u-admin-default`, `return defaultUser` ou persistência automática com `setItem(storageKey)` no fluxo de autenticação.

## 11. PostgreSQL Local

O backend tenta usar PostgreSQL local por padrão e cria tabelas automaticamente para o estado de comandas.

Variáveis suportadas:

- `PDV_USE_POSTGRES`: `true|false`
- `DATABASE_URL`
- `PGHOST`
- `PGPORT`
- `PGDATABASE`
- `PGUSER`
- `PGPASSWORD`
- `PGSSL`

Exemplo PowerShell:

```powershell
$env:PGHOST="127.0.0.1"
$env:PGPORT="5432"
$env:PGDATABASE="postgres"
$env:PGUSER="postgres"
$env:PGPASSWORD="sua_senha"
$env:PDV_USE_POSTGRES="true"
```

Se a conexão com PostgreSQL falhar, o backend usa fallback em arquivo local.

## 12. Resumo Executivo

O PDVTouch já tem uma boa base operacional para restaurante: comanda, caixa, produtos, estoque, financeiro e preparação de campos fiscais.

O que falta para testar em restaurante real com emissão própria é o módulo fiscal NFC-e completo. A prioridade deve ser implementar autorização real na SEFAZ, XML assinado, DANFE com QR Code, cancelamento, inutilização, contingência, armazenamento de XML e auditoria.

Depois disso, o caminho recomendado é:

1. Homologação técnica.
2. Validação com contador.
3. Piloto controlado em um caixa.
4. Produção gradual.
