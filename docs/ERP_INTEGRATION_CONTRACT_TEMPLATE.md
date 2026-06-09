# Contrato de Integracao PDV -> ERP (Preenchimento Inicial)

## 1. Identificacao
1. Projeto: Integracao PDV Restaurante Kilo -> ERP
2. Empresa/Cliente: RAWSTON MARINHO PINTO (a confirmar dados cadastrais)
3. Empresa fornecedora do ERP (software): ERPClass (a confirmar oficialmente)
4. Versao ERP: 2026.3.23.24 (conforme tela enviada)
5. Ambiente: Homologacao
6. Data: 2026-06-09
7. Responsaveis tecnicos:
   1. PDV: Rawston (a complementar contato)
   2. ERP (fornecedor do software): [fornecedor do ERP]

## 2. Objetivo da Integracao
1. Sincronizar catalogo de produtos do ERP para o PDV.
2. Enviar vendas/comandas finalizadas do PDV para o ERP.
3. Garantir rastreabilidade, idempotencia e reconciliacao de valores.

## 3. Escopo Funcional (MVP)
1. Fluxo A - Produtos (ERP -> PDV):
   1. criacao/atualizacao de produto
   2. preco
   3. categoria
   4. tipo (por quilo/unidade)
2. Fluxo B - Vendas (PDV -> ERP):
   1. comanda finalizada
   2. itens vendidos
   3. total e forma de pagamento
   4. status de integracao
3. Fora de escopo MVP:
   1. Integracao fiscal completa (NFC-e/NF-e) nesta primeira entrega.
   2. Integracao financeira avancada (conciliacao bancaria detalhada).

## 4. Modelo de Integracao
1. Tipo:
   1. Pendente de confirmacao da empresa fornecedora do ERP (API REST/SOAP/Arquivo).
   2. Preferencia tecnica do PDV: API REST.
   3. Alternativa: integracao por arquivo (CSV/TXT/XML) caso API nao esteja disponivel.
   4. Acesso direto ao banco: evitar.
2. Direcao dos dados:
   1. ERP -> PDV: produtos e precos.
   2. PDV -> ERP: vendas/comandas finalizadas e pagamentos.
3. Frequencia:
   1. ERP -> PDV: lote (inicialmente a cada 15 minutos).
   2. PDV -> ERP: evento de fechamento de comanda + retentativa em fila.
4. Protocolo/Transporte:
   1. HTTPS
   2. SFTP
   3. Rede local

## 5. Seguranca e Acesso
1. Autenticacao:
   1. Pendente de fornecedor ERP.
   2. Preferencia: API Key ou OAuth2 com HTTPS.
2. IPs permitidos (whitelist): [pendente fornecedor do ERP]
3. Certificados/TLS obrigatorios: sim
4. Credenciais por ambiente:
   1. homologacao: [pendente fornecedor do ERP]
   2. producao: [pendente fornecedor do ERP]
5. Politica de rotacao de segredo: [pendente definicao]

## 6. Contrato de Dados - Produtos (ERP -> PDV)
1. Endpoint/Layout origem: [pendente fornecedor do ERP]
2. Chave unica do produto no ERP: [pendente fornecedor do ERP]
3. Campos obrigatorios:
   1. externalProductId
   2. sku (se houver)
   3. name
   4. unitType (KG | UN)
   5. price
   6. category
   7. active
4. Regras:
   1. produto inativo no ERP -> comportamento no PDV: inativar no PDV.
   2. categoria inexistente no PDV -> criar automaticamente.
   3. arredondamento de preco: 2 casas decimais para preco unitario; 3 casas para peso (kg).

## 7. Contrato de Dados - Vendas/Comandas (PDV -> ERP)
1. Endpoint/Layout destino: [pendente fornecedor do ERP]
2. Evento de envio:
   1. comanda finalizada no caixa
3. Chave de idempotencia:
   1. storeId + comandaNumber + closeTimestamp (ou equivalente ERP)
