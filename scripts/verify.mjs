#!/usr/bin/env node
/**
 * Verificador de integridade do PDV Touch.
 * Roda checks críticos: typecheck, testes, contrato frontend↔backend, segredos, smoke.
 * Exit code 0 = tudo passou. Diferente de 0 = falha.
 * 
 * Uso:
 *   npm run verify           # checks básicos (sem dependência de Postgres)
 *   npm run verify -- --full # inclui smoke test (exige Postgres de pé)
 */

import { execSync } from 'child_process';
import { existsSync, readFileSync, rmSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = join(fileURLToPath(import.meta.url), '..');
const projectRoot = join(__dirname, '..');
const isFull = process.argv.includes('--full');

const checks = [];
let passed = 0;
let failed = 0;

function log(phase, status, message) {
  const icon = status === '✓' ? '✓' : '✗';
  checks.push({ phase, status, message });
  console.log(`${icon} ${phase.padEnd(20)} ${message}`);
  if (status === '✓') passed++;
  else failed++;
}

function exec(cmd, opts = {}) {
  try {
    return execSync(cmd, { cwd: projectRoot, encoding: 'utf8', stdio: 'pipe', ...opts });
  } catch (e) {
    throw { code: e.status, stdout: e.stdout, stderr: e.stderr };
  }
}

console.log('PDVTouch Verification Suite\n');

// 1. TYPECHECK — frontend + backend
try {
  exec('npx tsc -b', { stdio: 'ignore' });
  log('typecheck', '✓', 'frontend + backend OK');
} catch (e) {
  log('typecheck', '✗', `errors found`);
  console.log('  Run: npx tsc -b');
  failed++;
}

// 2. TESTES
try {
  exec('npx vitest run --reporter=verbose', { stdio: 'ignore' });
  log('tests', '✓', 'unit + integration OK');
} catch (e) {
  log('tests', '✗', `tests failed`);
  console.log('  Run: npx vitest run');
  failed++;
}

// 3. CONTRACT — chamadas frontend vs rotas backend
try {
  // Extrair /api/v1/* do código frontend
  const frontendCalls = exec(
    `grep -roh '/api/v1/[a-z0-9/_:-]*' src --include="*.ts" --include="*.tsx"`,
    { stdio: 'pipe' }
  )
    .split('\n')
    .filter(Boolean)
    .map((call) => {
      // Normalizar parâmetros: /api/v1/comandas/123 → /api/v1/comandas/:numero
      return call
        .replace(/\/\d+/g, '/:id')
        .replace(/:id/g, (m, offset, str) => {
          // Tentar inferir nome do parâmetro a partir do contexto
          if (str.includes('comandas')) return '/:numero';
          if (str.includes('caixa') || str.includes('sessions')) return '/:sessionId';
          return '/:id';
        });
    })
    .sort()
    .filter((v, i, a) => i === 0 || a[i - 1] !== v); // uniq

  // Extrair rotas backend
  const backendRoutes = exec(
    `grep -oE "app\\.(get|post|put|patch|delete)\\('[^']+'" backend/src/server.ts | sed -E "s/app\\.([a-z]+)\\('//" | sed "s/'$//" `,
    { stdio: 'pipe' }
  )
    .split('\n')
    .filter(Boolean)
    .map((r) => {
      const [method, path] = r.split(' ');
      return `${method} ${path}`;
    })
    .sort();

  // Comparar
  const backendSet = new Set(backendRoutes);
  const orphaned = frontendCalls.filter((call) => {
    const methods = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'];
    return !methods.some((m) => backendSet.has(`${m} ${call}`));
  });

  if (orphaned.length === 0) {
    log('contract', '✓', 'frontend ↔ backend sync');
  } else {
    log('contract', '✗', `${orphaned.length} orphaned calls in frontend`);
    orphaned.forEach((c) => console.log(`    ${c}`));
  }
} catch (e) {
  log('contract', '✗', 'failed to compare');
}

// 4. SECRETS — .env rastreado, senhas em arquivos
try {
  const tracked = exec('git ls-files | grep -E "^\\.env$"', { stdio: 'pipe' }).trim();
  if (tracked) {
    log('secrets', '✗', '.env is tracked in git');
    failed++;
  } else {
    // Procurar padrões de senha em arquivos rastreados
    const secretPatterns = ['password.*=.*[a-zA-Z0-9]{8,}', 'secret.*=.*[a-zA-Z0-9]{8,}'];
    const found = exec(
      `git ls-files --exclude-standard | xargs grep -l -iE "password|secret|token|key" 2>/dev/null || echo ""`,
      { stdio: 'pipe' }
    )
      .split('\n')
      .filter(Boolean);

    // Ignorar arquivo de exemplo e documentação
    const realSecrets = found.filter(
      (f) => !f.includes('.example') && !f.includes('.md') && !f.includes('docs/')
    );

    if (realSecrets.length === 0) {
      log('secrets', '✓', 'no secrets tracked');
    } else {
      log('secrets', '✗', `${realSecrets.length} files may contain secrets`);
      realSecrets.forEach((f) => console.log(`    ${f}`));
    }
  }
} catch (e) {
  log('secrets', '✗', 'failed to scan');
}

// 5. SMOKE TEST (opcional, exige Postgres)
if (isFull) {
  try {
    log('smoke', '⏳', 'connecting to database...');
    
    // TODO: implementar smoke test contra DB local
    // Por enquanto, apenas marca como skipped se não conseguir conectar
    try {
      exec('npx tsx -e "const {PrismaClient}=await import(\\'@prisma/client\\');const p=new PrismaClient();await p.$queryRaw\\`SELECT 1\\`;await p.$disconnect();console.log(\\'ok\\')"', { stdio: 'pipe' });
      log('smoke', '✓', 'database responsive');
    } catch {
      log('smoke', '⊘', 'database not available (skipped)');
    }
  } catch (e) {
    log('smoke', '✗', 'smoke test failed');
  }
}

// Summary
console.log('\n' + '='.repeat(50));
console.log(`Summary: ${passed} passed, ${failed} failed\n`);

if (failed > 0) {
  console.log('❌ Verification failed. See errors above.');
  process.exit(1);
}

console.log('✅ All checks passed.');
process.exit(0);
