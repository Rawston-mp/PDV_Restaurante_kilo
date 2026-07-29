Use estes comandos no Query Tool do pgAdmin, dentro do banco oficial do projeto.

ATENÇÃO:
- Banco correto: `pdv_touch_dev`
- Host no Windows/backend: `127.0.0.1`
- Porta correta no Windows/backend: `55432`
- Usuário: `postgres`
- Senha: consulte o .env local
- No pgAdmin dentro do Docker, prefira o servidor: `PDV Touch Dev - pdv_touch_dev`
- Não use o servidor antigo `PostgreSQL 18` na porta `5432` para validar o PDV, pois ele pode conter dados antigos.

pdv_touch_dev

**************************

Produtos
SELECT product_code, name, category, price, stock, updated_at
FROM public.pdv_products
ORDER BY product_code;

**************************

Comandas
SELECT numero, status, total, item_count, opened_at, closed_at, updated_at
FROM public.comandas
ORDER BY updated_at DESC;

**************************

Itens da comanda
SELECT comanda_numero, name, quantity, weight, unit_price, subtotal, by_weight, created_at
FROM public.comanda_items
ORDER BY created_at DESC;

**************************

Vendas
SELECT id, comanda_numero, document_mode, status, subtotal, discount, total, operator, pdv, closed_at
FROM public.vendas
ORDER BY closed_at DESC;

**************************

Pagamentos
SELECT id, venda_id, method, label, amount, created_at
FROM public.pagamentos
ORDER BY created_at DESC;

**************************

Financeiro
SELECT id, finance_code, tab, movement_type, category, amount, account_name, document_ref, status, launched_at, created_at
FROM public.financeiro
ORDER BY created_at DESC;

**************************

Auditoria
SELECT id, action, user_role, entity, entity_id, status, reason, created_at
FROM public.audit_logs
ORDER BY created_at DESC
LIMIT 100;

**************************

Para ver tudo junto de uma comanda específica, por exemplo a comanda 1:
SELECT *
FROM public.comandas
WHERE numero = '1';

**************************

SELECT *
FROM public.comanda_items
WHERE comanda_numero = '1';

**************************

SELECT *
FROM public.vendas
WHERE comanda_numero = '1';

**************************

npm run build
npm run test -- tests/integration/cashMovementsUseCases.test.ts

**************************

🌟Docker: Resumo dos comandos para seu dia a dia:
Subir o Banco de Dados: npm run db:up
Iniciar a Aplicação: npm run dev (ou npm run electron:dev para abrir a interface desktop)
Desligar o Banco de Dados: npm run db:down
Se precisar de mais alguma ajuda ou ajustes no projeto, estou à disposição!

 ler os logs de erro!!!
    docker logs pdv_pgadmin

Abrir Bloco de Notas!!!
    notepad docker-compose.yml

Force o Docker a deletar o container!!!
    docker compose up -d --force-recreate pdv_pgadmin

🛠️ Comando para limpar e recriar o pgAdmin!!!
# 1. Para e remove o contêiner antigo do pgAdmin
    docker compose down pdv_pgadmin

# 2. Força a recriação limpando os volumes antigos associados a ele
    docker compose up -d --force-recreate --renew-anon-volumes pdv_pgadmin

🛠️ Derrubando e recriando o contêiner diretamente pelo comando global do Docker!!!
# 1. Remove o contêiner do pgAdmin à força
    docker rm -f pdv_pgadmin

# 2. Sobe toda a sua estrutura do zero aplicando o novo e-mail e limpando os volumes antigos
    docker compose up -d --force-recreate --renew-anon-volumes

🛠️ Subiu só o banco
    docker compose up -d pgadmin

🛠️ Deletar um produto no pgAdmin
    DELETE FROM public.pdv_products
    WHERE name ILIKE '%dunhill%'
        OR name ILIKE '%duhill%';

🛠️ Depois confirme:
    SELECT product_code, name, category, price, stock, updated_at
    FROM public.pdv_products
    WHERE name ILIKE '%dunhill%'
        OR name ILIKE '%duhill%';