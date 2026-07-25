import { Pool } from 'pg';
import * as dotenv from 'dotenv';

dotenv.config({ path: `${process.cwd()}/.env` });

export type PostgresConfig = {
  connectionString?: string;
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
  ssl: boolean;
  connectionTimeoutMillis: number;
};

export const parseBoolean = (value: string | undefined, fallback = false) => {
  if (!value) {
    return fallback;
  }

  return ['1', 'true', 'yes', 'on'].includes(value.trim().toLowerCase());
};

const resolveConnectionString = () => {
  const rawConnectionString = (
    process.env.PRODUCT_DATABASE_URL ??
    process.env.POSTGRES_URL ??
    process.env.DATABASE_URL
  )?.trim().replace(/^"|"$/g, '');

  return rawConnectionString?.startsWith('postgres://') || rawConnectionString?.startsWith('postgresql://')
    ? rawConnectionString
    : undefined;
};

export const buildPostgresConfig = (): PostgresConfig => ({
  connectionString: resolveConnectionString(),
  host: process.env.PGHOST?.trim() || '127.0.0.1',
  port: Number(process.env.PGPORT ?? 5432),
  database: process.env.PGDATABASE?.trim() || 'postgres',
  user: process.env.PGUSER?.trim() || 'postgres',
  password: process.env.PGPASSWORD?.trim() || 'postgres',
  ssl: parseBoolean(process.env.PGSSL, false),
  connectionTimeoutMillis: Number(process.env.PG_CONNECTION_TIMEOUT_MS ?? 3000)
});

export const createPostgresPool = () => {
  const config = buildPostgresConfig();

  if (config.connectionString) {
    return new Pool({
      connectionString: config.connectionString,
      connectionTimeoutMillis: config.connectionTimeoutMillis,
      ssl: config.ssl ? { rejectUnauthorized: false } : undefined
    });
  }

  return new Pool({
    host: config.host,
    port: config.port,
    database: config.database,
    user: config.user,
    password: config.password,
    connectionTimeoutMillis: config.connectionTimeoutMillis,
    ssl: config.ssl ? { rejectUnauthorized: false } : undefined
  });
};
