---
name: pdv-touch-enterprise
description: "Use when: atualizar ou consultar o projeto PDV Touch/PDVTouch Restaurante, especialmente comanda por quilo, perfis COMANDA_A/COMANDA_B (UI Balança A/B), PIN, teclado numérico/virtual, sensor de peso, caixa, produtos, estoque, financeiro, fluxo de pagamento, backend de comandas, preparação fiscal, NFC-e, certificado, CSC, SEFAZ, homologação e testes em restaurante real."
---

# PDV Touch Enterprise Skill

## Objetivo
Centralizar o estado operacional do projeto PDV Touch/PDVTouch Restaurante com foco no fluxo de comanda por quilo (duas balanças), continuidade de atendimento, encerramento exclusivo no caixa, financeiro e evolução fiscal para NFC-e.

## Baseline Funcional (Documento 2026)
- Fluxo alvo: ENTRADA -> ESCOLHA -> BALANÇA -> CAIXA -> SAIDA.
- Dois fluxos de balança: autoatendimento e atendimento assistido.
- A comanda permanece aberta para múltiplas pesagens.
- Encerramento de comanda ocorre apenas no caixa.
- As regras esperadas incluem validações de peso, itens complementares, rastreabilidade e prevenção de concorrência entre duas balanças.

## Estado Atual do Projeto (confirmado no código)
- Frontend ativo com rota operacional de comanda: `/comanda`.
- Backend ativo com máquina de estados de comanda, lock operacional e websocket de peso:
	- `GET /comandas/status`
	- `POST /comandas/abrir`
	- `POST /comandas/fechar`
	- `POST /api/v1/comandas/:numero/lock/acquire`
	- `POST /api/v1/comandas/:numero/lock/renew`
	- `POST /api/v1/comandas/:numero/lock/release`
	- evento `peso_sensor` -> `atualizar_peso`
- Fluxo de comanda na UI:
	- abertura operacional ao confirmar número da comanda (Enter/foco em pesquisa)
	- categoria "Por quilo" bloqueada sem comanda aberta
	- fallback de peso manual no mesmo painel de peso
	- Enter no peso manual pode aplicar e lançar item
	- pesquisa de produtos exige 3+ letras e vira global por nome
	- `Próxima Comanda` limpa o número e não sugere o próximo número
	- a comanda anterior não é encerrada automaticamente ao avançar
- O catálogo vem do cadastro de produtos (sem catálogo hardcoded).
- Caixa usa cadastro real de produtos com `descricao`, foto, status `indisponivel` e status `oculto`.
- RBAC e login por PIN estão ativos.

## Estado Fiscal, Pdv_Sefaz e Homologação NFC-e (2026-07)
- O restaurante já possui certificado digital e operação fiscal funcional em outro sistema; o objetivo do dono/desenvolvedor é evoluir o PDVTouch para uso próprio homologado/testado no restaurante.
- O projeto já possui preparação fiscal na UI e nas regras:
	- seleção entre `NFC-e` e `Orçamento não fiscal` no recebimento
	- cadastro de produtos com NCM, CFOP, CST/CSOSN, PIS, COFINS, ICMS, EAN/GTIN e tipo fiscal
	- Admin com configuração fiscal, certificado, UF, CSC, CSC ID e série
	- regras de certificado/CSC em `src/shared/domain/services/digitalCertificateRules.ts`
	- bloqueios operacionais quando certificado fiscal está inválido/vencido
- O Admin possui interface `Pdv_Sefaz` para acompanhar ambiente fiscal, fila de documentos, pendências e estratégia da API fiscal própria do PDVTouch.
- O fluxo fiscal atual cria documento fiscal local e fila de processamento com persistência Dexie (`fiscalDocuments`), retry automático e mock de autorização para desenvolvimento/homologação.
- Ponto crítico: ainda não existe emissão fiscal real autorizada pela SEFAZ-SP. Não apresentar produção como pronta enquanto `SEFAZ_PRODUCTION_READY` estiver `false`.
- `Homologação` é o ambiente ativo de desenvolvimento/teste. `Produção` deve aparecer como opção visível, mas bloqueada até integração real, certificado, CSC, numeração, QR Code, transmissão e retorno fiscal estarem validados.
- Antes de substituir o sistema fiscal atual, implementar autorização real de NFC-e modelo 65: XML 4.00, assinatura A1, transmissão SEFAZ, protocolo, XML autorizado, DANFE NFC-e com QR Code, cancelamento, inutilização, contingência, exportação de XML e auditoria.
- O README raiz agora contém o roteiro de implantação/teste real: `README.md`.
- A documentação da API fiscal própria fica em `docs/PDVTOUCH_FISCAL_API.md`.

