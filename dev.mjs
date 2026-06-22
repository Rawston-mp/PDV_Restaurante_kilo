import { spawn } from 'node:child_process';
import { join } from 'node:path';

const root = process.cwd();
const services = [
  ['backend', [join(root, 'node_modules', 'tsx', 'dist', 'cli.mjs'), 'watch', 'backend/src/server.ts']],
  ['frontend', [join(root, 'node_modules', 'vite', 'bin', 'vite.js'), '--host', '0.0.0.0']]
];

const children = services.map(([name, args]) => {
  const child = spawn(process.execPath, args, { cwd: root, stdio: 'inherit' });
  child.on('error', (error) => console.error(`[${name}] Falha ao iniciar: ${error.message}`));
  return { name, child };
});

let stopping = false;

const stopAll = (exitCode = 0) => {
  if (stopping) return;
  stopping = true;
  for (const { child } of children) {
    if (!child.killed) child.kill();
  }
  process.exitCode = exitCode;
};

for (const { name, child } of children) {
  child.on('exit', (code, signal) => {
    if (stopping) return;
    const reason = signal ? `sinal ${signal}` : `código ${code ?? 1}`;
    console.error(`[${name}] Serviço encerrado inesperadamente (${reason}).`);
    stopAll(code ?? 1);
  });
}

process.on('SIGINT', () => stopAll());
process.on('SIGTERM', () => stopAll());
