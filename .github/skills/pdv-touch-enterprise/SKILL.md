# SKILL: PDV Touch Enterprise

## Objetivo
Consolidar o contexto tecnico, operacional e visual do projeto PDV Touch Restaurante para execucao, manutencao e evolucao com padrao enterprise.

Esta skill descreve o que ja foi implementado, como operar, como validar e como evoluir sem quebrar arquitetura, testes e experiencia de uso.

## Quando usar
Use esta skill quando precisar:
- entender rapidamente o estado real do produto
- continuar desenvolvimento de frontend/backend sem regressao
- aplicar melhorias em balanca, comanda, sync offline/online e RBAC
- implementar UX de PDV touch com foco operacional
- validar alteracoes com build e testes

## Nao usar para
- setup inicial do projeto do zero em outra stack
- regras fiscais/tributarias oficiais (NFC-e/SAT/SEFAZ), que ainda nao estao implementadas

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

## Rotas oficiais
- /
- /orders/new
- /products
- /balanca

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
- Em andamento (bloco 1 concluido: rota /admin, painel operacional e auditoria sensivel)
