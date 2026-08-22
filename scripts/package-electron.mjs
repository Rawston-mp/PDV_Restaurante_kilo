import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sourceEnvPath = path.join(projectRoot, '.env');
const stagingDirectory = path.join(projectRoot, '.electron-runtime');
const stagedEnvPath = path.join(stagingDirectory, 'pdv.env');
const outputDirectory = path.join(projectRoot, 'release-electron');
const builderCli = path.join(projectRoot, 'node_modules', 'electron-builder', 'out', 'cli', 'cli.js');

const allowedKeys = new Set([
  'DATABASE_URL',
  'PRODUCT_DATABASE_URL',
  'PGHOST',
  'PGPORT',
  'PGDATABASE',
  'PGUSER',
  'PGPASSWORD',
  'PGSSL',
  'PG_CONNECTION_TIMEOUT_MS',
  'PDV_REQUIRE_POSTGRES',
  'SERIAL_PORT_PATH'
]);

const readRuntimeEnvironment = () => {
  if (!fs.existsSync(sourceEnvPath)) {
    throw new Error('Arquivo .env não encontrado. Crie-o antes de gerar o Electron.');
  }

  const selectedLines = fs.readFileSync(sourceEnvPath, 'utf8')
    .split(/\r?\n/)
    .filter((line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) return false;
      const separator = trimmed.indexOf('=');
      return separator > 0 && allowedKeys.has(trimmed.slice(0, separator).trim());
    });

  if (!selectedLines.some((line) => /^(DATABASE_URL|PRODUCT_DATABASE_URL|PGHOST)=/.test(line.trim()))) {
    throw new Error('O .env não contém uma configuração de PostgreSQL para o aplicativo.');
  }

  return `${selectedLines.join('\n')}\n`;
};

const runtimeEnvironment = readRuntimeEnvironment();

try {
  fs.mkdirSync(stagingDirectory, { recursive: true });
  fs.writeFileSync(stagedEnvPath, runtimeEnvironment, { encoding: 'utf8', mode: 0o600 });

  const result = spawnSync(process.execPath, [builderCli, '--win', '--x64'], {
    cwd: projectRoot,
    stdio: 'inherit'
  });

  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);

  // O arquivo externo atende o executável portátil e facilita trocar a
  // configuração local sem gerar um novo pacote.
  fs.copyFileSync(stagedEnvPath, path.join(outputDirectory, 'pdv.env'));
  const unpackedDirectory = path.join(outputDirectory, 'win-unpacked');
  if (fs.existsSync(unpackedDirectory)) {
    fs.copyFileSync(stagedEnvPath, path.join(unpackedDirectory, 'pdv.env'));
  }
} finally {
  fs.rmSync(stagingDirectory, { recursive: true, force: true });
}
