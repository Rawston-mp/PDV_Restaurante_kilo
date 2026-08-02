# Resumo do Projeto Fiscal – PDVTouch NFC-e (API Própria)

**Data:** 2026-08-02  
**Status Geral:** base arquitetural e protótipos técnicos implementados; produção permanece bloqueada até homologação oficial, certificado A1 seguro e testes reais com a SEFAZ-SP.

---

## 🎯 Objetivo

Implementar uma **API Fiscal própria** no PDVTouch para emissão de **NFC-e modelo 65** diretamente com a SEFAZ-SP, sem depender de nenhum fornecedor terceirizado.

---

## Status Técnico Real

O módulo fiscal possui estrutura de domínio, contratos, fila, numeração, geração de XML/DANFE e adapter SOAP preparatório. Isso permite desenvolvimento e testes controlados em homologação, mas ainda não significa emissão fiscal real liberada para venda.

Antes de produção, permanecem obrigatórios:
- Armazenamento seguro do certificado A1 no Electron/backend.
- Assinatura XMLDSig/C14N validada com certificado real.
- Homologação da transmissão SOAP com a SEFAZ-SP.
- Validação de QR Code NFC-e com CSC/cHashQRCode.
- Testes de contingência com queda e retorno de internet.
- Aprovação do contador antes de ativar `SEFAZ_PRODUCTION_READY`.

## Fases Técnicas Implementadas / Em Preparação

### Fase 0 – Estrutura Base
- Estrutura completa de pastas (`domain/ports`, `application/use-cases`, `infrastructure/gateways`)
- Interfaces: `XmlBuilder`, `DigitalSigner`, `SefazClient`, `FiscalGateway`
- Entidade `NfceNumberControl`

### Fase 1 – XML + Chave de Acesso
- `NfceKeyGenerator.ts` — Chave de acesso 44 dígitos com DV módulo 11
- `NfceXmlBuilder.ts` — XML NFC-e 4.00 completo (ide, emit, det, impostos, total, pag)
- 9 testes unitários passando

### Fase 2 – Assinatura Digital A1
- `DigitalSignatureService.ts` — Carregamento de PFX/P12, SHA-256 + RSA, XMLDSig
- Validação de expiração do certificado
- Segurança: senha nunca persiste em memória

### Fase 3 – Gateway SOAP SEFAZ-SP Preparatório
- `SefazSpGateway.ts` — Orquestrador com contingência e fallback offline
- `SefazClientReal.ts` — Cliente SOAP preparatório (NFeAutorizacao4, RetAutorizacao4, ConsultaProtocolo4, Cancelamento4)
- Endpoints SEFAZ-SP mapeados para validação em homologação

### Fase 4 – Numeração + Cancelamento
- `GenerateNextNfceNumberUseCase.ts` — Geração atômica por CNPJ + ambiente + série
- `CancelNfceUseCase.ts` — Cancelamento com justificativa ≥ 15 caracteres
- `InutilizarNumeroUseCase.ts` — Inutilização de faixa de numeração

### Fase 5 – DANFE NFC-e + QR Code
- `GenerateDanfeUseCase.ts` — Cupom formatado para impressão térmica (40 colunas)
- QR Code real (modelo 2) gerado com `qrcode` → ASCII art
- Compatível com `escpos.ts`

### Fase 6 – Fila Persistente + Backend
- `FiscalQueueItem.ts` + `FiscalQueueRepository.ts`
- `FiscalQueueService.ts` — Retry com backoff progressivo (5min → 16h)
- `FiscalQueueWorker.ts` — Worker de background configurável
- `FiscalWebhookService.ts` — Webhook para receber status da SEFAZ

---

## 📦 Dependências Instaladas

| Biblioteca | Finalidade |
|------------|------------|
| `node-forge` | Assinatura digital A1 (PFX/P12) |
| `qrcode` | Geração de QR Code real (modelo 2) |

---

## 🔐 Segurança Implementada

- Certificado A1 carregado via PFX/P12 (nunca em localStorage)
- Validação de expiração **antes** de assinar
- Senha do certificado **não persiste** em memória
- `SEFAZ_PRODUCTION_READY = false` até homologação oficial

---

## 📁 Estrutura Final do Módulo Fiscal

```
src/modules/fiscal/
├── domain/
│   ├── entities/
│   │   ├── FiscalDocument.ts
│   │   ├── NfceNumberControl.ts
│   │   └── FiscalQueueItem.ts
│   ├── ports/
│   │   ├── FiscalGateway.ts
│   │   ├── XmlBuilder.ts
│   │   ├── DigitalSigner.ts
│   │   ├── SefazClient.ts
│   │   ├── FiscalDocumentRepository.ts
│   │   ├── NfceNumberControlRepository.ts
│   │   └── FiscalQueueRepository.ts
│   └── services/
│       ├── NfceKeyGenerator.ts
│       ├── NfceXmlBuilder.ts
│       └── DigitalSignatureService.ts
├── application/
│   ├── use-cases/
│   │   ├── GenerateNextNfceNumberUseCase.ts
│   │   ├── CancelNfceUseCase.ts
│   │   ├── InutilizarNumeroUseCase.ts
│   │   └── GenerateDanfeUseCase.ts
│   └── services/
│       ├── FiscalQueueService.ts
│       ├── FiscalQueueWorker.ts
│       └── FiscalWebhookService.ts
└── infrastructure/
    ├── gateways/
    │   ├── SefazSpGateway.ts
    │   ├── SefazClientReal.ts
    │   └── MockFiscalGateway.ts (existente)
    └── repositories/
        └── (a implementar: PostgreSQL)
```

---

## 🚀 Como Usar (Exemplo Rápido)

```ts
// 1. Worker de fila (backend)
const worker = new FiscalQueueWorker(queueService, 10000);
worker.start();

// 2. Webhook (endpoint)
app.post('/v1/fiscal/webhooks/status', async (req, res) => {
  const result = await webhookService.handleStatusWebhook(req.body);
  res.json(result);
});

// 3. Geração de DANFE
const danfe = await generateDanfeUseCase.execute({ document, receipt });
console.log(danfe.danfeText); // Imprimir com escpos
```

---

## ⚠️ Pendências Críticas (Homologação)

1. **Homologação oficial na SEFAZ-SP** (obrigatória)
2. Teste físico em impressora térmica real
3. Implementar repositório PostgreSQL para `FiscalQueue` e `NfceNumberControl`
4. Só definir `SEFAZ_PRODUCTION_READY = true` **após** homologação aprovada pelo contador

---

## 📊 Resumo de Esforço

- **Total de arquivos criados:** 18+
- **Testes unitários:** 9 (Fase 1)
- **Horas estimadas (implementação técnica):** ~120h
- **Horas de homologação (manual):** 20h+

---

## Conclusão

O PDVTouch agora possui uma **base fiscal própria em evolução** para emissão de NFC-e diretamente com a SEFAZ-SP, incluindo:

- Geração de XML 4.00
- Assinatura A1
- Transmissão SOAP
- Fila com retry
- DANFE com QR Code
- Cancelamento e inutilização

**Próximo marco:** validar certificado A1, assinatura XML e transmissão SOAP em homologação oficial na SEFAZ-SP.

---

*Documento gerado automaticamente em 2026-08-02*
