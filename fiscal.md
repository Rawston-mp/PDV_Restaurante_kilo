# Plano de Implementação – API Fiscal Própria PDVTouch (NFC-e Real)

**Objetivo:** Emitir NFC-e modelo 65 autorizada diretamente pela SEFAZ-SP sem depender de fornecedor terceirizado.

**Status atual (2026-07):**  
- Arquitetura conceitual boa (`FiscalDocument`, `FiscalGateway`, fila, retry, `MockFiscalGateway`).  
- Faltam os componentes críticos: geração de XML, assinatura digital A1 e transmissão real para SEFAZ.  
- `SEFAZ_PRODUCTION_READY = false` (bloqueio intencional).

**Princípio inegociável:** Só liberar produção após homologação validada com contador e SEFAZ-SP.

---

## tasks.json – Fases e Tarefas

```json
{
  "project": "PDVTouch Fiscal API – NFC-e Real",
  "version": "1.0.0",
  "lastUpdated": "2026-07-31",
  "phases": [
    {
      "phase": 0,
      "name": "Preparação e Estrutura Base",
      "status": "pending",
      "tasks": [
        {
          "id": "F0-T1",
          "title": "Criar estrutura de pastas do módulo fiscal",
          "description": "Estrutura domain/ports, application/use-cases, infrastructure/gateways, xml/templates, signing/",
          "status": "pending",
          "priority": "high",
          "estimatedHours": 2
        },
        {
          "id": "F0-T2",
          "title": "Definir interfaces base (XmlBuilder, DigitalSigner, SefazClient)",
          "description": "Criar contratos TypeScript para os componentes críticos",
          "status": "pending",
          "priority": "high",
          "estimatedHours": 3
        },
        {
          "id": "F0-T3",
          "title": "Atualizar FiscalGateway para suportar gateway real",
          "description": "Estender interface para aceitar authorizeNfce real + métodos de cancelamento e consulta",
          "status": "pending",
          "priority": "high",
          "estimatedHours": 2
        },
        {
          "id": "F0-T4",
          "title": "Criar entidade NfceNumberControl",
          "description": "Controle de numeração fiscal por CNPJ + ambiente + série",
          "status": "pending",
          "priority": "medium",
          "estimatedHours": 2
        }
      ]
    },
    {
      "phase": 1,
      "name": "Geração de XML NFC-e 4.00 + Chave de Acesso",
      "status": "pending",
      "tasks": [
        {
          "id": "F1-T1",
          "title": "Implementar NfceKeyGenerator",
          "description": "Gerar chave de acesso de 44 dígitos conforme algoritmo oficial da SEFAZ",
          "status": "pending",
          "priority": "critical",
          "estimatedHours": 4
        },
        {
          "id": "F1-T2",
          "title": "Criar NfceXmlBuilder (layout 4.00)",
          "description": "Montar XML completo do lote NFC-e (infNFe, ide, emit, det, total, pag, infAdic)",
          "status": "pending",
          "priority": "critical",
          "estimatedHours": 12
        },
        {
          "id": "F1-T3",
          "title": "Mapear tributação por item (ICMS, PIS, COFINS)",
          "description": "Ler dados fiscais do produto e aplicar regras corretas no XML",
          "status": "pending",
          "priority": "high",
          "estimatedHours": 6
        },
        {
          "id": "F1-T4",
          "title": "Gerar QR Code dinâmico (modelo 2)",
          "description": "Implementar geração do QR Code + urlChave conforme NT 2015.002",
          "status": "pending",
          "priority": "high",
          "estimatedHours": 4
        },
        {
          "id": "F1-T5",
          "title": "Criar templates XML em infrastructure/xml/templates",
          "description": "Templates base para NFe, det, impostos, etc.",
          "status": "pending",
          "priority": "medium",
          "estimatedHours": 3
        }
      ]
    },
    {
      "phase": 2,
      "name": "Assinatura Digital com Certificado A1",
      "status": "pending",
      "tasks": [
        {
          "id": "F2-T1",
          "title": "Implementar CertificateLoader (PFX/P12 seguro)",
          "description": "Carregar certificado sem expor senha em localStorage. Usar Windows Store ou cofre seguro",
          "status": "pending",
          "priority": "critical",
          "estimatedHours": 5
        },
        {
          "id": "F2-T2",
          "title": "Criar DigitalSignatureService",
          "description": "Assinar XML com SHA-256 + RSA usando node-forge ou xml-crypto",
          "status": "pending",
          "priority": "critical",
          "estimatedHours": 8
        },
        {
          "id": "F2-T3",
          "title": "Validar expiração do certificado antes de assinar",
          "description": "Integrar com digitalCertificateRules.ts e bloquear emissão se vencido",
          "status": "pending",
          "priority": "high",
          "estimatedHours": 2
        },
        {
          "id": "F2-T4",
          "title": "Testar assinatura em ambiente de homologação",
          "description": "Validar assinatura com certificado de teste da SEFAZ",
          "status": "pending",
          "priority": "high",
          "estimatedHours": 4
        }
      ]
    },
    {
      "phase": 3,
      "name": "Gateway Real SEFAZ-SP (SefazSpGateway)",
      "status": "pending",
      "tasks": [
        {
          "id": "F3-T1",
          "title": "Criar SefazSpGateway implements FiscalGateway",
          "description": "Implementação real do gateway substituindo o Mock",
          "status": "pending",
          "priority": "critical",
          "estimatedHours": 6
        },
        {
          "id": "F3-T2",
          "title": "Integrar webservice NFeAutorizacao4",
          "description": "Transmissão do lote assinado para SEFAZ-SP",
          "status": "pending",
          "priority": "critical",
          "estimatedHours": 8
        },
        {
          "id": "F3-T3",
          "title": "Integrar NFeRetAutorizacao4 e NFeConsultaProtocolo4",
          "description": "Consulta de status e protocolo de autorização",
          "status": "pending",
          "priority": "high",
          "estimatedHours": 5
        },
        {
          "id": "F3-T4",
          "title": "Tratar códigos de retorno (cStat)",
          "description": "Mapear 100 (autorizado), 101/102 (rejeitado), 656 (contingência), etc.",
          "status": "pending",
          "priority": "high",
          "estimatedHours": 4
        },
        {
          "id": "F3-T5",
          "title": "Implementar contingência (SVC-AN / FS-DA)",
          "description": "Modo offline com posterior regularização",
          "status": "pending",
          "priority": "high",
          "estimatedHours": 6
        }
      ]
    },
    {
      "phase": 4,
      "name": "Numeração Fiscal + Cancelamento + Inutilização",
      "status": "pending",
      "tasks": [
        {
          "id": "F4-T1",
          "title": "Implementar controle de numeração atômico",
          "description": "Tabela NfceNumberControl com geração segura por CNPJ + ambiente + série",
          "status": "pending",
          "priority": "high",
          "estimatedHours": 5
        },
        {
          "id": "F4-T2",
          "title": "Criar CancelNfceUseCase",
          "description": "Evento de cancelamento com transmissão para SEFAZ",
          "status": "pending",
          "priority": "high",
          "estimatedHours": 6
        },
        {
          "id": "F4-T3",
          "title": "Implementar inutilização de numeração",
          "description": "Registro de inutilização quando houver salto de numeração",
          "status": "pending",
          "priority": "medium",
          "estimatedHours": 4
        }
      ]
    },
    {
      "phase": 5,
      "name": "Geração de DANFE NFC-e",
      "status": "pending",
      "tasks": [
        {
          "id": "F5-T1",
          "title": "Criar GenerateDanfeUseCase",
          "description": "Gerar PDF/impressão com layout oficial da NFC-e",
          "status": "pending",
          "priority": "high",
          "estimatedHours": 8
        },
        {
          "id": "F5-T2",
          "title": "Integrar QR Code impresso no DANFE",
          "description": "QR Code dinâmico no layout de impressão",
          "status": "pending",
          "priority": "high",
          "estimatedHours": 3
        },
        {
          "id": "F5-T3",
          "title": "Testar impressão em impressora térmica",
          "description": "Validar layout em hardware real do restaurante",
          "status": "pending",
          "priority": "medium",
          "estimatedHours": 3
        }
      ]
    },
    {
      "phase": 6,
      "name": "Fila Persistente + Backend + Homologação",
      "status": "pending",
      "tasks": [
        {
          "id": "F6-T1",
          "title": "Substituir Dexie por fila persistente no backend",
          "description": "BullMQ + PostgreSQL ou tabela fiscal_queue no Node",
          "status": "pending",
          "priority": "high",
          "estimatedHours": 8
        },
        {
          "id": "F6-T2",
          "title": "Implementar webhook de status fiscal",
          "description": "Endpoint para receber atualizações assíncronas da SEFAZ",
          "status": "pending",
          "priority": "medium",
          "estimatedHours": 5
        },
        {
          "id": "F6-T3",
          "title": "Executar homologação oficial na SEFAZ-SP",
          "description": "Testes reais com certificado de homologação e contador",
          "status": "pending",
          "priority": "critical",
          "estimatedHours": 20
        },
        {
          "id": "F6-T4",
          "title": "Definir SEFAZ_PRODUCTION_READY = true",
          "description": "Só após homologação aprovada e contador validado",
          "status": "pending",
          "priority": "critical",
          "estimatedHours": 1
        }
      ]
    }
  ],
  "summary": {
    "totalTasks": 32,
    "criticalTasks": 8,
    "estimatedTotalHours": 148,
    "estimatedWeeks": "6-8 semanas (considerando homologação)"
  }
}
```

