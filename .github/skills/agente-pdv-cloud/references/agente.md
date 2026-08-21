# Agente PDV Cloud

Snapshot técnico elaborado a partir da branch `cod` em 2026-08-21. Antes de executar uma fase, confirme no código os fatos que possam ter mudado.

## Diagnóstico atual

### Capacidades existentes

- Aplicação Electron empacota frontend React/Vite e backend Node/Express.
- Backend local iniciado pelo Electron na porta 3001.
- APIs REST para produtos, comandas, cadastros, financeiro e administração.
- PostgreSQL e migrations iniciais para desenvolvimento.
- Dexie/IndexedDB para persistência e contingência local.
- Fila local com retry exponencial.
- Versionamento parcial de produtos e cadastros.
- Estrutura parcial de organizações, lojas, usuários, PINs e periféricos.
- Tombstones locais para exclusões de produtos.
- Socket.IO para eventos operacionais.
- Certificado A1 protegido pelo `safeStorage` do Electron.
- Testes unitários, integração e E2E.

### Lacunas críticas

#### Release local

- O instalador Electron leva frontend e backend, mas não instala PostgreSQL.
- Produtos e outros módulos degradam para Dexie quando o banco não está disponível.
- Alguns dados permanecem em `localStorage`, sem transação, backup ou isolamento por loja.
- O release precisa funcionar sem Docker e sem banco externo instalado.

#### Autenticação e autorização

- Login atual usa perfil e PIN verificados no frontend.
- Não existe emissão real de JWT, refresh token, revogação de sessão ou MFA.
- As rotas REST não possuem middleware de autenticação/autorização completo.
- PINs e configurações locais precisam de hash, escopo por loja e migração segura.
- Socket.IO aceita origem ampla e precisa de autenticação por conexão.

#### Multi-loja

- Existem tabelas e configurações parciais com `storeId`.
- Produtos, comandas, vendas, financeiro e outras tabelas não aplicam isolamento uniforme por organização/loja.
- O banco local Dexie não possui escopo consistente por loja.
- A API ainda pode aceitar IDs de loja informados pelo cliente sem derivação obrigatória da identidade autenticada.

#### Sincronização

- A fila genérica cobre apenas `SYNC_PRODUCTS` e `SYNC_ORDERS`.
- Parte dos repositórios tenta API e faz fallback local, mas não há protocolo cloud completo.
- Não existem outbox e inbox transacionais para todos os módulos.
- Não existe cursor global de pull, chave de idempotência padronizada ou painel de conflitos.
- Exclusões, estoque e financeiro não possuem a mesma garantia de entrega dos produtos.
- WebSocket não substitui recuperação durável após longos períodos offline.

#### Dados e domínio

- Há sobreposição entre Prisma, migrations SQL e tabelas inicializadas pelos stores.
- O backend permanece concentrado em um arquivo grande de servidor.
- Produtos e cadastros usam modelos diferentes entre API, Dexie e PostgreSQL.
- Estoque ainda pode ser tratado como valor mutável em vez de livro de movimentações.
- Financeiro e configurações administrativas misturam repositórios e `localStorage`.
- Auditoria existe parcialmente, mas não cobre toda alteração cloud com antes/depois.

#### Nuvem e operação

- Não existe painel web remoto separado do Electron.
- Não há infraestrutura definida para staging/produção, secrets, deploy e rollback.
- Não há monitoramento central da sincronização, dispositivos ou filas.
- Backups não possuem rotina de restauração testada.
- Instalador e atualização automática precisam de assinatura e canal controlado.
- Requisitos de LGPD, retenção e resposta a incidentes precisam ser formalizados.

## Arquitetura-alvo

### Visão geral

```text
LOJA
┌──────────────────────────────────────────┐
│ PDV Electron                             │
│  ├── Interface React                     │
│  ├── API local 127.0.0.1:3001            │
│  ├── SQLite embarcado                    │
│  ├── Outbox/Inbox                        │
│  ├── Balança e impressão                 │
│  └── Certificado A1 local                │
└────────────────────┬─────────────────────┘
                     │ HTTPS + device token
                     ▼
NUVEM
┌──────────────────────────────────────────┐
│ api.atendetouch.com.br                   │
│  ├── API cloud                           │
│  ├── Autenticação e RBAC                 │
│  ├── Serviço de sincronização            │
│  ├── Auditoria                           │
│  └── PostgreSQL multi-loja               │
└────────────────────┬─────────────────────┘
                     │
                     ▼
┌──────────────────────────────────────────┐
│ gestao.atendetouch.com.br                │
│ Painel web do proprietário e gerente     │
└──────────────────────────────────────────┘
```

### Responsabilidades

