import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { lerBalanca } from './services/balanca.service';

type PesoBalancaPayload = {
  peso: number;
  origem?: string;
  timestamp?: string;
};

const app = express();
app.use(express.json());

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: '*'
  }
});

let comandaAtiva = false;

app.get('/comandas/status', (_req, res) => {
  res.status(200).json({ ok: true, comandaAtiva });
});

app.post('/comandas/abrir', (_req, res) => {
  comandaAtiva = true;
  res.status(200).json({ ok: true, comandaAtiva });
});

app.post('/comandas/fechar', (_req, res) => {
  comandaAtiva = false;
  res.status(200).json({ ok: true, comandaAtiva });
});

io.on('connection', (socket) => {
  socket.on('peso_balanca', (data: PesoBalancaPayload) => {
    if (comandaAtiva) {
      io.emit('atualizar_peso', data);
    }
  });
});

const serialPath = process.env.SERIAL_PORT_PATH;

if (serialPath) {
  try {
    lerBalanca(serialPath, {
      onStableWeight: (peso) => {
        if (comandaAtiva) {
          io.emit('atualizar_peso', {
            peso,
            origem: 'balanca_serial',
            timestamp: new Date().toISOString()
          } satisfies PesoBalancaPayload);
        }
      }
    });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Falha ao iniciar leitura da balanca:', error);
  }
}

const PORT = Number(process.env.PORT ?? 3001);
httpServer.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`Servidor backend rodando na porta ${PORT}`);
});
