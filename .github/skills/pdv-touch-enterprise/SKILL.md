---
name: pdv-touch-enterprise
description: "Use when: atualizar ou consultar o fluxo operacional do PDV Touch, especialmente tela de comanda, perfis COMANDA_A/COMANDA_B, PIN, teclado numerico/virtual, sensor de peso, rotas /comanda e backend /comandas/*."
---

# PDV Touch Enterprise Skill

## Objetivo
Centralizar o estado operacional atual do projeto PDV Touch, com foco no fluxo de Comanda, autenticacao por PIN, controle de acesso por perfil e integracao com sensor de peso.

## Quando Usar
- Quando precisar entender o fluxo principal da tela `/comanda`.
- Quando for alterar perfis `COMANDA_A` e `COMANDA_B`.
- Quando houver ajustes em teclado virtual, teclado numerico ou foco entre campos.
- Quando houver mudancas em leitura de peso, peso manual ou backend de comandas.
- Quando for revisar regras de acesso, PIN ou checklist de validacao operacional.

## Escopo Atual
- Tela principal de atendimento: `/comanda`.
- Rotas adicionais ativas: `/`, `/orders/new`, `/products`, `/cadastro`, `/admin`.
- Fluxo de abertura, lancamento e limpeza de comanda via frontend.
- Backend com status de comanda ativa e emissao de peso por websocket.
- Controle de acesso por perfil com RBAC.
- Confirmacao de acoes sensiveis por PIN.
- Sincronizacao e processamento de fila operacional.

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
- A comanda deve ser identificada antes de lancar itens.
- O campo ativo alterna entre `COMANDA` e `PESQUISA`.
- O teclado numerico atende o campo da comanda.
- O teclado virtual atende o campo de pesquisa.
- `Enter` no campo comanda move o foco para pesquisa.
- `Enter` na pesquisa adiciona o primeiro produto filtrado, quando existir.
- `Backspace` e `Clear` funcionam nos dois teclados.
- Ao adicionar item, a pesquisa deve ser limpa.
- Itens por unidade entram com quantidade inicial `1`.
- Itens por peso usam o peso atual do sensor ou o peso manual informado.
- Ajuste de itens ocorre por `+`, `-` e `Excluir`.
- `Proximo Cliente` limpa a comanda atual e volta o foco para o campo da comanda.

## Catalogo Atual de Exemplo
- Categorias padrao: `Saladas`, `Quentes`, `Sobremesas`, `Bebidas`.
- Produtos de exemplo incluem buffet por quilo, sobremesa e bebidas por unidade.
- Itens de bebida devem seguir fluxo por unidade, nao por peso.

## Sensor de Peso e Backend
- Backend expone `GET /comandas/status`, `POST /comandas/abrir` e `POST /comandas/fechar`.
- Evento websocket recebido no backend: `peso_sensor`.
- Evento websocket emitido para UI: `atualizar_peso`.
- Origem serial atual: `sensor_serial`.
- O backend so retransmite peso quando existe comanda ativa.
- O frontend aceita peso manual quando nao houver leitura util do sensor.

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

## Arquivos-Chave
- Frontend principal: `src/components/Comanda/ComandaScreen.tsx`
- Regra de estado da comanda: `src/hooks/comanda/useComanda.ts`
- Peso e entrada manual: `src/hooks/comanda/useWeight.ts`
- Tipos da comanda: `src/types/comanda.ts`
- Rotas e guards: `src/app/App.tsx`
- Acesso/autenticacao: `src/modules/auth/**`
- Backend de comandas: `backend/src/server.ts`
- Leitura serial de peso: `backend/src/services/scaleReader.service.ts`

## Regras de Manutencao
- Nao reintroduzir nomenclatura antiga de balanca no codigo novo.
- Para novas alteracoes operacionais, documentar sempre impacto em rota, perfil, teclado e validacao.
- Se mudar PIN, role ou evento websocket, atualizar esta skill junto.
- Se alterar fluxo de comanda, revisar E2E e build antes de concluir.

## Checklist de Validacao
1. Validar login com perfis permitidos.
2. Validar acesso da rota `/comanda` com `COMANDA_A` e `COMANDA_B`.
3. Abrir comanda e lancar item por unidade.
4. Lancar item por peso com sensor ou peso manual.
5. Ajustar quantidade com `+` e `-` e remover item.
6. Confirmar `Enter`, `Backspace` e `Clear` nos teclados.
7. Fechar ou limpar a comanda e confirmar reset de estado.
8. Rodar build e, quando aplicavel, testes automatizados.

## Comandos
```bash
npm run build
npm run test
```