#### Electron e API local

- Operar vendas, comandas, balanças, impressão e fiscal sem depender da internet.
- Persistir primeiro no SQLite.
- Registrar cada mutação sincronizável na outbox na mesma transação.
- Aplicar dados recebidos da nuvem pela inbox.
- Manter credenciais do dispositivo protegidas pelo sistema operacional.
- Armazenar certificado A1 e configurações físicas somente na loja.

#### API cloud

- Autenticar usuários e dispositivos.
- Aplicar isolamento por organização e loja.
- Processar eventos idempotentes.
- Disponibilizar alterações por cursor incremental.
- Registrar auditoria imutável.
- Fornecer dados ao painel remoto.
- Controlar revogação de dispositivos e sessões.

#### PostgreSQL cloud

- Fonte central para gestão, relatórios e consolidação multi-loja.
- Todas as tabelas relevantes contêm `organization_id` e `store_id`.
- Entidades sincronizáveis contêm `version`, `updated_at`, `updated_by`, `deleted_at` e `origin_device_id`.
- Vendas e pagamentos são append-only.
- Estoque deriva de movimentações.

#### Painel web

- Funciona em desktop e celular.
- Começa somente leitura e evolui para edição remota.
- Restringe módulos por vínculo e permissão.
- Exibe situação dos dispositivos, última sincronização e conflitos.
- Não acessa periféricos nem segredos locais.

### Contrato de sincronização

```text
POST /api/v1/sync/push
GET  /api/v1/sync/pull?cursor=<cursor>
POST /api/v1/devices/heartbeat
GET  /api/v1/sync/status
```

- Push em lotes com `eventId` único.
- Processamento idempotente no cloud.
- Pull incremental com cursor monotônico.
- WebSocket apenas sinaliza que existem novidades.
- Retry com backoff e jitter.
- Dead-letter/manual review após limite configurável.

### Resolução de conflitos

- Vendas e pagamentos: imutáveis; duplicidade eliminada por idempotência.
- Produtos e cadastros: lock otimista por versão.
- Estoque: movimentações append-only e reconciliação.
- Exclusões: tombstones com `deletedAt`.
- Configurações administrativas: cloud prevalece quando não forem locais.
- Configurações de periféricos e certificado: local prevalece e não sincroniza segredos.

### Segurança

- Usuários cloud com senha forte, hash seguro e MFA para proprietário.
- Access token curto e refresh token rotativo/revogável.
- Dispositivo ativado por código temporário e token individual.
- RBAC aplicado no backend, não somente na interface.
- CORS limitado ao domínio oficial.
- Rate limiting, proteção contra força bruta e headers seguros.
- Segredos em secret manager e banco sem porta pública.
- Auditoria com ator, loja, entidade, antes, depois, motivo e horário.

## Plano de execução

### Fase 0 — Fundação e contratos

- Registrar ADRs das decisões local-first, SQLite e multi-tenancy.
- Definir ambientes development, staging e production.
- Criar contratos compartilhados e documentação OpenAPI.
- Padronizar UUIDs, datas, versões, tombstones e códigos de erro.
- Escolher uma única fonte de migrations para cada banco.
- Criar inventário de dados mantidos em PostgreSQL, Dexie, arquivos e `localStorage`.

Critério de aceite: renderer, API local e API cloud usam os mesmos contratos versionados.

### Fase 1 — SQLite no Electron

- Criar banco SQLite no diretório `userData` do Electron.
- Implementar migrations automáticas, transações e verificação de integridade.
- Criar backup local e retenção.
- Migrar dados existentes de Dexie/`localStorage` com rollback.
- Fazer o renderer consumir prioritariamente a API local.
- Manter Dexie apenas onde houver razão documentada.

Ordem: produtos/categorias, clientes/fornecedores, estoque, comandas/vendas, financeiro e configurações.

Critério de aceite: instalação limpa funciona sem Docker/PostgreSQL e preserva operação offline.

### Fase 2 — PostgreSQL cloud multi-loja

- Modelar organizações, lojas, usuários, vínculos, dispositivos e permissões.
- Adicionar escopo obrigatório às entidades de negócio.
- Criar tabelas de produtos, categorias, clientes, fornecedores, estoque, vendas, pagamentos, financeiro, auditoria, outbox e inbox.
- Implementar índices, constraints, soft delete e versionamento.
- Criar testes de isolamento entre lojas.

Critério de aceite: nenhuma consulta ou mutação atravessa o limite de organização/loja.

### Fase 3 — Autenticação e dispositivos