## API Fiscal Própria PDVTouch
- Não vincular a solução a fornecedor fiscal externo sem decisão explícita do usuário.
- Usar documentações externas apenas como referência técnica; não copiar nomes, marca, endpoints comerciais ou identidade de fornecedor para UI, código ou documentação final.
- Nomear a integração como `Gateway Fiscal PDVTouch` ou `API Fiscal PDVTouch`.
- Contratos planejados:
	- `POST /v1/fiscal/nfce`
	- `GET /v1/fiscal/nfce/{id}`
	- `GET /v1/fiscal/nfce/{id}/xml`
	- `GET /v1/fiscal/nfce/{id}/danfe`
	- `DELETE /v1/fiscal/nfce/{id}`
	- `POST /v1/fiscal/webhooks/status`
- Usar `integrationId` como idempotência da emissão e `X-Api-Key` como autenticação do gateway.
- Respeitar limites planejados de API: 60 requisições por minuto e 5 por segundo por credencial.
- Status fiscais esperados: `PENDING`, `OFFLINE`, `AUTHORIZED`, `REJECTED`, `CANCELLED`, `MANUAL_REVIEW`.
- A emissão fiscal deve ser assíncrona e resiliente: venda gravada localmente, documento fiscal pendente, retry automático e revisão manual se a falha não for recuperável.
- Política de retry de referência:
	- retry local automático ao voltar a conexão e em intervalo periódico
	- retry de webhook em janelas progressivas: 5 minutos, 30 minutos, 1 hora, 4 horas e 16 horas
- Se a internet cair durante venda fiscal, o caixa não deve travar a operação; deve registrar pendência fiscal, avisar o operador e regularizar automaticamente quando a conexão voltar.
- Nunca simular autorização de produção. Em produção sem gateway real validado, enviar para `MANUAL_REVIEW`/alerta operacional.

## Atualizações Recentes (2026-07)
- Aplicativo desktop Electron corrigido para produção:
	- `vite.config.ts` deve manter `base: './'` para que `dist/index.html` carregue assets por caminho relativo no `file://`.
	- `src/main.tsx` deve usar `HashRouter` quando `window.location.protocol === 'file:'` e `BrowserRouter` no navegador/dev.
	- `electron/main.cjs` deve carregar a interface com `mainWindow.loadFile(path.join(app.getAppPath(), 'dist', 'index.html'))` no pacote instalado.
- Segurança de autenticação no executável:
	- não permitir fallback automático para `Administrador` ou qualquer usuário padrão.
	- `AuthProvider` deve iniciar com `user: null`, limpar `pdv.auth.user` antigo e exigir loja, perfil e PIN a cada abertura do app.
	- não persistir login automático em `localStorage` sem uma regra explícita de lembrar acesso aprovada.
- Release validado:
	- setup principal: `release-electron\PDVTouch-Restaurante-Setup-0.1.0.exe`.
	- portable: `release-electron\PDVTouch-Restaurante-Portable-0.1.0.exe`.
	- app instalado pode ficar em `C:\Program Files\PDVTouch Restaurante\PDVTouch Restaurante.exe` quando instalado como máquina.
- Para evitar regressão de tela branca no Electron, conferir sempre que `dist/index.html` contém `./assets/...`, nunca `/assets/...`.
- Para evitar regressão de segurança, procurar antes de empacotar por `defaultUser`, `u-admin-default`, `return defaultUser` e `setItem(storageKey)` no fluxo de autenticação.

## Atualizações Recentes (2026-06)
- A UI de autenticação exibe `Balança A` e `Balança B` (mantendo as roles internas `COMANDA_A` e `COMANDA_B`).
- Rótulos visíveis de perfis devem usar `getRoleLabel()` em `src/modules/auth/domain/types/Role.ts`; não renderizar `COMANDA_A` ou `COMANDA_B` diretamente para o usuário.
- Tela do caixa com foco operacional no campo de leitura/digitação de comanda:
	- campo principal com foco contínuo para leitor/teclado
	- Enter abre atendimento por número de comanda
	- indicador visual de `Comanda ativa`
