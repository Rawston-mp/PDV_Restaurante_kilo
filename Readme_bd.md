Use estes comandos no Query Tool do pgAdmin, dentro do banco:

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
