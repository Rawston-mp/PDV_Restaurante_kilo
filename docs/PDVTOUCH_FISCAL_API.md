# PDVTouch Fiscal API

## 1. Objetivo

Documentar a arquitetura proposta para a API fiscal própria do PDVTouch, responsável por receber vendas fiscais do PDV, processar NFC-e de forma assíncrona, manter operação tolerante a falhas de internet e atualizar o sistema quando a emissão fiscal for autorizada, rejeitada, cancelada ou colocada em contingência.

Esta documentação descreve o modelo interno desejado. Não representa integração fechada com fornecedor externo.

## 2. Princípios

- O caixa não deve parar por queda temporária de internet.
- Toda venda fiscal deve gerar um registro local antes de qualquer transmissão externa.
- A emissão fiscal deve ser assíncrona.
- A API deve aceitar requisições idempotentes para evitar duplicidade de NFC-e.
- O sistema deve ter fila, retry, auditoria, status claro e reconciliação.
- Produção só pode ser liberada quando o emissor real estiver validado.
- Homologação deve ser o ambiente padrão durante desenvolvimento e testes.

## 3. Ambientes

### Sandbox

Ambiente de testes usado para validar:

- montagem do payload fiscal;
- autenticação;
- fila de emissão;
- webhooks;
- retry;
- dashboard `Pdv_Sefaz`;
- contingência simulada;
- rejeições simuladas;
- reconciliação.

URL planejada:

```text
https://sandbox-api.pdvtouch.local/v1
```

### Produção

Ambiente de venda real. Deve permanecer bloqueado até que:

- certificado A1 esteja válido;
- CSC e CSC ID estejam configurados;
- dados fiscais da empresa estejam completos;
- produtos tenham cadastro fiscal consistente;
- gateway real com SEFAZ esteja implementado e testado;
- contingência esteja validada;
- contador/responsável fiscal aprove o fluxo.

URL planejada:

```text
https://api.pdvtouch.local/v1
```

## 4. Autenticação

Todas as requisições devem usar API Key no header:

```http
X-Api-Key: chave-da-loja-ou-empresa
```

Regras:

- Cada loja deve ter sua própria chave.
- A chave não deve aparecer completa na interface após salva.
- A chave de produção deve ser diferente da chave de sandbox.
- Troca de chave deve invalidar a chave anterior.

## 5. Rate Limit

Limite inicial recomendado:

- 60 requisições por minuto;
- 5 requisições por segundo.

Quando o limite for excedido, a API deve responder:

```http
HTTP 429 Too Many Requests
```

Com cabeçalhos:

```http
x-rate-limit-limit
x-rate-limit-remaining
x-rate-limit-reset
```

O PDV deve respeitar `x-rate-limit-reset` antes de tentar novamente.

## 6. Endpoint de Emissão NFC-e

Endpoint planejado:

```http
POST /v1/fiscal/nfce
```

### Regras

- Deve receber venda fiscal completa.
- Deve validar o payload.
- Deve gravar a solicitação fiscal.
- Deve retornar status inicial `enqueued`.
- Não deve bloquear o caixa aguardando autorização final da SEFAZ.
- Deve usar `integrationId` para idempotência.

### Exemplo de request

```json
{
  "integrationId": "cashier-sale-123",
  "environment": "SANDBOX",
  "issuedAt": "2026-07-19T22:00:00-03:00",
  "store": {
    "legalName": "Restaurante Exemplo LTDA",
    "tradeName": "Restaurante Exemplo",
    "cnpj": "00000000000000",
    "stateRegistration": "000000000000",
    "uf": "SP"
  },
  "consumer": {
    "cpfCnpj": "00000000000",
    "name": "CONSUMIDOR FINAL"
  },
  "sale": {
    "comanda": "25",
    "operator": "CAIXA 01",
    "pdv": "CAIXA PRINCIPAL",
    "items": [
      {
        "code": "001",
        "description": "REFEIÇÃO POR KG",
        "ncm": "21069029",
        "cfop": "5102",
        "unit": "KG",
        "quantity": 0.742,
        "unitPrice": 79.9,
        "total": 59.29,
        "cstCsosn": "500"
      }
    ],
    "totalProducts": 59.29,
    "discountTotal": 0,
    "increaseTotal": 0,
    "totalNfce": 59.29
  },
  "payments": [
    {
      "type": "DINHEIRO",
      "amount": 60
    }
  ],
  "change": 0.71
}
```

### Exemplo de resposta inicial

```json
{
  "id": "fiscal-document-id",
  "integrationId": "cashier-sale-123",
  "status": "enqueued",
  "message": "NFC-e recebida e enfileirada para processamento."
}
```

## 7. Status Fiscais

Status previstos:

| Status | Significado |
| --- | --- |
| `created` | Documento criado, ainda não enfileirado |
| `enqueued` | Documento enfileirado para processamento |
| `processing` | Documento em processamento |
| `authorized` | NFC-e autorizada |
| `inContingent` | NFC-e emitida em contingência |
| `rejected` | NFC-e rejeitada |
| `canceled` | NFC-e cancelada |
| `denied` | NFC-e denegada |
| `manualReview` | Requer análise manual |

## 8. Processing Detail

Cada alteração relevante deve registrar:

```json
{
  "status": "success",
  "message": "NFC-e autorizada.",
  "code": "100",
  "processedAt": "2026-07-19T22:00:05-03:00"
}
```

Campos:

- `status`: `success`, `processing` ou `failed`;
- `message`: mensagem operacional ou fiscal;
- `code`: código retornado pela validação/gateway/SEFAZ;
- `processedAt`: data/hora do processamento.

## 9. Consulta de Documento Fiscal

Endpoint planejado:

```http
GET /v1/fiscal/nfce/{id}
```

Uso:

- acompanhar status;
- reconciliar pendências;
- atualizar dashboard fiscal;
- recuperar chave de acesso;
- recuperar protocolo;
- consultar motivo de rejeição.

## 10. Download de XML e DANFE

Endpoints planejados:

```http
GET /v1/fiscal/nfce/{id}/xml
GET /v1/fiscal/nfce/{id}/danfe
```

Regras:

- XML e DANFE só devem ser definitivos após autorização ou contingência válida.
- Documento em rejeição deve manter o payload e motivo, mas não deve ser tratado como autorizado.
- Documento em contingência deve informar claramente esse estado.

## 11. Cancelamento

Endpoint planejado:

```http
DELETE /v1/fiscal/nfce/{id}
```

Body:

```json
{
  "reason": "Cancelamento solicitado pelo operador."
}
```

Regras:

- Cancelamento deve exigir permissão.
- Cancelamento deve gerar auditoria.
- Documento em contingência pode ter restrição até autorização definitiva.
- Motivo deve ser persistido.

## 12. Webhooks

Endpoint que o PDVTouch pode receber:

```http
POST /v1/fiscal/webhooks/status
```

Eventos previstos:

| Evento | Descrição |
| --- | --- |
| `invoice.status_changed` | Qualquer alteração de status |
| `invoice.authorized` | NFC-e autorizada |
| `invoice.rejected` | NFC-e rejeitada |
| `invoice.canceled` | NFC-e cancelada |
| `invoice.contingency` | NFC-e emitida em contingência |

### Payload padrão

```json
{
  "id": "event-id",
  "event": "invoice.status_changed",
  "data": {
    "id": "fiscal-document-id",
    "integrationId": "cashier-sale-123",
    "status": "authorized",
    "environment": "SANDBOX",
    "accessKey": "35260700000000000000650010000000011000000001",
    "authorization": {
      "protocol": "135260000000000",
      "date": "2026-07-19T22:00:05-03:00"
    },
    "processingDetail": {
      "status": "success",
      "message": "NFC-e autorizada.",
      "code": "100"
    }
  }
}
```

## 13. Política de Retry de Webhook

Quando a entrega de webhook falhar, aplicar até 5 tentativas:

| Tentativa | Intervalo |
| --- | --- |
| 1ª | 5 minutos |
| 2ª | 30 minutos |
| 3ª | 1 hora |
| 4ª | 4 horas |
| 5ª | 16 horas |

Após 5 falhas consecutivas:

- marcar webhook como desabilitado;
- registrar alerta no `Pdv_Sefaz`;
- orientar reconciliação via consulta;
- não perder a venda nem o documento fiscal.

## 14. Contingência NFC-e

Objetivo:

Permitir continuidade da operação quando a SEFAZ estiver temporariamente indisponível.

Regras:

- Contingência deve ser habilitada por empresa.
- Uso deve ser controlado pelo gateway fiscal.
- Documento em contingência deve receber status `inContingent`.
- XML/DANFE de contingência devem indicar claramente esse estado.
- Quando a SEFAZ voltar, o sistema deve regularizar automaticamente.
- Após autorização definitiva, status deve mudar para `authorized`.
- Em rejeição definitiva, status deve mudar para `rejected`.

## 15. Fila Local no PDV

O PDV local deve manter tabela/fila para documentos fiscais:

- `PENDING`;
- `OFFLINE`;
- `AUTHORIZED`;
- `REJECTED`;
- `CANCELLED`;
- `MANUAL_REVIEW`.

Regras:

- Se não houver internet, salvar como `OFFLINE`.
- Se houver falha temporária, salvar como `PENDING`.
- Se houver rejeição fiscal, salvar como `REJECTED`.
- Se produção estiver bloqueada, salvar como `MANUAL_REVIEW`.
- Reprocessar automaticamente quando a conexão voltar.

## 16. Integração com Pdv_Sefaz

A interface `Pdv_Sefaz` deve mostrar:

- ambiente ativo;
- produção bloqueada ou liberada;
- pendências fiscais;
- documentos offline;
- documentos autorizados;
- documentos rejeitados;
- documentos em revisão manual;
- tentativas de envio;
- motivo da última falha;
- botão de reenvio manual;
- configuração do gateway fiscal;
- política de retry;
- webhook configurado;
- estado de contingência.

## 17. Segurança

- API Key não deve ser exibida completa após salva.
- Configurações fiscais devem exigir perfil autorizado.
- Troca de ambiente deve ser auditável.
- Produção deve permanecer bloqueada enquanto o gateway real não estiver validado.
- Toda emissão, cancelamento, rejeição e reenvio deve gerar log estruturado.

## 18. Próximos Passos

1. Criar `PdvTouchFiscalGateway` real.
2. Definir contrato final do payload NFC-e.
3. Criar backend fiscal com endpoints planejados.
4. Implementar idempotência por `integrationId`.
5. Implementar worker fiscal server-side.
6. Implementar recebimento de webhooks.
7. Implementar reconciliação por consulta.
8. Implementar download de XML e DANFE.
9. Validar homologação com contador/responsável fiscal.
10. Só então liberar produção.