- Itens e pesagens de comanda agora persistem no backend junto ao snapshot da comanda:
	- endpoints: `GET/PUT /api/v1/comandas/:numero/items`
	- endpoints: `GET /api/v1/comandas/:numero/pesagens` e `POST /api/v1/comandas/:numero/pesagem`
	- cliente frontend: `src/shared/infrastructure/api/comandaApi.ts`
- A integração balança -> caixa e caixa -> balança usa o backend como fonte principal e o cache local como contingência:
	- chave de fallback: `pdv.comandas.itens.v1`
	- utilitário dedicado: `src/shared/infrastructure/storage/comandaCache.ts`
- No caixa, card `Comandas abertas` abre lista de comandas abertas (origem balança + caixa), com seleção direta da comanda.
- Em `Comandas abertas`, cada comanda possui ação `Cancelar` com confirmação.
- Atalho `F8` no caixa:
	- se houver comanda ativa, pergunta `Deseja cancelar a comanda ativa #X?`
	- se não houver ativa, permite escolher número entre abertas.
- Em `Mais opções`, foi adicionada a ação `Limpar cache de comandas` com confirmação.
- No `Fechar caixa` (fim de expediente), comandas fechadas/canceladas são arquivadas no backend e removidas do cache local.
- Cadastro/edição de produtos recebeu layout com mais respiro: foto e categorias em painéis separados, preview de imagem contido e grid com espaçamento maior.
- Tela de balanças recebeu fluxo contextual por etapa:
	- antes de abrir: instrução direta, teclado numérico, produtos bloqueados e CTA `ABRIR COMANDA`
	- comanda aberta: título com número, busca habilitada, teclado de busca e CTA `LIBERAR BALANÇA`
	- itens lançados: feedback de adição, lista touch ampliada e total em destaque
	- categorias, produtos e itens podem ser expandidos em uma janela operacional compacta; os produtos usam uma lista rolável com contador, e a janela é restaurada pelo botão ou pela tecla `Esc`
	- em monitores compactos (11,6 polegadas, alvo 1280x720/1366x768), a tela reduz espaçamentos automaticamente, preserva alvos touch de 44px e mantém produtos, itens e total sem sobreposição
- Feedback offline foi consolidado no header com pendências de sincronização e ação de nova tentativa.
- Imposto automático de 10% foi removido da balança; acréscimos só aparecem quando explicitamente configurados.
- Perfis `COMANDA_A/B` agora veem navegação reduzida ao terminal de balança.
- Regra de consistência no header do caixa:
	- se não houver comandas abertas, `Comanda ativa` é limpa e exibida como `Sem comanda`.

## Quando Usar
- Quando precisar entender o fluxo principal da tela `/comanda`.
- Quando for alterar perfis `COMANDA_A` e `COMANDA_B`.
- Quando houver ajustes em teclado virtual, teclado numérico ou foco entre campos.
- Quando houver mudanças na leitura de peso, no peso manual ou no backend de comandas.
- Quando for revisar regras de acesso, PIN ou checklist de validação operacional.
- Quando for alterar cadastro/edição de produtos, cards do caixa, status indisponível/oculto ou exibição de foto/descrição.
- Quando for analisar ou implementar preparação fiscal, NFC-e, certificado A1, CSC, SEFAZ, DANFE, XML, homologação, contingência, cancelamento, inutilização ou piloto em restaurante real.
- Quando for alterar `Pdv_Sefaz`, fila fiscal, retry, gateway fiscal, status de documento fiscal, contingência offline ou documentação `docs/PDVTOUCH_FISCAL_API.md`.
- Quando for atualizar documentação do projeto sobre o caminho para teste real/homologação fiscal.

## Escopo Implementado (Resumo)
- Comanda operacional por número (sem leitura de código de barras).
- Pesagem por sensor + fallback manual.
- Itens por peso/unidade usando cadastro real de produtos.
- Lock por comanda com aquisição, renovação (heartbeat) e liberação.
- Cadastro de produtos com upload local de foto, preview contido, categoria gerenciável e layout separado para foto/categorias.
- Caixa com menu operacional no card do produto para:
	- tornar indisponível (visível, mas bloqueado para adicionar)
	- ocultar (retira do grid de venda)