4. Campos obrigatorios:
   1. externalSaleId
   2. storeId
   3. comandaNumber
   4. closedAt
   5. items[]:
      1. externalProductId ou sku
      2. quantity
      3. unitPrice
      4. totalItem
      5. unitType (KG | UN)
   6. totalSale
   7. paymentMethod
   8. operatorId (quando aplicavel)
5. Regras:
   1. ERP retorna protocolo/transacao: sim (preferencial; pendente confirmacao).
   2. tratamento de venda duplicada: ignorar por idempotencia da chave externa.
   3. timeout de requisicao: 15 segundos.

## 8. Mapeamento de Dominio (PDV x ERP)
1. Formas de pagamento:
   1. PDV DINHEIRO -> ERP [pendente codigo ERP]
   2. PDV PIX -> ERP [pendente codigo ERP]
   3. PDV CARTAO_CREDITO -> ERP [pendente codigo ERP]
   4. PDV CARTAO_DEBITO -> ERP [pendente codigo ERP]
2. Status:
   1. PDV PRONTA_PARA_CAIXA -> ERP [pendente status ERP]
   2. PDV ENCERRADA/FINALIZADA -> ERP [pendente status ERP]
3. Unidade:
   1. PDV KG -> ERP [pendente codigo ERP]
   2. PDV UN -> ERP [pendente codigo ERP]

## 9. Politica de Erros e Retentativas
1. Tipos de falha:
   1. rede/timeout
   2. autenticacao
   3. validacao de payload
   4. item inexistente no ERP
2. Retry:
   1. tentativas: 5
   2. backoff: exponencial
   3. intervalo inicial: 30s
3. Dead-letter/pendencia:
   1. registrar pendente para reprocesso manual
   2. tela de pendencias: sim (no backend/admin)
4. Nao bloqueio de operacao:
   1. falha de integracao nao impede fechamento no PDV
   2. venda fica com status PENDENTE_ENVIO

## 10. Auditoria e Observabilidade
1. Log minimo por transacao:
   1. timestamp
   2. operation (IMPORT_PRODUCT / EXPORT_SALE)
   3. externalId
   4. requestId / correlationId
   5. status (SUCCESS / ERROR / RETRY / PENDING)
   6. errorMessage (quando houver)
2. Retencao de logs: 90 dias (proposta inicial)
3. Exportacao de evidencias: CSV/JSON (proposta inicial)

## 11. Requisitos Nao Funcionais (SLAs)
1. Disponibilidade minima: 99,5% (proposta)
2. Tempo maximo de processamento por venda: 30s
3. Volume estimado:
   1. vendas/dia: [pendente operacao]
   2. itens/venda: [pendente operacao]
4. Janela de manutencao: [pendente operacao]

## 12. Homologacao
1. Cenarios obrigatorios:
   1. importacao de produto novo
   2. atualizacao de preco/categoria
   3. envio de venda com item por quilo
   4. envio de venda com multiplas formas de pagamento (se aplicavel)
   5. falha de rede + retry + sucesso
   6. venda duplicada (teste de idempotencia)
2. Criterios de aceite:
   1. 100% dos cenarios criticos aprovados
   2. reconciliacao PDV x ERP sem divergencia acima de 0,5%
   3. aprovacao formal de negocio e tecnico

## 13. Go-live e Operacao
1. Estrategia:
   1. piloto (1 loja/1 terminal)
   2. expansao gradual
2. Rollback:
   1. desabilitar exportacao automatica
   2. manter fila pendente para replay posterior
3. Suporte:
   1. nivel 1: operacao loja
   2. nivel 2: equipe PDV
   3. nivel 3: fornecedor ERP

## 14. Pendencias em Aberto
1. Confirmar oficialmente se ERPClass possui API publica e documentada.
2. Receber documentacao tecnica de endpoints/layouts e autenticacao do ERP.
3. Definir mapeamento oficial de codigos de pagamento/status/unidade no ERP.
4. Disponibilizar credenciais e ambiente de homologacao ERP.
5. Validar politica de suporte e SLA do fornecedor para incidentes de integracao.

## 15. Aprovacao
1. Responsavel PDV: [nome / assinatura / data]
2. Responsavel ERP: [nome / assinatura / data]
3. Responsavel cliente: [nome / assinatura / data]
