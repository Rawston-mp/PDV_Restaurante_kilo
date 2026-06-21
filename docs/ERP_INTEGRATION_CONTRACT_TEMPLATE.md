# Contrato de Integração PDV -> ERP (Preenchimento Inicial)

## 1. Identificação
1. Projeto: Integração PDV Restaurante Kilo -> ERP
2. Empresa/Cliente: RAWSTON MARINHO PINTO (a confirmar dados cadastrais)
3. Empresa fornecedora do ERP (software): ERPClass (a confirmar oficialmente)
4. Versão ERP: 2026.3.23.24 (conforme a tela enviada)
5. Ambiente: Homologação
6. Data: 2026-06-09
7. Responsáveis técnicos:
   1. PDV: Rawston (a complementar contato)
   2. ERP (fornecedor do software): [fornecedor do ERP]

## 2. Objetivo da Integração
1. Sincronizar o catálogo de produtos do ERP com o PDV.
2. Enviar vendas e fechamentos do fluxo de balanças/comanda do PDV para o ERP.
3. Garantir rastreabilidade, idempotência e reconciliação de valores.

## 3. Escopo Funcional (MVP)
1. Fluxo A - Produtos (ERP -> PDV):
   1. criação/atualização de produto
   2. preço
   3. categoria
   4. tipo (por quilo/unidade)
2. Fluxo B - Vendas (PDV -> ERP):
   1. comanda encerrada no caixa
   2. itens vendidos
   3. total e forma de pagamento
   4. status de integração
3. Fora de escopo MVP:
   1. Integração fiscal completa (NFC-e/NF-e) nesta primeira entrega.
   2. Integração financeira avançada (conciliação bancária detalhada).

## 4. Modelo de Integração
1. Tipo:
   1. Pendente de confirmação da empresa fornecedora do ERP (API REST/SOAP/arquivo).
   2. Preferência técnica do PDV: API REST.
   3. Alternativa: integração por arquivo (CSV/TXT/XML), caso a API não esteja disponível.
   4. Acesso direto ao banco: evitar.
2. Direção dos dados:
   1. ERP -> PDV: produtos e preços.
   2. PDV -> ERP: vendas, encerramentos e pagamentos.
3. Frequência:
   1. ERP -> PDV: lote (inicialmente a cada 15 minutos).
   2. PDV -> ERP: evento de encerramento de comanda + retentativa em fila.
4. Protocolo/Transporte:
   1. HTTPS
   2. SFTP
   3. Rede local

## 5. Segurança e Acesso
1. Autenticação:
   1. Pendente de fornecedor ERP.
   2. Preferencia: API Key ou OAuth2 com HTTPS.
2. IPs permitidos (whitelist): [pendente fornecedor do ERP]
3. Certificados/TLS obrigatorios: sim
4. Credenciais por ambiente:
   1. homologação: [pendente fornecedor do ERP]
   2. produção: [pendente fornecedor do ERP]
5. Política de rotação de segredo: [pendente definição]

## 6. Contrato de Dados - Produtos (ERP -> PDV)
1. Endpoint/Layout origem: [pendente fornecedor do ERP]
2. Chave única do produto no ERP: [pendente fornecedor do ERP]
3. Campos obrigatórios:
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
   3. arredondamento de preço: 2 casas decimais para preço unitário; 3 casas para peso (kg).

## 7. Contrato de Dados - Vendas/Comandas (PDV -> ERP)
1. Endpoint/Layout destino: [pendente fornecedor do ERP]
2. Evento de envio:
   1. comanda finalizada no caixa
3. Chave de idempotência:
   1. storeId + comandaNumber + closeTimestamp (ou equivalente ERP)
4. Campos obrigatórios:
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
   8. operatorId (quando aplicável)
5. Regras:
   1. ERP retorna protocolo/transação: sim (preferencial; pendente confirmação).
   2. tratamento de venda duplicada: ignorar por idempotência da chave externa.
   3. timeout da requisição: 15 segundos.

## 8. Mapeamento de Domínio (PDV x ERP)
1. Formas de pagamento:
   1. PDV DINHEIRO -> ERP [pendente código ERP]
   2. PDV PIX -> ERP [pendente código ERP]
   3. PDV CARTAO_CREDITO -> ERP [pendente código ERP]
   4. PDV CARTAO_DEBITO -> ERP [pendente código ERP]
2. Status:
   1. PDV PRONTA_PARA_CAIXA -> ERP [pendente status ERP]
   2. PDV ENCERRADA (modo VENDA) -> ERP [pendente status ERP]
   3. PDV ENCERRADA (modo ORCAMENTO) -> ERP [não fiscal / pendente regra ERP]
3. Unidade:
   1. PDV KG -> ERP [pendente código ERP]
   2. PDV UN -> ERP [pendente código ERP]

## 9. Política de Erros e Retentativas
1. Tipos de falha:
   1. rede/timeout
   2. autenticação
   3. validação de payload
   4. item inexistente no ERP
2. Retry:
   1. tentativas: 5
   2. backoff: exponencial
   3. intervalo inicial: 30s
3. Dead-letter/pendência:
   1. registrar pendente para reprocesso manual
   2. tela de pendências: sim (no backend/admin)
4. Não bloqueio da operação:
   1. falha de integração não impede o fechamento no PDV
   2. venda fica com status PENDENTE_ENVIO

## 10. Auditoria e Observabilidade
1. Log mínimo por transação:
   1. timestamp
   2. operation (IMPORT_PRODUCT / EXPORT_SALE)
   3. externalId
   4. requestId / correlationId
   5. status (SUCCESS / ERROR / RETRY / PENDING)
   6. errorMessage (quando houver)
2. Retenção de logs: 90 dias (proposta inicial)
3. Exportação de evidências: CSV/JSON (proposta inicial)

## 11. Requisitos Não Funcionais (SLAs)
1. Disponibilidade mínima: 99,5% (proposta)
2. Tempo máximo de processamento por venda: 30s
3. Volume estimado:
   1. vendas/dia: [pendente operação]
   2. itens/venda: [pendente operação]
4. Janela de manutenção: [pendente operação]

## 12. Homologação
1. Cenários obrigatórios:
   1. importação de produto novo
   2. atualização de preço/categoria
   3. envio de venda com item por quilo
   4. envio de venda com múltiplas formas de pagamento (se aplicável)
   5. falha de rede + retry + sucesso
   6. venda duplicada (teste de idempotencia)
2. Critérios de aceite:
   1. 100% dos cenários críticos aprovados
   2. reconciliação PDV x ERP sem divergência acima de 0,5%
   3. aprovação formal de negócio e técnica

## 13. Go-live e Operação
1. Estratégia:
   1. piloto (1 loja/1 terminal)
   2. expansão gradual
2. Rollback:
   1. desabilitar exportação automática
   2. manter fila pendente para replay posterior
3. Suporte:
   1. nível 1: operação da loja
   2. nível 2: equipe PDV
   3. nível 3: fornecedor ERP

## 14. Pendências em Aberto
1. Confirmar oficialmente se o ERPClass possui API pública e documentada.
2. Receber documentação técnica de endpoints/layouts e autenticação do ERP.
3. Definir o mapeamento oficial de códigos de pagamento/status/unidade no ERP.
4. Disponibilizar credenciais e o ambiente de homologação ERP.
5. Validar a política de suporte e o SLA do fornecedor para incidentes de integração.

## 15. Aprovação
1. Responsável PDV: [nome / assinatura / data]
2. Responsável ERP: [nome / assinatura / data]
3. Responsável cliente: [nome / assinatura / data]