- Fechamento/caixa completo existe no módulo de pedidos (`/orders/new`), mas não como etapa integrada do fluxo `/comanda` com estados formais do documento.
- Financeiro possui fluxos de despesas, receitas e conta corrente; em telas financeiras, preservar filtros por tipo: despesas mostram saídas, receitas mostram entradas e conta corrente mostra entrada + saída.
- Fluxo fiscal no caixa permite escolher `NFC-e`, registra documento fiscal local e fila de retry, mas ainda não gera XML autorizado pela SEFAZ real.

## Lacunas em Relação ao Documento Base
- Não há leitura nativa de código de barras da comanda nem fallback "digitar número" na tela de balança (hoje opera por número digitado).
- Não há máquina de estados completa da comanda conforme o documento (`ABERTA`, `PESAGEM_EM_ANDAMENTO`, `PRONTA_PARA_CAIXA`, `ENCERRADA`, `FINALIZADA`, `ARQUIVADA`).
- Não há endpoints REST versionados da especificação (`/api/v1/comandas`, `/api/v1/pesagens`, `/api/v1/pagamentos`, `/api/v1/relatorios`).
- Não há persistência backend para comandas/pesagens/pagamentos/auditoria no modelo de tabelas proposto.
- Não há regras de timeout e autoencerramento por inatividade da comanda no fluxo atual.
- Não há relatórios de discrepância balança x caixa no backend dedicado.
- Não há módulo fiscal NFC-e real com XML assinado, transmissão SEFAZ, protocolo oficial, DANFE fiscal com QR Code oficial, cancelamento, inutilização e contingência fiscal homologada.

## Inconsistências do Documento de Referência
- Seção 6 possui trecho corrompido em `PA-05` (comparação de peso/valor quebrada).
- A Seção 9 (validações de pesagem) está truncada e precisa de normalização antes de se tornar um critério técnico testável.
- O documento mistura os estados finais `ENCERRADA`, `FINALIZADA`, `ARQUIVADA`; é preciso definir quando cada estado é visível operacionalmente.

## Diretriz de Evolução (sem perder o contexto atual)
1. Consolidar máquina de estados formal da comanda no domínio.
2. Introduzir identificação por código de barras sem remover fallback por número.
3. Adicionar coordenação entre duas balanças com lock por comanda + timeout.
4. Integrar etapa `PRONTA_PARA_CAIXA` até encerramento no caixa.
5. Implementar trilha de auditoria imutável para transições críticas.
6. Implementar módulo fiscal NFC-e separado do componente do caixa, com adapters para XML, assinatura, SEFAZ, DANFE e persistência fiscal.
7. Usar o sistema fiscal atual em paralelo até homologação técnica, validação contábil e piloto controlado serem concluídos.

## Perfis
- `ADMIN`
- `GERENTE`
- `CAIXA`
- `ATENDENTE`
- `COMANDA_A`
- `COMANDA_B`

## Regras de Acesso
- `COMANDA_A` e `COMANDA_B` acessam a rota `/comanda`.
- `COMANDA_A` e `COMANDA_B` não acessam o dashboard.
- Perfis de comanda podem consultar produtos, mas não devem cadastrar, editar ou excluir produtos.
- `ADMIN` e `GERENTE` concentram a gestão operacional e as configurações sensíveis.

## Fluxo de Comanda
- Número da comanda precisa ser confirmado para abrir fluxo operacional.
- Categoria "Por quilo" só deve operar com comanda aberta.
- Enter no campo comanda abre fluxo e move para pesquisa.
- Pesquisa exige mínimo de 3 letras para listar resultados.
- Em 3+ letras, busca por nome ignora categoria ativa.
- Sel-Service prioriza leitura de peso automática quando disponível.
- Se peso automático falhar, operador informa peso manual no mesmo painel.
- Enter no modo de peso manual aplica o peso e pode lançar o item.
- `Próxima Comanda` limpa o número atual, sem sugerir um novo número.
- Avançar para próxima comanda não encerra automaticamente a anterior.

## Backend de Comanda (Atual)
- Endpoint de status, abrir e fechar comanda no processo do backend.
- Endpoints de lock versionados para controle de concorrência por comanda.
- Emissão de peso websocket apenas com comanda ativa.
- Estado de comanda com máquina de estados e trilha de auditoria append-only em arquivo.

