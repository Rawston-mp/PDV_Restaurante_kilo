# SKILL: PDV Touch Enterprise

## Objetivo
Consolidar o contexto tecnico, operacional e visual do projeto PDV Touch Restaurante para execucao, manutencao e evolucao com padrao enterprise.

Esta skill descreve o que ja foi implementado, como operar, como validar e como evoluir sem quebrar arquitetura, testes e experiencia de uso.

Documento complementar (fonte de arquitetura alvo):
- `docs/PDVTOUCH_ARCHITECTURE_BLUEPRINT.md`

## Quando usar
Use esta skill quando precisar:
- entender rapidamente o estado real do produto
- continuar desenvolvimento de frontend/backend sem regressao
- aplicar melhorias em balanca, comanda, sync offline/online e RBAC
- implementar UX de PDV touch com foco operacional
- validar alteracoes com build e testes

## Nao usar para
- setup inicial do projeto do zero em outra stack
- homologacao oficial com SEFAZ em ambiente real de producao (a integracao oficial ainda nao foi concluida)

## Stack e Arquitetura
- React 18 + TypeScript 5 + Vite 5 + Vitest 2
- Clean/Hexagonal por modulo (domain/application/infrastructure/presentation)
- Persistencia local com Dexie (IndexedDB) e fallback
- Socket.IO para peso/preco em tempo real

Fluxo arquitetural base:
- Presentation chama Use Cases
- Use Cases dependem de Ports
- Infrastructure implementa Ports

## Modulos e responsabilidades
- auth: RBAC por permissao e sessao de usuario
- orders: comanda, pedidos, status, itens, sync de pedidos
- products: cadastro, consulta, sync de produtos
- stock: ajuste de estoque
- shared/sync: fila, retry/backoff, processamento multi-modulo
- balanca UI: WeightDisplay, PriceDisplay, ProductGrid, BalancaScreen

## Funcionalidades implementadas (estado atual)

### 1) RBAC e autenticacao
- Roles suportados:
  - ADMIN
  - GERENTE
  - CAIXA
  - ATENDENTE
  - BALANCA_A
  - BALANCA_B
- Login por PIN no painel lateral (persistencia local)
- Rota protegida por permissao e por role
- Fallback seguro para ambiente de teste sem localStorage

Matriz de acesso atual (atualizada em 04/06/2026):
- Dashboard (/):
  - Permitido: ADMIN, GERENTE, CAIXA, ATENDENTE
  - Negado: BALANCA_A, BALANCA_B
- Produtos (/products):
  - Visualizar catalogo: ADMIN, GERENTE, CAIXA, ATENDENTE, BALANCA_A, BALANCA_B
  - Gerenciar (novo cadastro, editar, deletar, salvar): ADMIN, GERENTE, CAIXA, ATENDENTE
  - BALANCA_A e BALANCA_B operam em modo consulta de produtos
- Balancas (/balanca):
  - Permitido: ADMIN, GERENTE, CAIXA, BALANCA_A, BALANCA_B
- Admin (/admin):
  - Permitido: ADMIN

### 2) Acoes sensiveis com PIN separado (enterprise)
- Confirmacao por senha diferente da senha de login
- Acoes criticas implementadas na tela de balanca:
  - CLOSE_COMANDA
  - CANCEL_ORDER
- Fluxo com modal de confirmacao e feedback de sucesso/falha

### 3) Balanca em tempo real (A/B)
- Rota oficial de navegacao: /balanca
- Seletor de Balanca A e Balanca B
- Filtro de leitura por origem (quando payload contem origem)
- Peso e preco em tempo real
- Comanda ativa com tabela de itens e total

### 4) Pesquisa e atalhos de teclado
Na tela /balanca:
- / ou F3: foco no campo de pesquisa
- Ctrl+1: seleciona Balanca A
- Ctrl+2: seleciona Balanca B
- Enter: adiciona item rapidamente

### 5) Offline/Online e sincronizacao
- Conflito por version e updatedAt
- Retry com backoff exponencial
- Fila persistente com Dexie quando disponivel
- Processamento multi-modulo:
  - SYNC_PRODUCTS
  - SYNC_ORDERS

### 6) UX premium (dark dashboard)
- Sidebar com estado ativo
- Cards e topbar de operacao
- Composicao visual inspirada em telas enterprise
- Layout responsivo desktop/mobile

### 7) Estoque e entrada de mercadorias
- A aba Estoque fica dentro de Cadastros e abre em modo limpo para lancamento manual ou importacao de XML
- O botao `Importar Nota` aceita o XML original da NFe carregado da maquina e preenche o cabecalho da nota
- A tela exibe campos estruturados de cabecalho: natureza de operacao, fornecedor, numero, serie, chave de acesso, protocolo, datas e totais fiscais basicos
- A natureza de operacao usa lista fixa de opcoes para reduzir erro de preenchimento manual
- O campo de fornecedor possui busca de fornecedores ja cadastrados, com atalho `+` para localizar rapidamente quando o lancamento for manual
- Os itens importados do XML aparecem para conferencia e podem ser ajustados antes de salvar
- O caso de uso de entrada atualiza automaticamente o estoque do produto ao salvar cada item, mantendo saldo consistente
- Validado com `npm run build` e `npm run test -- --run` durante a implementacao

