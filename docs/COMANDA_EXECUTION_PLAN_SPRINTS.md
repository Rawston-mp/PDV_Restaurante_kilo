# Plano Tecnico de Execucao - Comanda (Sprint 1, 2 e 3)

## Contexto
Este plano deriva diretamente do bloco "O que falta desenvolver" da skill `pdv-touch-enterprise`.
Objetivo: fechar as lacunas do fluxo de comanda por kilo com duas balancas, encerramento exclusivo no caixa e rastreabilidade operacional.

## Principios de Execucao
1. Ordem de implementacao por risco e dependencia tecnica: dominio -> persistencia -> API -> UI -> testes -> docs.
2. Nenhuma funcionalidade nova deve quebrar os endpoints legados ja usados na operacao atual.
3. Cada sprint deve terminar com build green, testes minimos e atualizacao da skill.

---

## Sprint 1 - Nucleo Transacional e Persistencia Relacional

### Objetivo
Substituir persistencia em arquivo por persistencia relacional (PostgreSQL), consolidando maquina de estados auditavel.

### Escopo
1. Modelagem e migracoes iniciais:
   1. tabela `comandas`
   2. tabela `comanda_transitions` (auditoria de transicoes)
   3. tabela `pesagens`
   4. indices por `numero`, `status`, `updated_at`
2. Adapter PostgreSQL para maquina de estados:
   1. manter interface atual de store
   2. fallback para arquivo em desenvolvimento local (feature flag/env)
3. Endpoints de comanda:
   1. estabilizar `POST /api/v1/comandas`
   2. estabilizar `GET /api/v1/comandas/:numero`
   3. estabilizar `PUT /api/v1/comandas/:numero/status`
   4. estabilizar `POST /api/v1/comandas/:numero/pesagem`
4. Auditoria:
   1. transicao sempre com timestamp
   2. trilha append-only persistida

### Critérios de Aceite
1. Estado sobrevive a restart do backend usando PostgreSQL.
2. Transicoes invalidas sao rejeitadas com erro de dominio.
3. Auditoria de transicoes consultavel por comanda.
4. Build e testes verdes.

### Riscos
1. Divergencia entre store em arquivo e store PG.
2. Falta de padronizacao de erro entre endpoints legados e v1.

---

## Sprint 2 - Duas Balancas, Lock e Codigo de Barras

### Objetivo
Garantir operacao concorrente segura com duas balancas e identificacao por codigo de barras.

### Escopo
1. Lock por comanda (`EM_USO`):
   1. lock pessimista por comanda
   2. owner do lock (`BALANCA_A` / `BALANCA_B`)
   3. timeout automatico de lock
2. Controle de concorrencia:
   1. impedir uso simultaneo da mesma comanda em duas balancas
   2. mensagem operacional clara para lock ativo
3. Leitura de codigo de barras:
   1. endpoint de abertura por codigo
   2. fallback "digitar numero" na tela da balanca
4. Validacoes operacionais de pesagem:
   1. faixas min/max configuraveis
   2. rejeicao de leitura fora da faixa

### Critérios de Aceite
1. Mesmo numero de comanda nao pode ser processado simultaneamente nas duas balancas.
2. Leitura por codigo abre a comanda corretamente.
3. Fallback manual de numero funciona sem bloqueio.
4. Lock expira/libera conforme regra configurada.

### Riscos
1. Deadlock logico por expiracao mal calibrada.
2. Integracao de hardware de scanner sem biblioteca padrao definida.

---

## Sprint 3 - Caixa, Timeout de Abandono e Reconciliacao

### Objetivo
Fechar ciclo operacional ponta a ponta ate o caixa e entregar visao minima de reconciliacao.

### Escopo
1. Encerramento formal no caixa:
   1. somente caixa pode fechar comanda
   2. transicao `PRONTA_PARA_CAIXA -> ENCERRADA -> FINALIZADA`
2. Timeout e abandono:
   1. alerta de inatividade em 2h
   2. politica de 4h configuravel por loja
3. Relatorios minimos:
   1. discrepancia balanca x caixa
   2. comandas abertas sem atividade
   3. resumo de transicoes por periodo
4. E2E minimo dos fluxos criticos:
   1. pesagem automatica
   2. fallback manual
   3. lock de duas balancas
   4. encerramento no caixa

### Critérios de Aceite
1. Comanda so encerra no fluxo de caixa.
2. Alertas de abandono disparam conforme politica.
3. Relatorio de discrepancia disponivel para operacao.
4. E2E criticos verdes.

### Riscos
1. Regra de negocio de timeout sem alinhamento final com operacao.
2. Mapeamento de pagamento/status entre PDV e ERP ainda pendente.

---

## Dependencias Externas (bloqueantes)
1. Confirmacao da politica de numeracao ciclica (01-200) e reuso por turno.
2. Definicao oficial da biblioteca/hardware de leitor de codigo de barras.
3. Definicao final de quando cada estado (`ENCERRADA`, `FINALIZADA`, `ARQUIVADA`) e visivel para operacao.

## Cadencia de Entrega
1. Sprint 1: 1 a 2 semanas
2. Sprint 2: 1 a 2 semanas
3. Sprint 3: 1 a 2 semanas

## Definicao de Pronto por Sprint
1. Funcionalidade implementada e testada.
2. Build green.
3. Atualizacao da skill com status real.
4. Evidencia de teste registrada (manual ou automatizada).