---

## Resumo Executivo

| Fase | Nome | Prioridade | Esforço Estimado | Status |
|------|------|------------|------------------|--------|
| 0 | Preparação e Estrutura | Alta | 9h | Pendente |
| 1 | XML + Chave de Acesso | Crítica | 29h | Pendente |
| 2 | Assinatura Digital A1 | Crítica | 19h | Pendente |
| 3 | Gateway SEFAZ Real | Crítica | 29h | Pendente |
| 4 | Numeração + Cancelamento | Alta | 15h | Pendente |
| 5 | DANFE NFC-e | Alta | 14h | Pendente |
| 6 | Fila + Homologação | Crítica | 34h | Pendente |

**Total estimado:** ~148 horas (6–8 semanas com homologação).

---

## Observações Importantes

1. **Nunca liberar produção** enquanto `SEFAZ_PRODUCTION_READY = false`.
2. Toda emissão em produção deve passar por **homologação oficial** da SEFAZ-SP.
3. O contador do restaurante deve validar o fluxo fiscal antes de `F6-T4`.
4. Segurança do certificado A1 é prioridade máxima — nunca expor senha.

---

**Próximo passo sugerido:** Iniciar pela **Fase 0** (estrutura) ou pela **Fase 1** (XML + chave), pois são os fundamentos para tudo que vem depois.

Deseja que eu comece a implementar alguma tarefa específica agora?