### 8) Certificado digital e bloqueio fiscal operacional
- O cadastro de certificado digital foi movido de Cadastros para o painel Admin
- O Admin permite importar certificado da maquina ou pen drive, salvar configuracao e remover configuracao ativa
- Validacoes fiscais ativas no cadastro: formato de CNPJ (14 digitos) e validacao de CSC/CSC ID por UF
- Regras mais estritas por UF foram aplicadas para SP, MG, RS e RJ; demais UFs usam regra padrao
- O alerta de vencimento usa padrao de 20 dias antes da expiracao (configuravel no Admin)
- O fechamento fiscal do pedido (transicao PRONTO -> ENTREGUE) bloqueia quando o certificado estiver vencido
- A tela de Novo Pedido mostra aviso de bloqueio fiscal e desabilita visualmente o botao de avancar status quando aplicavel

## Rotas oficiais
- / (restrita para ADMIN, GERENTE, CAIXA e ATENDENTE)
- /orders/new
- /products (consulta para todos os perfis; gestao bloqueada para BALANCA_A/B)
- /balanca
- /admin (somente ADMIN)

## Componentes-chave
- src/components/Balanca/WeightDisplay.tsx
- src/components/Balanca/PriceDisplay.tsx
- src/components/Balanca/ProductGrid.tsx
- src/components/Balanca/BalancaScreen.tsx
- src/modules/auth/presentation/components/AuthAccessPanel.tsx
- src/modules/auth/presentation/providers/AuthProvider.tsx

## PINs atuais (ambiente de desenvolvimento)

### Login por perfil
- Admin: 9000
- Gerente: 7070
- Caixa: 2025
- Atendente: 3030
- Balanca A: 1111
- Balanca B: 2222

### Confirmacao de acao sensivel
- Admin: 9900
- Gerente: 7700
- Caixa: 2200
- Atendente: 3300
- Balanca A: 1100
- Balanca B: 2201

## Comandos operacionais
- Instalar dependencias: npm install
- Rodar frontend: npm run dev
- Rodar testes: npm run test
- Gerar build: npm run build
- Backend (na pasta backend): npm run dev

## Padrao de desenvolvimento obrigatorio
- manter separacao por camadas (nao misturar regra de negocio na UI)
- adicionar/ajustar testes para mudancas relevantes
- preservar contratos de portas e use cases
- evitar acoplamento direto entre modulos
- manter feedback operacional claro para usuario (erro/sucesso/estado)

## Checklist de validacao antes de entrega
1. npm run test
2. npm run build
3. verificar rota /balanca com:
   - troca A/B
   - pesquisa por teclado
   - inclusao de item
   - confirmacao por PIN sensivel
4. verificar permissao de acesso por perfil
5. validar RBAC operacional:
  - BALANCA_A/B sem acesso ao Dashboard
  - BALANCA_A/B sem botao de novo cadastro em Produtos
  - BALANCA_A/B sem editar/deletar em Produtos
  - BALANCA_A/B sem exibicao de custo/margem na listagem de Produtos

## Proximas evolucoes recomendadas
1. Auditoria local de acoes sensiveis
- registrar quem, quando, qual acao, qual balanca, resultado

2. Telemetria e observabilidade
- eventos de falha em sync, websocket e confirmacao de acao

3. Seguranca para producao
- remover PINs fixos do frontend
- trocar por autenticacao server-side com hash, exp, revogacao e trilha de auditoria

4. Integracao fiscal e fechamento avancado
- preparar trilha para integracao fiscal conforme legislacao aplicavel

## Notas de seguranca
- PINs nesta skill sao apenas para ambiente de desenvolvimento/demo
- nunca publicar PINs reais em codigo cliente
- para producao, centralizar autenticacao/autorizacao no backend

## Plano por etapas (execucao guiada)

Ordem de implementacao acordada:
1. Etapa Admin
2. Etapa Balancas (A e B)
3. Etapa Caixa
4. Etapas seguintes (Gerencia, Atendente, Fiscal/Financeiro)

Regra de condução:
- cada etapa fecha com escopo definido, testes e build verdes
- nao iniciar a proxima etapa antes de concluir a anterior
- toda etapa precisa atualizar esta skill com status, decisoes e riscos

### Etapa 1: Admin (foco atual)

Objetivo:
- centralizar governanca do sistema para operacao segura e auditavel

Backlog base da etapa Admin:
1. Painel Admin dedicado
- rota propria com visao de operacao (status de sync, usuarios ativos, saude da fila)

2. Gestao de acesso e PIN
- manter perfis e PINs de login/confirmacao por perfil
- fluxo de troca de PIN com validacao minima (forca e confirmacao)

3. Governanca de acoes sensiveis
- historico de confirmacoes (quem, acao, horario, resultado)
- filtro por tipo de acao e periodo

4. Configuracoes operacionais
- parametros de balanca (A/B), timeouts, limites e comportamento offline
- parametros de sincronizacao (janela de retry e tentativas)

5. Catalogo e estoque (visao administrativa)
- operacoes de manutencao com trilha de auditoria
- alertas de estoque critico

Critérios de aceite da etapa Admin:
1. rota de Admin funcional e protegida por role/permissao
2. todas as acoes sensiveis relevantes registradas em auditoria
3. alteracoes de PIN e parametros com feedback claro de sucesso/falha
4. npm run test e npm run build sem regressao

Status atual da etapa Admin:
- Em andamento (bloco 2 concluido: gestao de PIN, filtros/export da auditoria, logs estruturados e modulo operacional de certificado digital)