## Arquivos-Chave
- `README.md`
- `src/components/Comanda/ComandaScreen.tsx`
- `src/hooks/comanda/useComanda.ts`
- `src/hooks/comanda/useWeight.ts`
- `src/components/Comanda/WeightDisplay.tsx`
- `src/components/Comanda/CategoryGrid.tsx`
- `src/modules/cashier/presentation/pages/CashierPage.tsx`
- `src/modules/cashier/presentation/components/CashRegisterClose.tsx`
- `src/modules/cashier/presentation/components/SmartInput.tsx`
- `src/modules/products/presentation/pages/ProductsPage.tsx`
- `src/modules/admin/presentation/pages/AdminPage.tsx`
- `src/shared/domain/services/digitalCertificateRules.ts`
- `src/modules/fiscal/domain/entities/FiscalDocument.ts`
- `src/modules/fiscal/domain/ports/FiscalDocumentRepository.ts`
- `src/modules/fiscal/domain/ports/FiscalGateway.ts`
- `src/modules/fiscal/application/use-cases/RegisterPendingFiscalDocument.ts`
- `src/modules/fiscal/application/use-cases/RetryPendingFiscalDocuments.ts`
- `src/modules/fiscal/infrastructure/repositories/DexieFiscalDocumentRepository.ts`
- `src/modules/fiscal/infrastructure/gateways/MockFiscalGateway.ts`
- `src/modules/fiscal/infrastructure/container/fiscalContainer.ts`
- `src/modules/fiscal/infrastructure/container/fiscalRetryWorker.ts`
- `src/modules/fiscal/domain/services/fiscalGatewaySettings.ts`
- `src/app/styles.css`
- `src/shared/infrastructure/storage/comandaCache.ts`
- `backend/src/server.ts`
- `backend/src/services/scaleReader.service.ts`
- `docs/PDVTOUCH_ARCHITECTURE_BLUEPRINT.md`
- `docs/PDVTOUCH_FISCAL_API.md`

## Autenticação e PIN
- Login por PIN por perfil na tela de acesso.
- PINs de login exibidos atualmente na UI:
	- `Administrador`: login `9000`
	- `Caixa`: login `2025`
	- `Balança A`: login `1111`
	- `Balança B`: login `2222`
	- `Gerente`: login `7700`
	- `Atendente`: login `3300`
- PIN sensível não deve ser exposto na tela de login; fica restrito aos fluxos protegidos e à gestão de PIN no Admin.

## Regras de Manutenção
- Não reintroduzir nomenclatura antiga de balança no código novo.
- Para novas alterações operacionais, documentar sempre impacto em rota, perfil, teclado e validação.
- Se mudar PIN, role, evento websocket, autenticação Electron ou pacote de release, atualizar esta skill junto.
- Se alterar fluxo de comanda, autenticação ou empacotamento Electron, revisar testes, build e npm run electron:pack antes de concluir.
- Se alterar cadastro de produtos ou cards do caixa, validar espaçamento, overflow, imagem, menu operacional e build.
- Não assumir que backend atual suporta estados completos de comanda sem implementar camada de domínio/persistência.
- Se mexer em fiscal/NFC-e, tratar o fluxo atual como simulado até existir XML autorizado pela SEFAZ e protocolo salvo.
- Se mexer em `Pdv_Sefaz`, manter `Homologação` liberada para testes e `Produção` bloqueada enquanto `SEFAZ_PRODUCTION_READY=false`.
- Não reintroduzir nomes de fornecedores fiscais externos na UI, documentação ou código sem decisão explícita do usuário.
- Se usar documentação externa como referência, abstrair para contratos próprios do PDVTouch.
- Não permitir que venda paga em modo fiscal desapareça ou fique sem estado final: autorizada, contingência controlada, rejeitada pendente ou revisão manual.
- Não armazenar senha do certificado A1 em `localStorage`; segredos fiscais pertencem ao backend/armazenamento protegido.
- Se alterar estorno, cancelamento, reabertura, pagamento ou emissão fiscal, registrar trilha de auditoria com usuário, data/hora e motivo.

