# PDV Touch Enterprise Skill

## Objetivo
Centralizar as diretrizes do projeto PDV Touch com foco no fluxo de Comanda, autenticacao por PIN e operacao segura.

## Escopo Atual
- Tela principal de atendimento: `/comanda`
- Fluxo de abertura, lancamento e fechamento de comanda
- Controle de acesso por perfil com RBAC
- Confirmacao de acoes sensiveis por PIN
- Sincronizacao e processamento de fila operacional

## Perfis
- `ADMIN`
- `GERENTE`
- `CAIXA`
- `ATENDENTE`
- `COMANDA_A`
- `COMANDA_B`

## Regras Operacionais
- Comanda deve estar identificada antes de lancar itens.
- Itens por peso aceitam leitura do sensor ou entrada manual.
- Itens por unidade entram com quantidade minima 1.
- Teclado numerico para campo de comanda e virtual para pesquisa.
- Teclas `Enter`, `Backspace` e `Clear` devem funcionar nos dois teclados.

## Seguranca
- Login por PIN por perfil.
- PIN sensivel para acoes criticas.
- Auditoria local para eventos sensiveis.

## Checklist de Validacao
1. Validar login com perfis permitidos.
2. Abrir comanda, lancar item por unidade e por peso.
3. Ajustar quantidade com `+` e `-`, e excluir item.
4. Fechar comanda e confirmar limpeza de estado.
5. Rodar build e testes automatizados.

## Comandos
```bash
npm run build
npm run test
```
