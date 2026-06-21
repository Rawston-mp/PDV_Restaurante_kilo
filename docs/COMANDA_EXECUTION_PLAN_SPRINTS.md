# Plano Técnico de Execução - Balanças (fluxo de comanda por quilo)

## Contexto
Este plano deriva diretamente do bloco "O que falta desenvolver" da skill `pdv-touch-enterprise`.
Objetivo: fechar as lacunas do fluxo de balanças/comanda por quilo com duas balanças, encerramento exclusivo no caixa e rastreabilidade operacional.

## Princípios de Execução
1. Ordem de implementação por risco e dependência técnica: domínio -> persistência -> API -> UI -> testes -> docs.
2. Nenhuma funcionalidade nova deve quebrar os endpoints legados já usados na operação atual.
3. Cada sprint deve terminar com build green, testes mínimos e atualização da skill.

---

## Sprint 1 - Núcleo Transacional e Persistência Relacional

### Objetivo
Substituir a persistência em arquivo pela persistência relacional (PostgreSQL), consolidando uma máquina de estados auditável.

### Escopo
1. Modelagem e migrações iniciais:
   1. tabela `comandas`
   2. tabela `comanda_transitions` (auditoria de transições)
   3. tabela `pesagens`
   4. índices por `numero`, `status`, `updated_at`
2. Adapter PostgreSQL para a máquina de estados:
   1. manter interface atual de store
   2. fallback para arquivo no desenvolvimento local (feature flag/env)
3. Endpoints de comanda:
   1. estabilizar `POST /api/v1/comandas`
   2. estabilizar `GET /api/v1/comandas/:numero`
   3. estabilizar `PUT /api/v1/comandas/:numero/status`
   4. estabilizar `POST /api/v1/comandas/:numero/pesagem`
4. Auditoria:
   1. transição sempre com timestamp
   2. trilha append-only persistida

### Critérios de Aceite
1. O estado sobrevive à reinicialização do backend usando PostgreSQL.
2. Transições inválidas são rejeitadas com erro de domínio.
3. Auditoria de transições consultável por comanda.
4. Build e testes verdes.

### Riscos
1. Divergência entre store em arquivo e store PG.
2. Falta de padronização de erros entre endpoints legados e v1.

---

## Sprint 2 - Duas Balanças, Lock e Código de Barras

### Objetivo
Garantir uma operação concorrente segura com duas balanças e identificação por código de barras.

### Escopo
1. Lock por comanda (`EM_USO`):
   1. lock pessimista por comanda
   2. owner do lock (`BALANCA_A` / `BALANCA_B`)
   3. timeout automático de lock
2. Controle de concorrência:
   1. impedir o uso simultâneo da mesma comanda em duas balanças
   2. mensagem operacional clara para lock ativo
3. Leitura de código de barras:
   1. endpoint de abertura por código
   2. fallback "digitar número" na tela da balança
4. Validações operacionais de pesagem:
   1. faixas min/max configuráveis
   2. rejeição de leitura fora da faixa

### Critérios de Aceite
1. O mesmo número de comanda não pode ser processado simultaneamente nas duas balanças.
2. A leitura por código abre a comanda corretamente.
3. O fallback manual de número funciona sem bloqueio.
4. Lock expira/libera conforme regra configurada.

### Riscos
1. Deadlock lógico por expiração mal calibrada.
2. Integração de hardware de scanner sem uma biblioteca padrão definida.

---

## Sprint 3 - Caixa, Timeout de Abandono e Reconciliação

### Objetivo
Fechar o ciclo operacional ponta a ponta até o caixa e entregar uma visão mínima de reconciliação.

### Escopo
1. Encerramento formal no caixa:
   1. somente caixa pode fechar comanda
   2. transição operacional `PRONTA_PARA_CAIXA -> ENCERRADA`
   3. definição do modo de fechamento (`VENDA` ou `ORCAMENTO`) para integração e relatórios
2. Timeout e abandono:
   1. alerta de inatividade em 2h
   2. política de 4h configurável por loja
3. Relatórios mínimos:
   1. discrepância balança x caixa
   2. comandas abertas sem atividade
   3. resumo de transições por período
4. E2E mínimo dos fluxos críticos:
   1. pesagem automática
   2. fallback manual
   3. lock de duas balanças
   4. encerramento no caixa

### Critérios de Aceite
1. A comanda só é encerrada no fluxo de caixa.
2. Os alertas de abandono disparam conforme a política.
3. Relatório de discrepância disponível para a operação.
4. E2E críticos verdes.

### Riscos
1. Regra de negócio de timeout sem alinhamento final com a operação.
2. Mapeamento de pagamento/status entre PDV e ERP ainda pendente.

---

## Dependências Externas (bloqueantes)
1. Confirmação da política de numeração cíclica (01-200) e reutilização por turno.
2. Definição oficial da biblioteca/hardware do leitor de código de barras.
3. Definição final de quando cada estado (`ABERTA`, `PESAGEM_EM_ANDAMENTO`, `PRONTA_PARA_CAIXA`, `ENCERRADA`, `FINALIZADA`, `ARQUIVADA`) é visível para a operação.

## Cadência de Entrega
1. Sprint 1: 1 a 2 semanas
2. Sprint 2: 1 a 2 semanas
3. Sprint 3: 1 a 2 semanas

## Definição de Pronto por Sprint
1. Funcionalidade implementada e testada.
2. Build green.
3. Atualização da skill com o status real.
4. Evidência de teste registrada (manual ou automatizada).