## Checklist de Validação
1. Validar login com perfis permitidos.
2. Validar acesso da rota `/comanda` com `COMANDA_A` e `COMANDA_B`.
3. Confirmar abertura de comanda antes de operar categoria "Por quilo".
4. Validar lançamento com peso automático (Sel-Service) e fallback manual.
5. Validar Enter no peso manual para aplicar/lançar item.
6. Validar `Próxima Comanda` limpando o número e sem sugestão automática.
7. Validar que avançar comanda não fecha automaticamente a anterior.
8. Validar cadastro/edição de produto com foto, categorias, descrição e status indisponível/oculto.
9. Validar cards do caixa com produto disponível, indisponível, oculto, com foto e sem foto.
10. Para financeiro, validar que Despesas lista saídas, Receita lista entradas e Conta Corrente lista entrada + saída.
11. Para `Pdv_Sefaz`, validar ambiente ativo, bloqueio de produção, tabela de documentos fiscais, retry e mensagens de pendência.
12. Para NFC-e real, validar em homologação: status SEFAZ, autorização, rejeição tratada, cancelamento, inutilização, contingência, DANFE, QR Code e exportação de XML.
13. Rodar build e, quando aplicável, testes automatizados.

## Pendências para Análise mais Precisa
- Política oficial de timeout e autoencerramento de comanda (ativos e limites).
- Regra final de numeração cíclica 01-200 e reutilização por turno.
- Requisito de hardware para leitor de código de barras (API/driver/plataforma).
- Definição formal de quando cada estado final (`ENCERRADA`, `FINALIZADA`, `ARQUIVADA`) deve ser usado.

## Comandos
```bash
npm run build
npm run test
npm run dev
```

## O que já foi desenvolvido
- Fluxo operacional de comanda na UI com abertura por número, pesquisa, lançamento, totais e teclado numérico/virtual.
- Regras recentes no hook da comanda:
	- categoria Por quilo bloqueada sem comanda aberta
	- pesquisa com mínimo de 3 letras
	- busca global por nome com 3+ letras
	- priorização de Sel-Service por peso automático
	- fallback manual com Enter
	- próxima comanda limpa o número sem sugestão
- Painel de peso unificado (automático/manual).
- Bloqueio visual de categorias no grid.
- Backend com estado de comanda ativa, itens/pesagens persistidos no snapshot e eventos de peso via websocket.
- RBAC e perfis operacionais integrados nas rotas.
- Base de persistência local Dexie e sincronização offline/online.
- Pipeline CI com build/test e artifact dist no Actions.
- Máquina de estados formal da comanda implementada no backend, com transições:
	- ABERTA -> PESAGEM_EM_ANDAMENTO
	- PESAGEM_EM_ANDAMENTO -> PRONTA_PARA_CAIXA
	- PRONTA_PARA_CAIXA -> ENCERRADA
	- ENCERRADA -> FINALIZADA
	- FINALIZADA -> ARQUIVADA
- Persistência backend-side do estado da comanda, itens e pesagens em PostgreSQL quando disponível, com fallback em arquivo (`backend/data/comandas-state.json`) e hidratação na inicialização.
- Trilha de auditoria append-only de eventos/transições (`backend/data/comandas-audit.jsonl`).
- Lock de comanda no backend com erros de conflito/ownership e eventos de auditoria (`LOCK_ACQUIRED`, `LOCK_RENEWED`, `LOCK_RELEASED`).
- Integração da tela `/comanda` com acquire/renew/release do lock, exibição de status operacional, salvamento backend de itens e registro de pesagem por item lançado.
- Caixa ligado ao cadastro real de produtos (sem mock), com nome, preço, descrição e ID no card/carrinho.
- Upload local de foto no cadastro com preview e compressão client-side.
- Controle operacional no caixa para marcar o produto como indisponível ou oculto, persistindo no cadastro.
- Cards do caixa ajustados para tamanho menor e consistente, com menu operacional compacto e labels alinhados ao produto.
- Cadastro/edição de produtos ajustado com mais espaçamento entre cards, painel de foto próprio e painel de categorias separado.
- Layout da balança ajustado para alvos touch de 48px, categorias com estado ativo forte, teclado recolhível, lista de itens legível, total financeiro ampliado e área operacional expansível.
- Exclusão de item na balança respeita regra de perfil: somente ADMIN, GERENTE e CAIXA.

