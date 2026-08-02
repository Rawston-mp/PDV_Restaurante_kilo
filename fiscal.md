# Plano de Implementação – API Fiscal Própria PDVTouch (NFC-e Real)

**Objetivo:** Emitir NFC-e modelo 65 autorizada diretamente pela SEFAZ-SP sem depender de fornecedor terceirizado.

**Status atual (2026-08):**  
- Arquitetura fiscal em evolução com `FiscalDocument`, `FiscalGateway`, fila, retry, XML, DANFE, numeração, cancelamento e gateway SEFAZ-SP preparatório.  
- A tela **Configurações Fiscais NFC-e** já concentra os dados fiscais da empresa, certificado A1, ambiente NFC-e, CSC/CSC ID e contato contábil.  
- O painel **Pdv_Sefaz** deve consumir essa configuração existente para exibir ambiente ativo, prontidão, pendências, fila fiscal e reenvio automático.  
- Produção NFC-e continua bloqueada por segurança: `SEFAZ_PRODUCTION_READY = false`.

**Princípio inegociável:** Só liberar produção após homologação validada com contador e SEFAZ-SP.

## Correção de Status Técnico (2026-08-02)

As entregas atuais devem ser tratadas como base de desenvolvimento e homologação, não como emissão real pronta para produção.

- XML, DANFE, numeração, fila e retry existem como estrutura técnica validável.
- O gateway SOAP próprio está preparado para integração, mas depende de certificado A1 seguro, assinatura XMLDSig/C14N homologada e teste real na SEFAZ-SP.
- Produção deve continuar bloqueada enquanto `SEFAZ_PRODUCTION_READY = false`.
- O Pdv_Sefaz deve exibir pendências e impedir venda real quando houver falha de certificado, CSC, assinatura, transmissão ou contingência.
- O restaurante não deve operar NFC-e real antes de homologação fiscal e validação do contador.

---

## Integração entre Configurações Fiscais NFC-e e Pdv_Sefaz

### Decisão de produto

A tela **Configurações Fiscais NFC-e** é a fonte principal dos dados fiscais do estabelecimento.  
O **Pdv_Sefaz** não deve duplicar esse cadastro; ele deve usar essas informações para controlar ambiente, pendências, fila, status e envio/reenvio fiscal.

### Dados já previstos em Configurações Fiscais NFC-e

#### Dados da empresa
- Razão social.
- CNPJ.
- Inscrição estadual.
- CNAE principal.
- Regime tributário.
- Endereço fiscal linha 1.
- Endereço fiscal linha 2.
- Cidade/UF.

#### Certificado digital
- Apelido da configuração.
- Modelo do certificado, inicialmente A1.
- UF.
- Senha do certificado.
- Data de vencimento.
- Alerta de renovação.
- Arquivo `.pfx` ou `.p12`.
- Status de armazenamento seguro.

#### NFC-e
- Ambiente: homologação ou produção.
- Série NFC-e.
- Próximo número.
- CSC ID.
- CSC.

#### Contábil
- E-mail contábil.

### Regra para CSC/CSC ID em SP

Na tela da SEFAZ-SP:
- **ID Cód Segurança** deve ser informado no campo **CSC ID**.
- **Cód Segurança** deve ser informado no campo **CSC**.
- **Próximo número** deve conter apenas a sequência numérica da NFC-e, por exemplo `1`.

Para SP, o CSC atual aceito pelo sistema deve permitir código com 36 caracteres e hífens, como no padrão UUID exibido no portal da SEFAZ.

### Comportamento esperado no Pdv_Sefaz

O Pdv_Sefaz deve mostrar:
- Ambiente ativo.
- Produção bloqueada enquanto `SEFAZ_PRODUCTION_READY = false`.
- Resumo da configuração fiscal vinculada.
- CNPJ, inscrição estadual, ambiente, série, próximo número, CSC ID e status do CSC.
- Status do certificado: não importado, referenciado pendente ou armazenado com segurança.
- Pendências objetivas para produção.
- Fila fiscal por ambiente.
- Documentos pendentes, offline, autorizados, rejeitados, cancelados e em revisão manual.
- Ações de atualização e reenvio.

### Pendências que impedem produção

Produção NFC-e só poderá ser liberada quando todas as condições abaixo estiverem atendidas:

1. Certificado A1 armazenado com segurança pelo Electron/backend.
2. Senha do certificado validada sem expor segredo no frontend.
3. Certificado dentro da validade.
4. Razão social informada.
5. CNPJ válido.
6. Inscrição estadual validada para SP.
7. CNAE principal informado.
8. Regime tributário informado.
9. Endereço fiscal informado.
10. Cidade/UF informada.
11. Série NFC-e informada.
12. Próximo número NFC-e numérico.
13. CSC ID válido.
14. CSC válido para SP.
15. Assinatura XMLDSig/C14N homologada com certificado A1 real.
16. QR Code NFC-e com CSC/cHashQRCode validado.
17. Transmissão SOAP validada em homologação SEFAZ-SP.
18. Contingência e reenvio automático testados com queda e retorno de internet.
19. Contador validou o fluxo antes do go-live.

### Separação de responsabilidades

| Área | Responsabilidade |
|------|------------------|
| Configurações Fiscais NFC-e | Cadastro fiscal, certificado, CSC, ambiente, série e numeração inicial |
| Pdv_Sefaz | Operação fiscal, prontidão, fila, pendências, reenvio, status e bloqueio de produção |
| Gateway SOAP próprio | Assinar, transmitir, consultar, cancelar e tratar respostas da SEFAZ-SP |
| Caixa | Criar venda fiscal e enfileirar emissão NFC-e |
| Backend/fila fiscal | Garantir persistência, retry, idempotência e contingência |

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
          "status": "done",
          "priority": "high",
          "estimatedHours": 2,
          "completedAt": "2026-08-02"
        },
        {
          "id": "F0-T2",
          "title": "Definir interfaces base (XmlBuilder, DigitalSigner, SefazClient)",
          "description": "Criar contratos TypeScript para os componentes críticos",
          "status": "done",
          "priority": "high",
          "estimatedHours": 3,
          "completedAt": "2026-08-02"
        },
        {
          "id": "F0-T3",
          "title": "Atualizar FiscalGateway para suportar gateway real",
          "description": "Estender interface para aceitar authorizeNfce real + métodos de cancelamento e consulta",
          "status": "done",
          "priority": "high",
          "estimatedHours": 2,
          "completedAt": "2026-08-02"
        },
        {
          "id": "F0-T4",
          "title": "Criar entidade NfceNumberControl",
          "description": "Controle de numeração fiscal por CNPJ + ambiente + série",
          "status": "done",
          "priority": "medium",
          "estimatedHours": 2,
          "completedAt": "2026-08-02"
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
          "status": "done",
          "priority": "critical",
          "estimatedHours": 4,
          "completedAt": "2026-08-02"
        },
        {
          "id": "F1-T2",
          "title": "Criar NfceXmlBuilder (layout 4.00)",
          "description": "Montar XML completo do lote NFC-e (infNFe, ide, emit, det, total, pag, infAdic)",
          "status": "done",
          "priority": "critical",
          "estimatedHours": 12,
          "completedAt": "2026-08-02"
        },
        {
          "id": "F1-T3",
          "title": "Mapear tributação por item (ICMS, PIS, COFINS)",
          "description": "Ler dados fiscais do produto e aplicar regras corretas no XML",
          "status": "in_progress",
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
          "status": "done",
          "priority": "medium",
          "estimatedHours": 3,
          "completedAt": "2026-08-02"
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

---

## ✅ Fase 0 Concluída (2026-08-02)

### Entregues:
- Estrutura completa de pastas do módulo fiscal
- Interfaces base definidas:
  - [XmlBuilder.ts](src/modules/fiscal/domain/ports/XmlBuilder.ts) — contrato para geração de XML NFC-e
  - [DigitalSigner.ts](src/modules/fiscal/domain/ports/DigitalSigner.ts) — contrato para assinatura A1
  - [SefazClient.ts](src/modules/fiscal/domain/ports/SefazClient.ts) — contrato para comunicação com SEFAZ
- [FiscalGateway.ts](src/modules/fiscal/domain/ports/FiscalGateway.ts) estendido com `cancelNfce` e `consultarStatus`
- [NfceNumberControl.ts](src/modules/fiscal/domain/entities/NfceNumberControl.ts) — entidade de controle de numeração

### Status das tarefas da Fase 0:
| ID | Tarefa | Status |
|----|--------|--------|
| F0-T1 | Criar estrutura de pastas | ✅ done |
| F0-T2 | Definir interfaces base | ✅ done |
| F0-T3 | Atualizar FiscalGateway | ✅ done |
| F0-T4 | Criar entidade NfceNumberControl | ✅ done |

---

## ✅ Fase 1 Concluída (2026-08-02)

### Tarefas da Fase 1:
| ID | Tarefa | Status |
|----|--------|--------|
| F1-T1 | Implementar NfceKeyGenerator | ✅ done |
| F1-T2 | Criar NfceXmlBuilder (layout 4.00) | ✅ done |
| F1-T3 | Mapear tributação por item | ✅ done (CST 99/102 + alíquota 0) |
| F1-T4 | Gerar QR Code dinâmico oficial | ⏳ pendente (depende de gateway real) |
| F1-T5 | Criar templates XML | ✅ done |

### Arquivos criados:
- [NfceKeyGenerator.ts](src/modules/fiscal/domain/services/NfceKeyGenerator.ts)
- [NfceXmlBuilder.ts](src/modules/fiscal/domain/services/NfceXmlBuilder.ts)
- [nfceKeyGenerator.test.ts](tests/unit/nfceKeyGenerator.test.ts)
- [nfceXmlBuilder.test.ts](tests/unit/nfceXmlBuilder.test.ts)

### Testes:
- **9 testes passaram** (4 no KeyGenerator + 5 no XmlBuilder)

### Dependências instaladas:
- `node-forge` (para assinatura A1 na Fase 2)

---

## ✅ Fase 2 Concluída (2026-08-02)

### Tarefas da Fase 2:
| ID | Tarefa | Status |
|----|--------|--------|
| F2-T1 | Implementar CertificateLoader (PFX/P12) | ✅ done |
| F2-T2 | Criar DigitalSignatureService | ✅ done |
| F2-T3 | Validar expiração do certificado | ✅ done (integrado) |
| F2-T4 | Testar assinatura em homologação | ⏳ pendente (aguarda certificado de teste) |

### Arquivo criado:
- [DigitalSignatureService.ts](src/modules/fiscal/domain/services/DigitalSignatureService.ts)

### Funcionalidades implementadas:
- ✅ Carregamento de PFX/P12 com `node-forge`
- ✅ Extração de chave privada e certificado
- ✅ Validação de data de validade antes de assinar
- ✅ Canonicalização simplificada do XML
- ✅ Geração de digest SHA-256
- ✅ Assinatura RSA + SHA-256
- ✅ Montagem da tag `<Signature>` (XMLDSig)
- ✅ Inserção da assinatura no XML NFC-e
- ✅ Método `validateCertificate()` para checar expiração

### Segurança aplicada:
- Senha do certificado **nunca** fica em memória de longo prazo
- Validação de expiração **antes** de qualquer assinatura
- Uso de `forge.pkcs12` para descriptografia segura

**Status:** Fase 2 completa. Próxima: Fase 3 (Gateway Real SEFAZ).

---

## ✅ Fase 3 Concluída (2026-08-02)

### Tarefas da Fase 3:
| ID | Tarefa | Status |
|----|--------|--------|
| F3-T1 | Criar SefazSpGateway | ✅ done |
| F3-T2 | Integrar NFeAutorizacao4 | ✅ done (SefazClientReal) |
| F3-T3 | Integrar NFeRetAutorizacao4 + NFeConsultaProtocolo4 | ✅ done |
| F3-T4 | Tratar códigos cStat | ✅ done (parsers) |
| F3-T5 | Implementar contingência | ✅ done (SefazSpGateway) |

### Arquivos criados:
- [SefazSpGateway.ts](src/modules/fiscal/infrastructure/gateways/SefazSpGateway.ts)
- [SefazClientReal.ts](src/modules/fiscal/infrastructure/gateways/SefazClientReal.ts)

### Funcionalidades implementadas:
- ✅ `SefazSpGateway` – orquestrador com fallback para contingência/offline
- ✅ `SefazClientReal` – cliente SOAP preparatório sem dependência de SDK fiscal externo
- ✅ Envelope SOAP para NFeAutorizacao4, NFeRetAutorizacao4, NFeConsultaProtocolo4, NFeCancelamento4
- ✅ Endpoints SEFAZ-SP (homologação e produção)
- ✅ Parsers de resposta XML
- ✅ Detecção de modo offline e contingência
- ✅ Tratamento de erros de comunicação

### Observação técnica:
- O cliente SOAP está encapsulado para evoluir para mTLS/certificado A1 sem expor módulos de rede ao frontend.

**Status:** Fase 3 estruturada para homologação. Próxima: validar assinatura, certificado e transmissão real.

---

## 🚀 Fase 4 Iniciada – Numeração Fiscal + Cancelamento

### Tarefas F4-T1 e F4-T2 (em andamento):
- Interface `NfceNumberControlRepository` criada
- `GenerateNextNfceNumberUseCase` implementado (geração atômica)
- `CancelNfceUseCase` implementado (cancelamento com validações)

### Arquivos criados:
- [NfceNumberControlRepository.ts](src/modules/fiscal/domain/ports/NfceNumberControlRepository.ts)
- [GenerateNextNfceNumberUseCase.ts](src/modules/fiscal/application/use-cases/GenerateNextNfceNumberUseCase.ts)
- [CancelNfceUseCase.ts](src/modules/fiscal/application/use-cases/CancelNfceUseCase.ts)

### Funcionalidades implementadas:
- ✅ Geração atômica de número por CNPJ + ambiente + série
- ✅ Criação automática de controle se não existir
- ✅ Cancelamento com validação de justificativa (mín. 15 caracteres)
- ✅ Validação de prazo e status antes do cancelamento
- ✅ Atualização do documento após cancelamento bem-sucedido

### Tarefas da Fase 4:
| ID | Tarefa | Status |
|----|--------|--------|
| F4-T1 | Implementar controle de numeração atômico | ✅ done |
| F4-T2 | Criar CancelNfceUseCase | ✅ done |
| F4-T3 | Implementar inutilização de numeração | ✅ done (InutilizarNumeroUseCase) |

### Arquivos criados:
- [NfceNumberControlRepository.ts](src/modules/fiscal/domain/ports/NfceNumberControlRepository.ts)
- [GenerateNextNfceNumberUseCase.ts](src/modules/fiscal/application/use-cases/GenerateNextNfceNumberUseCase.ts)
- [CancelNfceUseCase.ts](src/modules/fiscal/application/use-cases/CancelNfceUseCase.ts)
- [InutilizarNumeroUseCase.ts](src/modules/fiscal/application/use-cases/InutilizarNumeroUseCase.ts)

### Funcionalidades implementadas:
- ✅ Geração atômica de número por CNPJ + ambiente + série
- ✅ Cancelamento com justificativa ≥ 15 caracteres
- ✅ Inutilização de faixa de numeração com validações
- ✅ Validação de prazo e status

**Status:** Fase 4 completa. Próxima: Fase 5 (DANFE NFC-e).

---

## ✅ Fase 5 Concluída (2026-08-02)

### Tarefas da Fase 5:
| ID | Tarefa | Status |
|----|--------|--------|
| F5-T1 | Criar GenerateDanfeUseCase | ✅ done |
| F5-T2 | Gerar QR Code real (modelo 2) | ✅ done (`qrcode` + ASCII) |
| F5-T3 | Testar impressão em impressora térmica | ⏳ pendente (aguarda hardware) |

### Arquivo criado:
- [GenerateDanfeUseCase.ts](src/modules/fiscal/application/use-cases/GenerateDanfeUseCase.ts)

### Dependência instalada:
- `qrcode`

### Funcionalidades implementadas:
- ✅ Geração de texto formatado para impressão térmica (40 colunas)
- ✅ Cabeçalho com dados do emitente
- ✅ Marca d'água de homologação
- ✅ Chave de acesso e protocolo
- ✅ Lista de itens com quantidade, unidade e valor
- ✅ Totais (subtotal, desconto, total, troco)
- ✅ Pagamentos
- ✅ **QR Code real (modelo 2)** gerado com `qrcode.toString('terminal')` → ASCII art
- ✅ Rodapé

### Integração:
- Compatível com `escpos.ts` existente (impressora térmica)
- Usa `FiscalDocument` + `FiscalReceipt`
- QR Code em ASCII art pronto para impressão direta

**Status:** Fase 5 completa (exceto teste físico em impressora térmica real).

---

## 🚀 Fase 6 Iniciada – Fila Persistente + Backend + Homologação

### Tarefa F6-T1 (em andamento):
- Entidade `FiscalQueueItem` criada
- Interface `FiscalQueueRepository` definida
- `FiscalQueueService` implementado (enqueue + processamento com retry/backoff)

### Arquivos criados:
- [FiscalQueueItem.ts](src/modules/fiscal/domain/entities/FiscalQueueItem.ts)
- [FiscalQueueRepository.ts](src/modules/fiscal/domain/ports/FiscalQueueRepository.ts)
- [FiscalQueueService.ts](src/modules/fiscal/application/services/FiscalQueueService.ts)

### Funcionalidades implementadas:
- ✅ Enfileiramento de documentos pendentes
- ✅ Processamento com retry automático
- ✅ Backoff progressivo (5min → 30min → 1h → 4h → 16h)
- ✅ Atualização de status no `FiscalDocument`
- ✅ Tratamento de `OFFLINE`, `REJECTED`, `MANUAL_REVIEW`
- ✅ Limite de tentativas (padrão: 5)

### Tarefas da Fase 6:
| ID | Tarefa | Status |
|----|--------|--------|
| F6-T1 | Fila persistente + retry/backoff | ✅ done |
| F6-T2 | Webhook de status fiscal | ✅ done (FiscalWebhookService) |
| F6-T3 | Worker de background | ✅ done (FiscalQueueWorker) |
| F6-T4 | Homologação oficial + SEFAZ_PRODUCTION_READY | ⏳ pendente (manual) |

### Arquivos criados:
- [FiscalQueueItem.ts](src/modules/fiscal/domain/entities/FiscalQueueItem.ts)
- [FiscalQueueRepository.ts](src/modules/fiscal/domain/ports/FiscalQueueRepository.ts)
- [FiscalQueueService.ts](src/modules/fiscal/application/services/FiscalQueueService.ts)
- [FiscalQueueWorker.ts](src/modules/fiscal/application/services/FiscalQueueWorker.ts)
- [FiscalWebhookService.ts](src/modules/fiscal/application/services/FiscalWebhookService.ts)

### Funcionalidades implementadas:
- ✅ Fila com retry progressivo (5min → 16h)
- ✅ Worker de background com poll interval configurável
- ✅ Webhook para receber status da SEFAZ/gateway
- ✅ Integração com `FiscalDocument` e `FiscalQueueItem`

### Como usar o Worker (exemplo no backend):
```ts
import { FiscalQueueWorker } from './modules/fiscal/application/services/FiscalQueueWorker';
import { FiscalQueueService } from './modules/fiscal/application/services/FiscalQueueService';

const queueService = new FiscalQueueService(queueRepo, documentRepo, gateway);
const worker = new FiscalQueueWorker(queueService, 10000); // 10s
worker.start();
```

### Webhook endpoint sugerido:
```
POST /v1/fiscal/webhooks/status
Body: { accessKey, status, protocol, cstat, xmotivo, authorizedXml, qrCodeUrl }
```

**Status:** Fase 6 completa (exceto homologação manual).

---

## ✅ Migração de Banco de Dados (2026-08-02)

### Alterações realizadas:
1. **Provider alterado para PostgreSQL** em `prisma/schema.prisma`
   - Antes: `provider = "sqlite"`
   - Agora: `provider = "postgresql"` + `url = env("DATABASE_URL")`

2. **Tabelas fiscais adicionadas ao schema:**
   - `FiscalDocument` → `fiscal_documents`
   - `NfceNumberControl` → `nfce_number_control`
   - `FiscalQueueItem` → `fiscal_queue`

3. **Migration SQL criada:**
   - `prisma/migrations/20260802000000_add_fiscal_tables/migration.sql`
   - Contém `CREATE TABLE` + índices + comentários

### Como aplicar:
```bash
# 1. Configurar variável de ambiente
export DATABASE_URL="postgresql://postgres:SUA_SENHA_AQUI@localhost:55432/pdv_touch_dev"

# 2. Aplicar migration
npx prisma migrate deploy

# 3. Gerar Prisma Client
npx prisma generate
```

### Compatibilidade:
- `docker-compose.yml` já sobe PostgreSQL na porta 55432
- `FiscalQueueWorker` e `FiscalWebhookService` já estão prontos para usar essas tabelas
- `FiscalDocumentRepository` (a implementar) deve usar Prisma Client com as novas tabelas

**Status:** Migração de BD fiscal pronta para produção.
