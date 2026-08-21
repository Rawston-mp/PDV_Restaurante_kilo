---
name: agente-pdv-cloud
description: Planejar, implementar ou revisar a evolução do PDV Touch para arquitetura híbrida com Electron offline, SQLite local, API cloud, PostgreSQL multi-loja e painel web no domínio atendetouch.com.br. Use em trabalhos de sincronização, autenticação, multi-tenancy, infraestrutura cloud, painel remoto ou preparação para produção.
---

# Agente PDV Cloud

## Objetivo

Orientar a evolução segura do PDV Touch para uma plataforma local-first integrada à nuvem. O PDV da loja deve continuar operacional sem internet; a nuvem fornece gestão remota, consolidação multi-loja, autenticação, auditoria e sincronização.

## Referência obrigatória

Leia [references/agente.md](references/agente.md) antes de elaborar planos ou alterar persistência, autenticação, sincronização, painel remoto, Electron, API ou banco.

O documento contém:

- Diagnóstico atual confirmado na branch `cod`.
- Arquitetura-alvo para `gestao.atendetouch.com.br` e `api.atendetouch.com.br`.
- Plano de execução por fases e critérios de produção.

Valide no código qualquer informação sujeita a mudança antes de implementar. Atualize a referência quando uma fase for concluída ou uma decisão arquitetural for alterada.

## Invariantes

- O Electron opera pela API local em `127.0.0.1`; não deve depender diretamente da nuvem para vender.
- O release da loja não pode exigir Docker ou PostgreSQL instalado.
- Use SQLite embarcado como persistência operacional local e PostgreSQL como fonte central na nuvem.
- Toda mutação sincronizável deve ser atômica com uma outbox local durável.
- Vendas, pagamentos e eventos fiscais são imutáveis e idempotentes.
- Estoque é reconciliado por movimentações, não por simples substituição do saldo.
- Toda entidade cloud deve estar vinculada a organização e loja quando aplicável.
- A API deriva `organizationId` e `storeId` da identidade autenticada; não confia apenas no payload do cliente.
- Certificado A1, senha, comunicação com balança e credenciais de impressora permanecem locais.
- Alterações administrativas remotas exigem RBAC no backend e auditoria com antes/depois.
- WebSocket serve para sinalização; consistência e recuperação usam endpoints duráveis com cursor.
- Nunca exponha diretamente o backend local do Electron, PostgreSQL ou pgAdmin à internet.

## Forma de trabalho

1. Audite o estado atual e identifique a fase correspondente no plano.
2. Preserve compatibilidade com dados existentes e defina migração/rollback.
3. Faça mudanças incrementais por módulo, com contratos compartilhados.
4. Cubra cenários online, offline, reconexão, duplicidade, exclusão e conflito.
5. Valide isolamento entre lojas e autorização no backend.
6. Rode build, testes relevantes e verificações de migrations antes da entrega.
7. Registre decisões, riscos restantes e impacto na operação da loja.

## Limites de autorização

Esta skill orienta decisões técnicas, mas não autoriza deploy, criação de recursos pagos, alteração de DNS, acesso a produção, migração de dados reais ou publicação de releases. Solicite autorização imediatamente antes dessas ações.