## O que falta desenvolver
- Persistir a máquina de estados em banco relacional (PostgreSQL) para substituir armazenamento em arquivo local.
- Evoluir lock operacional para política final de timeout/expiração alinhada por loja e por terminal.
- Leitura de código de barras da comanda e fallback explícito de digitação na tela da balança.
- Completar a família de endpoints da especificação (`/api/v1/comandas`, `/api/v1/pesagens`, `/api/v1/pagamentos`, `/api/v1/relatorios`) com contratos finais.
- Persistência backend normalizada para comandas, pesagens, itens complementares e pagamentos (itens/pesagens já persistem no snapshot; falta schema relacional final e pagamentos).
- Evoluir persistência de comandas para tabelas relacionais normalizadas (`comandas`, `comanda_items`, `pesagens`) em vez de snapshot JSONB.
- Integração fim a fim com o caixa para o encerramento formal da comanda no fluxo da própria comanda.
- Regras de timeout e abandono de comanda (2h alerta, 4h política opcional).
- Relatórios de discrepância balança x caixa e reconciliação operacional.
- Módulo fiscal NFC-e completo (`src/modules/fiscal` e backend fiscal) com:
	- tabela `fiscal_documents`/`nfce_documents`
	- controle seguro de numeração por CNPJ/série/ambiente
	- geração de XML NFC-e modelo 65
	- assinatura com certificado A1
	- adapter SEFAZ homologação/produção
	- gravação de XML assinado/autorizado, chave, protocolo, `cStat` e `xMotivo`
	- DANFE NFC-e térmico com QR Code
	- cancelamento, inutilização, contingência e retransmissão
	- painel de pendências fiscais
	- exportação de XML para contador
- Gateway Fiscal PDVTouch real conforme `docs/PDVTOUCH_FISCAL_API.md`, substituindo o mock somente quando houver serviço fiscal homologado.
- Validação rígida de cadastro fiscal de produtos antes de venda em modo fiscal.

## O que pode melhorar
- Consolidar regras de negócio de comanda em camada de domínio única para reduzir lógica dispersa em hooks.
- Reduzir a duplicação da normalização de texto (Sel-Service/Por quilo) entre a tela e o hook.
- Cobrir novos cenários em testes automatizados da tela de comanda (categoria bloqueada, Enter no manual, próxima comanda sem sugestão).
- Separar claramente o fluxo de comanda operacional e o fluxo de caixa para evitar ambiguidades de encerramento.
- Fortalecer observabilidade operacional (eventos de transição de estado, falhas de peso/sincronização).
- Criar teste visual ou componente isolado para cards de produto e cadastro, reduzindo a regressão de espaçamento/overflow.

## Pendências ou dúvidas abertas
- Política final de numeração de comanda (01-200 cíclico) e regra de reutilização por turno/dia.
- Definição oficial de hardware e biblioteca para leitura de código de barras.
- Definição exata de quando cada estado final deve existir no sistema (ENCERRADA vs FINALIZADA vs ARQUIVADA).
- Regra final para autoencerramento por inatividade: obrigatória ou configurável por loja.
- Trechos truncados/corrompidos no texto-base (Seção 6 PA-05 e Seção 9) precisam saneamento antes de virarem critério técnico fechado.

## Recomendações prioritárias
- Prioridade alta: evoluir snapshot backend de comanda/itens/pesagens para schema PostgreSQL relacional com contratos finais.
- Prioridade alta: fechar política final de timeout/expiração para lock por comanda em duas balanças.
- Prioridade alta: entregar identificação por código de barras da comanda com fallback manual.
- Prioridade alta: implementar o módulo fiscal NFC-e real antes de qualquer piloto substituindo o sistema fiscal atual.
- Prioridade alta: manter produção fiscal bloqueada até o Gateway Fiscal PDVTouch real estar validado em homologação, com certificado A1, CSC, QR Code, protocolo e XML autorizado.
- Prioridade alta: manter o sistema fiscal atual em paralelo durante homologação e piloto controlado.
- Prioridade média: integrar fluxo PRONTA_PARA_CAIXA -> caixa -> encerramento formal no backend.
- Prioridade média: fechar pacote mínimo de testes E2E do fluxo comanda por quilo (automático, manual, exceções).
- Prioridade média: normalizar o documento-base em requisitos testáveis antes de expandir a API e o banco.
