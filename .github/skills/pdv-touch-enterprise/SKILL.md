---
name: pdv-touch-enterprise
description: "Use when: atualizar ou consultar o fluxo operacional do PDV Touch, especialmente tela de comanda, perfis COMANDA_A/COMANDA_B, PIN, teclado numerico/virtual, sensor de peso, rotas /comanda e backend /comandas/*."
---

# PDV Touch Enterprise Skill

## Objetivo
Centralizar o estado operacional do projeto PDV Touch com foco no fluxo de comanda por kilo (duas balancas), continuidade de atendimento e encerramento exclusivo no caixa.

## Baseline Funcional (Documento 2026)
- Fluxo alvo: ENTRADA -> ESCOLHA -> BALANCA -> CAIXA -> SAIDA.
- Dois fluxos de balanca: autoatendimento e atendimento assistido.
- Comanda permanece aberta para multiplas pesagens.
- Encerramento de comanda ocorre apenas no caixa.
- Regras esperadas incluem: validacoes de peso, itens complementares, rastreabilidade e prevencao de concorrencia entre duas balancas.

## Estado Atual do Projeto (confirmado no codigo)
- Frontend ativo com rota operacional de comanda: `/comanda`.
- Backend ativo com estado global de comanda e websocket de peso:
	- `GET /comandas/status`
	- `POST /comandas/abrir`
	- `POST /comandas/fechar`
	- evento `peso_sensor` -> `atualizar_peso`
- Fluxo de comanda na UI:
	- abertura operacional ao confirmar numero da comanda (Enter/foco em pesquisa)
	- categoria "Por quilo" bloqueada sem comanda aberta
	- fallback de peso manual no mesmo painel de peso
	- Enter no peso manual pode aplicar e lancar item
	- pesquisa de produtos exige 3+ letras e vira global por nome
	- `Proxima Comanda` limpa numero e nao sugere proximo numero
	- comanda anterior nao e encerrada automaticamente ao avancar
- Catalogo vem do cadastro de produtos (sem catalogo hardcoded).
- RBAC e login por PIN estao ativos.

## Quando Usar
- Quando precisar entender o fluxo principal da tela `/comanda`.
- Quando for alterar perfis `COMANDA_A` e `COMANDA_B`.
- Quando houver ajustes em teclado virtual, teclado numerico ou foco entre campos.
- Quando houver mudancas em leitura de peso, peso manual ou backend de comandas.
- Quando for revisar regras de acesso, PIN ou checklist de validacao operacional.

## Escopo Implementado (Resumo)
- Comanda operacional por numero (sem leitura de codigo de barras).
- Pesagem por sensor + fallback manual.
- Itens por peso/unidade usando cadastro real de produtos.
- Fechamento/caixa completo existe no modulo de pedidos (`/orders/new`), mas nao como etapa integrada do fluxo `/comanda` com estados formais do documento.

## Lacunas em Relacao ao Documento Base
- Nao ha fluxo explicito de duas balancas independentes com lock de concorrencia por comanda (`EM_USO`).
- Nao ha leitura nativa de codigo de barras da comanda nem fallback "digitar numero" na tela de balanca (hoje opera por numero digitado).
- Nao ha maquina de estados completa da comanda conforme documento (`ABERTA`, `PESAGEM_EM_ANDAMENTO`, `PRONTA_PARA_CAIXA`, `ENCERRADA`, `FINALIZADA`, `ARQUIVADA`).
- Nao ha endpoints REST versionados da especificacao (`/api/v1/comandas`, `/api/v1/pesagens`, `/api/v1/pagamentos`, `/api/v1/relatorios`).
- Nao ha persistencia backend para comandas/pesagens/pagamentos/auditoria no modelo de tabelas proposto.
- Nao ha regras de timeout e autoencerramento por inatividade de comanda no fluxo atual.
- Nao ha relatorios de discrepancia balanca x caixa no backend dedicado.

## Inconsistencias do Documento de Referencia
- Secao 6 possui trecho corrompido em `PA-05` (comparacao de peso/valor quebrada).
- Secao 9 (validacoes de pesagem) esta truncada e precisa normalizacao antes de virar criterio tecnico testavel.
- O documento mistura estados finais `ENCERRADA`, `FINALIZADA`, `ARQUIVADA`; precisa definir quando cada estado e visivel operacionalmente.

