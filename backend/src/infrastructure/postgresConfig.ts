import { Pool } from 'pg';
import fs from 'node:fs';
import path from 'node:path';

// Carrega .env manualmente se existir, sem depender do pacote `dotenv` em produção
try {
  const envPath = path.resolve(process.cwd(), '.env');
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    for (const line of envContent.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        const eqIdx = trimmed.indexOf('=');
        if (eqIdx > 0) {
          const key = trimmed.slice(0, eqIdx).trim();
          const val = trimmed.slice(eqIdx + 1).trim().replace(/^"|"$/g, '');
          if (!process.env[key]) {
            process.env[key] = val;
          }
        }
      }
    }
  }
} catch {
  // Ignora se não for possível ler o .env no ambiente empacotado
}

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
