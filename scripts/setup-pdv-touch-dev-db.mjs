import pg from 'pg';

const { Pool } = pg;

const sourceDb = process.env.PDV_SOURCE_DATABASE || 'postgres';
const targetDb = process.env.PDV_TARGET_DATABASE || 'pdv_touch_dev';
const baseConfig = {
  host: process.env.PGHOST || '127.0.0.1',
  port: Number(process.env.PGPORT || 5432),
  user: process.env.PGUSER || 'postgres',
  password: process.env.PGPASSWORD || '1607'
};

const tables = [
  'pdv_comanda_state',
  'pdv_comanda_audit',
  'pdv_products',
  'comandas',
  'comanda_items',
  'comanda_pesagens',
  'vendas',
  'pagamentos',
  'caixa_sessions',
  'financeiro',
  'audit_logs',
  'pdv_clients',
  'pdv_suppliers',
  'pdv_convenios',
  'pdv_employees',
  'pdv_categories',
  'pdv_card_administrators',
  'pdv_stores',
  'pdv_store_users',
  'pdv_store_pins',
  'pdv_peripheral_settings',
  'pdv_fiscal_settings',
  'pdv_sefaz_settings',
  'pdv_support_settings'
];

const quoteIdentifier = (value) => `"${String(value).replace(/"/g, '""')}"`;

const createDatabaseIfNeeded = async () => {
  const admin = new Pool({ ...baseConfig, database: sourceDb });
  try {
    const exists = await admin.query('SELECT 1 FROM pg_database WHERE datname = $1', [targetDb]);
    if (exists.rowCount === 0) {
      await admin.query(`CREATE DATABASE ${quoteIdentifier(targetDb)}`);
      console.log(`DATABASE_CREATED ${targetDb}`);
      return;
    }

    console.log(`DATABASE_EXISTS ${targetDb}`);
  } finally {
    await admin.end();
  }
};

const initializeTargetSchema = async () => {
  process.env.PGDATABASE = targetDb;

  const { createProductStore } = await import('../backend/src/infrastructure/productStore.ts');
  const { createOperationalStore } = await import('../backend/src/infrastructure/operationalStore.ts');
  const { createCatalogAdminStore } = await import('../backend/src/infrastructure/catalogAdminStore.ts');
  const { createComandaStore } = await import('../backend/src/infrastructure/comandaStore.ts');

  await createProductStore();
  await createOperationalStore();
  await createCatalogAdminStore();
  await createComandaStore();
  console.log('TARGET_SCHEMA_OK');
};

const tableExists = async (pool, table) => {
  const result = await pool.query('SELECT to_regclass($1) AS name', [`public.${table}`]);
  return Boolean(result.rows[0]?.name);
};

const listColumns = async (pool, table) => {
  const result = await pool.query(
    `
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = $1
      ORDER BY ordinal_position
    `,
    [table]
  );

  return result.rows.map((row) => row.column_name);
};

const copyTable = async (source, target, table) => {
  if (!(await tableExists(source, table)) || !(await tableExists(target, table))) {
    return 0;
  }

  const columns = await listColumns(source, table);
  if (columns.length === 0) {
    return 0;
  }

  const quotedColumns = columns.map(quoteIdentifier).join(', ');
  const sourceRows = await source.query(`SELECT ${quotedColumns} FROM public.${quoteIdentifier(table)}`);
  if (sourceRows.rowCount === 0) {
    console.log(`COPY_SKIP_EMPTY ${table}`);
    return 0;
  }

  const placeholders = columns.map((_, index) => `$${index + 1}`).join(', ');
  for (const row of sourceRows.rows) {
    const values = columns.map((column) => row[column]);
    await target.query(
      `INSERT INTO public.${quoteIdentifier(table)} (${quotedColumns}) VALUES (${placeholders}) ON CONFLICT DO NOTHING`,
      values
    );
  }

  console.log(`COPIED ${table} ${sourceRows.rowCount}`);
  return sourceRows.rowCount;
};

const repairSequences = async (target) => {
  const sequenceMap = {
    pdv_comanda_audit_id_seq: 'pdv_comanda_audit',
    audit_logs_id_seq: 'audit_logs'
  };

  for (const [sequence, table] of Object.entries(sequenceMap)) {
    const exists = await target.query('SELECT to_regclass($1) AS name', [`public.${sequence}`]);
    if (!exists.rows[0]?.name) {
      continue;
    }

    await target.query(
      `SELECT setval('public.${sequence}', COALESCE((SELECT MAX(id) FROM public.${quoteIdentifier(table)}), 1), true)`
    );
  }
};

const copyExistingData = async () => {
  const source = new Pool({ ...baseConfig, database: sourceDb });
  const target = new Pool({ ...baseConfig, database: targetDb });
  let copiedRows = 0;

  try {
    for (const table of tables) {
      copiedRows += await copyTable(source, target, table);
    }

    await repairSequences(target);
    console.log(`MIGRATION_OK copied_rows=${copiedRows}`);
  } finally {
    await source.end();
    await target.end();
  }
};

await createDatabaseIfNeeded();
await initializeTargetSchema();
await copyExistingData();
