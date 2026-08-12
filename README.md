# PDV Touch Restaurante

Sistema de PDV para restaurante por kilo, com foco em operacao touch, comandas, balancas, caixa, financeiro, cadastro de produtos, PostgreSQL e evolucao fiscal NFC-e para SEFAZ-SP.

## Estado Atual

O projeto combina frontend React/Vite/TypeScript, backend Node/Express e persistencia em PostgreSQL local via Docker.

Principais areas ativas:
- Login por loja, perfil e PIN.
- Dashboard operacional.
- Produtos com categorias, foto, fiscal, estoque e sincronizacao com PostgreSQL.
- Balanças com fluxo de comanda e itens por peso.
- Caixa com venda direta, venda por comanda, recebimento, abertura/fechamento de caixa e pagamentos.
- Financeiro com despesas, receitas e conta corrente.
- Admin com configuracoes gerais, lojas, vinculos, perifericos e fiscal NFC-e.
- Modulo fiscal em homologacao: certificado A1 seguro, configuracoes NFC-e e preparacao local de XML homologacao.

## Stack Tecnologica

- React 18
- TypeScript 5
- Vite 5
- Tailwind/CSS modular do projeto
- Node.js + Express
- Electron
- PostgreSQL 16 via Docker
- pgAdmin via Docker
- Socket.IO para eventos operacionais
- Dexie/IndexedDB como apoio local quando aplicavel

## Arquitetura

O projeto segue uma organizacao modular inspirada em Clean Architecture/Hexagonal:

- `domain`: entidades, regras de negocio e contratos.
- `application`: casos de uso e DTOs.
- `infrastructure`: adapters, persistencia, API e servicos externos.
- `presentation`: paginas, hooks e componentes React.

O backend e o PostgreSQL devem ser a fonte de verdade para operacoes criticas como comandas, vendas, pagamentos, financeiro, auditoria e fiscal.

## Banco de Dados

Banco oficial de desenvolvimento:

```text
Host no Windows/backend: 127.0.0.1
Porta: 55432
Banco: pdv_touch_dev
Usuario: postgres
Senha: consulte o .env local
```

Comandos principais:

```bash
npm run db:up
npm run dev
npm run build
npm run db:down
```

Consulte detalhes em [Readme_bd.md](Readme_bd.md).

## Fiscal NFC-e

A tela **Configurações Fiscais NFC-e** concentra:
- Dados da empresa.
- Certificado A1.
- Ambiente homologacao/producao.
- Serie e proximo numero.
- CSC ID e CSC.
- Dados contabeis.

Status atual:
- Certificado A1 pode ser importado e armazenado com seguranca pelo Electron `safeStorage`.
- A senha do certificado e usada apenas no momento de validacao/preparacao e nao deve ficar salva.
- Existe acao para **Preparar XML homologacao**.
- O XML de homologacao e montado, assinado localmente e validado de forma estrutural antes de qualquer envio.
- Producao permanece bloqueada ate homologacao oficial e validacao contabil.
- Envio SOAP real para SEFAZ-SP ainda e a proxima etapa tecnica.

Consulte detalhes em [fiscal.md](fiscal.md).

## Electron

Durante desenvolvimento, use:

```bash
npm run electron:dev
```

Para testar apenas no navegador:

```bash
npm run dev
```

Observacao: quando a porta `5173` estiver ocupada, o Vite pode subir em `5174`, `5175` etc. Use sempre a porta exibida no terminal.

## PostgreSQL e pgAdmin

Se usar pgAdmin pelo Docker em `http://localhost:8080`, conecte no host interno do Docker:

```text
Host: postgres
Porta: 5432
Banco: pdv_touch_dev
Usuario: postgres
Senha: consulte o .env local
```

Se usar pgAdmin instalado no Windows, conecte no host exposto:

```text
Host: 127.0.0.1
Porta: 55432
Banco: pdv_touch_dev
Usuario: postgres
Senha: consulte o .env local
```

## Validacao

Comandos recomendados antes de entregar alteracoes:

```bash
npm run build
npm run test
```

Quando alterar Electron:

```bash
node -c electron/main.cjs
```

## Skill do Projeto

A skill consolidada do projeto fica em:

```text
.github/skills/pdv-touch-enterprise/SKILL.md
```

Ela deve ser atualizada sempre que houver mudanca relevante em fluxo operacional, fiscal, banco, caixa, comandas, produtos, permissao ou release.

## Proximos Passos Tecnicos

1. Evoluir a assinatura XML NFC-e para validacao XSD e XMLDSig/C14N homologada.
2. Implementar envio SOAP real para SEFAZ-SP em homologacao.
3. Persistir fila fiscal com retry e contingencia de forma completa no backend/PostgreSQL.
4. Amarrar vendas, pagamentos e fiscal em fluxo transacional robusto.
5. Validar o fluxo fiscal com contador antes de liberar producao.
