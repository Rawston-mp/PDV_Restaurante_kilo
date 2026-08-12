# Banco de Dados do PDV Touch

Use este arquivo como guia rapido para consultar e validar o PostgreSQL oficial do projeto.

## Banco Oficial de Desenvolvimento

```text
Banco: pdv_touch_dev
Usuario: postgres
Senha: consulte o .env local ou a credencial combinada para desenvolvimento
```

### Conexao pelo backend ou pgAdmin instalado no Windows

```text
Host: 127.0.0.1
Porta: 55432
Banco: pdv_touch_dev
Usuario: postgres
Senha: use a mesma senha do POSTGRES_PASSWORD/PGPASSWORD local
```

### Conexao pelo pgAdmin dentro do Docker

```text
Host: postgres
Porta: 5432
Banco: pdv_touch_dev
Usuario: postgres
Senha: use a mesma senha do POSTGRES_PASSWORD/PGPASSWORD local
```

Nao use o servidor antigo `PostgreSQL 18` na porta `5432` do Windows para validar o PDV, pois ele pode apontar para outro banco ou conter dados antigos.

## Comandos Docker

Subir banco e pgAdmin:

```bash
npm run db:up
```

Derrubar banco e pgAdmin:

```bash
npm run db:down
```

Ver logs do pgAdmin:

```bash
docker logs pdv_pgadmin
```

Recriar pgAdmin:

```bash
docker compose up -d --force-recreate --renew-anon-volumes pdv_pgadmin
```

Recriar toda a estrutura Docker:

```bash
docker compose up -d --force-recreate --renew-anon-volumes
```

## Consultas Principais

### Produtos

```sql
SELECT product_code, name, category, price, stock, updated_at
FROM public.pdv_products
ORDER BY product_code;
```

Buscar produto por nome:

```sql
SELECT product_code, name, category, price, stock, updated_at
FROM public.pdv_products
WHERE name ILIKE '%dunhill%'
ORDER BY product_code;
```

### Comandas

```sql
SELECT numero, status, total, item_count, opened_at, closed_at, updated_at
FROM public.comandas
ORDER BY updated_at DESC;
```

### Itens da comanda

```sql
SELECT comanda_numero, name, quantity, weight, unit_price, subtotal, by_weight, created_at
FROM public.comanda_items
ORDER BY created_at DESC;
```

### Vendas

```sql
SELECT id, comanda_numero, document_mode, status, subtotal, discount, total, operator, pdv, created_at, closed_at
FROM public.vendas
ORDER BY closed_at DESC NULLS LAST, created_at DESC;
```

### Pagamentos

```sql
SELECT id, venda_id, method, label, amount, created_at
FROM public.pagamentos
ORDER BY created_at DESC;
```

### Financeiro

```sql
SELECT id, finance_code, tab, movement_type, category, amount, account_name, document_ref, status, launched_at, created_at
FROM public.financeiro
ORDER BY created_at DESC;
```

### Auditoria

```sql
SELECT id, action, user_role, entity, entity_id, status, reason, created_at
FROM public.audit_logs
ORDER BY created_at DESC
LIMIT 100;
```

## Ver Tudo de Uma Comanda

Troque `1` pelo numero desejado.

```sql
SELECT *
FROM public.comandas
WHERE numero = '1';

SELECT *
FROM public.comanda_items
WHERE comanda_numero = '1'
ORDER BY created_at;

SELECT *
FROM public.vendas
WHERE comanda_numero = '1'
ORDER BY created_at DESC;

SELECT p.*
FROM public.pagamentos p
JOIN public.vendas v ON v.id = p.venda_id
WHERE v.comanda_numero = '1'
ORDER BY p.created_at DESC;
```

## Limpeza de Produto de Teste

```sql
DELETE FROM public.pdv_products
WHERE name ILIKE '%dunhill%'
   OR name ILIKE '%duhill%';
```

Confirmar remocao:

```sql
SELECT product_code, name, category, price, stock, updated_at
FROM public.pdv_products
WHERE name ILIKE '%dunhill%'
   OR name ILIKE '%duhill%';
```

## Inserir Produto de Teste

```sql
INSERT INTO public.pdv_products (
  id,
  product_code,
  name,
  category,
  price,
  stock,
  by_weight,
  version,
  created_at,
  updated_at,
  last_synced_at
)
VALUES (
  gen_random_uuid()::text,
  '91',
  'Produto Teste',
  'Bebidas',
  10.00,
  5.00,
  false,
  1,
  NOW(),
  NOW(),
  NOW()
);
```

## Fiscal

Tabelas fiscais previstas/ativas conforme migrations:

```sql
SELECT * FROM public.fiscal_documents ORDER BY created_at DESC LIMIT 50;
SELECT * FROM public.nfce_number_control ORDER BY updated_at DESC;
SELECT * FROM public.fiscal_queue ORDER BY created_at DESC LIMIT 50;
```

## Validacao do Projeto

```bash
npm run build
npm run test
```

Teste especifico financeiro, quando aplicavel:

```bash
npm run test -- tests/integration/cashMovementsUseCases.test.ts
```
