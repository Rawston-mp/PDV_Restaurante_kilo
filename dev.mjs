import { spawn } from 'node:child_process';
import { dirname } from 'node:path';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import net from 'node:net';

const root = dirname(fileURLToPath(import.meta.url));
const backendPort = Number(process.env.PORT ?? 3001);
const frontendPort = Number(process.env.VITE_PORT ?? 5173);
const backendRuntimeUrl = `http://127.0.0.1:${backendPort}/api/v1/runtime`;

const isPortInUse = (port) =>
  new Promise((resolve) => {
    const socket = net.createConnection({ host: '127.0.0.1', port });

    socket.once('connect', () => {
      socket.destroy();
      resolve(true);
    });

    socket.once('error', () => resolve(false));
    socket.setTimeout(500, () => {
      socket.destroy();
      resolve(false);
    });
  });

const isPdvBackend = async () => {
  try {
    const response = await fetch(backendRuntimeUrl, { signal: AbortSignal.timeout(1_500) });
    if (!response.ok) return false;
    const payload = await response.json();
    return payload?.service === 'pdv-touch-backend' && payload?.apiVersion === 1;
  } catch {
    return false;
  }
};

const services = [];

if (await isPortInUse(backendPort)) {
  if (!await isPdvBackend()) {
    throw new Error(`A porta ${backendPort} esta ocupada por outro servico. Encerre-o antes de iniciar o PDV Touch.`);
  }
  console.warn(`Backend PDV Touch validado em http://localhost:${backendPort}. Reutilizando o processo existente.`);
} else {
  services.push(['backend', [join(root, 'node_modules', 'tsx', 'dist', 'cli.mjs'), 'watch', 'backend/src/server.ts']]);
}

if (await isPortInUse(frontendPort)) {
  console.warn(`Frontend ja esta em execucao em http://localhost:${frontendPort}. Reutilizando o processo existente.`);
} else {
  services.push([
    'frontend',
    [join(root, 'node_modules', 'vite', 'bin', 'vite.js'), '--host', '0.0.0.0', '--port', String(frontendPort), '--strictPort']
  ]);
}

if (services.length === 0) {
  console.log(`Ambiente de desenvolvimento ja esta ativo: http://localhost:${frontendPort}`);
  process.exit(0);
}

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