## Diretriz de Evolucao (sem perder contexto atual)
1. Consolidar maquina de estados formal da comanda no dominio.
2. Introduzir identificacao por codigo de barras sem remover fallback por numero.
3. Adicionar coordenacao entre duas balancas com lock por comanda + timeout.
4. Integrar etapa `PRONTA_PARA_CAIXA` ate encerramento no caixa.
5. Implementar trilha de auditoria imutavel para transicoes criticas.

## Perfis
- `ADMIN`
- `GERENTE`
- `CAIXA`
- `ATENDENTE`
- `COMANDA_A`
- `COMANDA_B`

## Regras de Acesso
- `COMANDA_A` e `COMANDA_B` acessam a rota `/comanda`.
- `COMANDA_A` e `COMANDA_B` nao acessam o dashboard.
- Perfis de comanda podem consultar produtos, mas nao devem cadastrar, editar ou excluir produtos.
- `ADMIN` e `GERENTE` concentram gestao operacional e configuracoes sensiveis.

## Fluxo de Comanda
- Numero da comanda precisa ser confirmado para abrir fluxo operacional.
- Categoria "Por quilo" so deve operar com comanda aberta.
- Enter no campo comanda abre fluxo e move para pesquisa.
- Pesquisa exige minimo de 3 letras para listar resultados.
- Em 3+ letras, busca por nome ignora categoria ativa.
- Sel-Service prioriza leitura de peso automatica quando disponivel.
- Se peso automatico falhar, operador informa peso manual no mesmo painel.
- Enter no modo de peso manual aplica peso e pode lancar item.
- `Proxima Comanda` limpa numero atual, sem sugerir novo numero.
- Avancar para proxima comanda nao encerra automaticamente a anterior.

## Backend de Comanda (Atual)
- Endpoint de status, abrir e fechar comanda no processo do backend.
- Emissao de peso websocket apenas com comanda ativa.
- Estado de comanda no backend ainda e booleano global (nao por numero/comanda).

## Arquivos-Chave
- `src/components/Comanda/ComandaScreen.tsx`
- `src/hooks/comanda/useComanda.ts`
- `src/hooks/comanda/useWeight.ts`
- `src/components/Comanda/WeightDisplay.tsx`
- `src/components/Comanda/CategoryGrid.tsx`
- `backend/src/server.ts`
- `backend/src/services/scaleReader.service.ts`

## Autenticacao e PIN
- Login por PIN por perfil na tela de acesso.
- PINs exibidos atualmente na UI:
	- `Admin`: login `9000`
	- `Caixa`: login `2025`
	- `Comanda A`: login `1111`
	- `Comanda B`: login `2222`
- PIN sensivel exibido na UI:
	- `Admin`: `9900`
	- `Caixa`: `2200`

## Regras de Manutencao
- Nao reintroduzir nomenclatura antiga de balanca no codigo novo.
- Para novas alteracoes operacionais, documentar sempre impacto em rota, perfil, teclado e validacao.
- Se mudar PIN, role ou evento websocket, atualizar esta skill junto.
- Se alterar fluxo de comanda, revisar testes e build antes de concluir.
- Nao assumir que backend atual suporta estados completos de comanda sem implementar camada de dominio/persistencia.

## Checklist de Validacao
1. Validar login com perfis permitidos.
2. Validar acesso da rota `/comanda` com `COMANDA_A` e `COMANDA_B`.
3. Confirmar abertura de comanda antes de operar categoria "Por quilo".
4. Validar lancamento com peso automatico (Sel-Service) e fallback manual.
5. Validar Enter no peso manual para aplicar/lancar item.
6. Validar `Proxima Comanda` limpando numero e sem sugestao automatica.
7. Validar que avancar comanda nao fecha automaticamente a anterior.
8. Rodar build e, quando aplicavel, testes automatizados.

## Pendencias para Analise mais Precisa
- Politica oficial de timeout e autoencerramento de comanda (ativos e limites).
- Regra final de numeracao ciclica 01-200 e reutilizacao por turno.
- Requisito de hardware para leitor de codigo de barras (API/driver/plataforma).
- Definicao formal de quando cada estado final (`ENCERRADA`, `FINALIZADA`, `ARQUIVADA`) deve ser usado.