- Implementar login individual cloud.
- Adicionar JWT curto, refresh rotativo e revogação.
- Adicionar MFA para proprietário.
- Criar convites e vínculos de usuários com lojas.
- Criar ativação e revogação de dispositivos.
- Migrar PIN operacional para hash e escopo por loja.
- Proteger REST e Socket.IO com autorização no backend.

Critério de aceite: nenhuma rota privada ou socket operacional funciona sem identidade válida.

### Fase 4 — Outbox/Inbox e sincronização

- Criar outbox local transacional.
- Criar inbox local e deduplicação.
- Implementar push em lote e pull por cursor.
- Adicionar idempotência, retry, jitter e dead-letter.
- Criar heartbeat e estado online/offline do dispositivo.
- Implementar conflitos por tipo de entidade.
- Criar reconciliação e reparo administrativo.

Critério de aceite: operar 72 horas offline e reconectar sem perda ou duplicidade.

### Fase 5 — Migração dos módulos

Migrar e validar, um por vez:

1. Produtos e categorias.
2. Clientes e fornecedores.
3. Funcionários e permissões.
4. Entradas e movimentações de estoque.
5. Comandas, vendas e pagamentos.
6. Financeiro.
7. Configurações administrativas permitidas.
8. Indicadores e relatórios.

Cada módulo cobre criação, edição, exclusão, offline, conflito, reinstalação e reconciliação.

### Fase 6 — Painel de gestão

- Criar aplicação web responsiva em `gestao.atendetouch.com.br`.
- Primeira entrega somente leitura: dashboard, vendas, estoque, comandas, dispositivos e sincronização.
- Segunda entrega: produtos, categorias, clientes, fornecedores, estoque, funcionários e financeiro.
- Implementar filtros por organização/loja e RBAC.
- Exibir auditoria e conflitos de sincronização.

Critério de aceite: toda alteração remota registra ator, loja, antes e depois.

### Fase 7 — Infraestrutura cloud

- Configurar DNS para `gestao.atendetouch.com.br` e `api.atendetouch.com.br`.
- Hospedar frontend em CDN e API em ambiente de containers.
- Usar PostgreSQL gerenciado com rede privada.
- Configurar TLS, secret manager, storage de imagens e backups.
- Separar staging e produção.
- Automatizar deploy e rollback.

Critério de aceite: restauração de backup e rollback testados em staging.

### Fase 8 — CI/CD e release

- Executar lint, types, testes e migrations no pipeline.
- Adicionar integração real com SQLite e PostgreSQL.
- Adicionar testes de contrato e caos de sincronização.
- Gerar Electron assinado.
- Implementar atualização automática por canal.
- Bloquear produção quando houver migration incompatível ou testes críticos falhando.

Critério de aceite: release reproduzível, assinado e reversível.

### Fase 9 — Observabilidade e LGPD

- Logs estruturados com request, organização, loja e dispositivo.
- Métricas de fila, atraso, falhas e dispositivos offline.
- Alertas operacionais e trilha de incidentes.
- Política de retenção e descarte.
- Exportação, correção e exclusão de dados pessoais quando aplicável.
- Documentar resposta a incidentes, RPO e RTO.

Critério de aceite: falha de conexão, indisponibilidade do banco e restauração possuem procedimentos testados.

### Fase 10 — Piloto e produção

1. Homologação interna.
2. Uma loja piloto com painel somente leitura.
3. Produtos e categorias remotos.
4. Clientes, fornecedores e estoque.
5. Financeiro e administração.
6. Segunda loja para validar isolamento.
7. Liberação gradual para produção.

Cada etapa exige backup, reconciliação, rollback, treinamento e monitoramento assistido.

## Definição de pronto para produção

- Electron funciona sem internet e sem PostgreSQL instalado.
- Nenhuma venda é perdida ou duplicada após reconexão.
- Mudanças remotas chegam à loja em até 30 segundos quando online.
- Isolamento entre lojas é comprovado por testes automatizados.
- API não possui rotas administrativas públicas.
- Proprietário usa MFA e dispositivos podem ser revogados.
- Backup é restaurado com sucesso em exercício real.
- Instalador e atualizações são assinados e controlados.
- Certificado A1 e credenciais físicas permanecem locais.
- Auditoria cobre todas as ações administrativas.
- Testes offline, carga, segurança, migrations e recuperação são aprovados.
- Loja piloto é concluída sem divergência de dados.

## Ordem prioritária

1. Contratos e inventário de dados.
2. SQLite local.
3. PostgreSQL cloud multi-loja.
4. Autenticação e dispositivos.
5. Motor de sincronização.
6. Produtos/categorias como piloto.
7. Painel web somente leitura.
8. Demais cadastros e estoque.
9. Financeiro e administração remota.
10. Hardening, piloto e produção.