## Comandos
```bash
npm run build
npm run test
npm run dev
```

## O que ja foi desenvolvido
- Fluxo operacional de comanda na UI com abertura por numero, pesquisa, lancamento, totais e teclado numerico/virtual.
- Regras recentes no hook da comanda:
	- categoria Por quilo bloqueada sem comanda aberta
	- pesquisa com minimo de 3 letras
	- busca global por nome com 3+ letras
	- priorizacao de Sel-Service por peso automatico
	- fallback manual com Enter
	- proxima comanda limpa numero sem sugestao
- Painel de peso unificado (automatico/manual).
- Bloqueio visual de categorias no grid.
- Backend com estado de comanda ativa e eventos de peso via websocket.
- RBAC e perfis operacionais integrados nas rotas.
- Base de persistencia local Dexie e sincronizacao offline/online.
- Pipeline CI com build/test e artifact dist no Actions.
- Maquina de estados formal da comanda implementada no backend, com transicoes:
	- ABERTA -> PESAGEM_EM_ANDAMENTO
	- PESAGEM_EM_ANDAMENTO -> PRONTA_PARA_CAIXA
	- PRONTA_PARA_CAIXA -> ENCERRADA
	- ENCERRADA -> FINALIZADA
	- FINALIZADA -> ARQUIVADA
- Persistencia backend-side do estado da comanda em arquivo (`backend/data/comandas-state.json`) com hidratacao no startup.
- Trilha de auditoria append-only de eventos/transicoes (`backend/data/comandas-audit.jsonl`).

## O que falta desenvolver
- Persistir a maquina de estados em banco relacional (PostgreSQL) para substituir armazenamento em arquivo local.
- Modelo de duas balancas com lock por comanda (EM_USO), timeout de lock e prevencao de concorrencia.
- Leitura de codigo de barras da comanda e fallback explicito de digitacao na tela da balanca.
- Completar familia de endpoints da especificacao (`/api/v1/comandas`, `/api/v1/pesagens`, `/api/v1/pagamentos`, `/api/v1/relatorios`) com contratos finais.
- Persistencia backend completa para comandas, pesagens, itens complementares e pagamentos (auditoria basica append-only ja ativa em arquivo).
- Integracao fim-a-fim com caixa para encerramento formal da comanda no fluxo da propria comanda.
- Regras de timeout e abandono de comanda (2h alerta, 4h politica opcional).
- Relatorios de discrepancia balanca x caixa e reconciliacao operacional.

## O que pode melhorar
- Consolidar regras de negocio de comanda em camada de dominio unica para reduzir logica dispersa em hooks.
- Reduzir duplicacao de normalizacao de texto (Sel-Service/Por quilo) entre tela e hook.
- Cobrir novos cenarios em testes automatizados da tela de comanda (categoria bloqueada, Enter no manual, proxima comanda sem sugestao).
- Separar claramente fluxo de comanda operacional e fluxo de caixa para evitar ambiguidades de encerramento.
- Fortalecer observabilidade operacional (eventos de transicao de estado, falhas de peso/sincronizacao).

## Pendencias ou duvidas abertas
- Politica final de numeracao de comanda (01-200 ciclico) e regra de reutilizacao por turno/dia.
- Definicao oficial de hardware e biblioteca para leitura de codigo de barras.
- Definicao exata de quando cada estado final deve existir no sistema (ENCERRADA vs FINALIZADA vs ARQUIVADA).
- Regra final para autoencerramento por inatividade: obrigatoria ou configuravel por loja.
- Trechos truncados/corrompidos no texto-base (Secao 6 PA-05 e Secao 9) precisam saneamento antes de virarem criterio tecnico fechado.

## Recomendacoes prioritarias
- Prioridade alta: persistir modelo de estado da comanda com transicoes auditaveis no backend.
- Prioridade alta: implementar lock por comanda para duas balancas, com timeout de seguranca.
- Prioridade alta: entregar identificacao por codigo de barras da comanda com fallback manual.
- Prioridade media: integrar fluxo PRONTA_PARA_CAIXA -> caixa -> encerramento formal no backend.
- Prioridade media: fechar pacote minimo de testes E2E do fluxo comanda por kilo (automatico, manual, excecoes).
- Prioridade media: normalizar o documento-base em requisitos testaveis antes de expandir API e banco.
