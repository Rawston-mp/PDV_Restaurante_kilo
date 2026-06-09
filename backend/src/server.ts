import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { ComandaStateMachineService, type ComandaStatus } from './domain/comandaStateMachine';
import { ComandaFileStore } from './infrastructure/comandaFileStore';
import { startScaleReader } from './services/scaleReader.service';

type PesoSensorPayload = {
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

const comandaService = new ComandaStateMachineService();
const comandaStore = new ComandaFileStore();

const parseNumero = (value: unknown) => (typeof value === 'string' ? value.trim() : '');

const parseStatus = (value: unknown): ComandaStatus | null => {
  if (typeof value !== 'string') {
    return null;
  }

  const normalized = value.trim().toUpperCase();
  const allowed: ComandaStatus[] = [
    'ABERTA',
    'PESAGEM_EM_ANDAMENTO',
    'PRONTA_PARA_CAIXA',
    'ENCERRADA',
    'FINALIZADA',
    'ARQUIVADA'
  ];

  return allowed.includes(normalized as ComandaStatus) ? (normalized as ComandaStatus) : null;
};

const persistComandas = async () => {
  await comandaStore.saveState(comandaService.snapshot());
};

const appendTransitionAudit = async (
  numero: string,
  fromStatus: ComandaStatus,
  toStatus: ComandaStatus,
  at: string,
  reason?: string
) => {
  await comandaStore.appendAudit({
    action: 'TRANSITION',
    numero,
    fromStatus,
    toStatus,
    at,
    reason
  });
};

const initializeComandas = async () => {
  const snapshot = await comandaStore.loadState();
  if (!snapshot) {
    return;
  }

  comandaService.loadSnapshot(snapshot);
};

app.get('/comandas/status', (_req, res) => {
  const active = comandaService.getActive();
  res.status(200).json({
    ok: true,
    comandaAtiva: Boolean(active),
    comandaNumero: active?.numero ?? null,
    status: active?.status ?? null
  });
});

app.post('/comandas/abrir', (req, res) => {
  const numero = parseNumero(req.body?.numero) || 'LEGACY_MAIN';

  try {
    const comanda = comandaService.open(numero);

    void persistComandas();
    void comandaStore.appendAudit({
      action: 'OPEN_COMANDA',
      numero: comanda.numero,
      toStatus: comanda.status,
      at: comanda.updatedAt
    });

    res.status(200).json({
      ok: true,
      comandaAtiva: true,
      comandaNumero: comanda.numero,
      status: comanda.status
    });
  } catch (error) {
    res.status(400).json({
      ok: false,
      message: error instanceof Error ? error.message : 'Falha ao abrir comanda.'
    });
  }
});

app.post('/comandas/fechar', (_req, res) => {
  comandaService.deactivateActive();
  void persistComandas();
  res.status(200).json({ ok: true, comandaAtiva: false });
});

app.post('/api/v1/comandas', (req, res) => {
  const numero = parseNumero(req.body?.numero);
  if (!numero) {
    res.status(400).json({ ok: false, message: 'Campo numero e obrigatorio.' });
    return;
  }

  try {
    const comanda = comandaService.open(numero);
    void persistComandas();
    void comandaStore.appendAudit({
      action: 'OPEN_COMANDA',
      numero: comanda.numero,
      toStatus: comanda.status,
      at: comanda.updatedAt
    });

    res.status(201).json({
      ok: true,
      comanda
    });
  } catch (error) {
    res.status(400).json({
      ok: false,
      message: error instanceof Error ? error.message : 'Falha ao criar comanda.'
    });
  }
});

app.get('/api/v1/comandas/:numero', (req, res) => {
  const comanda = comandaService.get(req.params.numero);
  if (!comanda) {
    res.status(404).json({ ok: false, message: 'Comanda nao encontrada.' });
    return;
  }

  res.status(200).json({ ok: true, comanda });
});

app.get('/api/v1/comandas', (_req, res) => {
  res.status(200).json({ ok: true, comandas: comandaService.getAll() });
});

app.put('/api/v1/comandas/:numero/status', (req, res) => {
  const nextStatus = parseStatus(req.body?.status);
  if (!nextStatus) {
    res.status(400).json({ ok: false, message: 'Status invalido.' });
    return;
  }

  try {
    const before = comandaService.get(req.params.numero);
    if (!before) {
      res.status(404).json({ ok: false, message: 'Comanda nao encontrada.' });
      return;
    }

    const comanda = comandaService.transition(req.params.numero, nextStatus, parseNumero(req.body?.reason));
    const lastTransition = comanda.transitions[comanda.transitions.length - 1];

    if (lastTransition) {
      void appendTransitionAudit(
        comanda.numero,
        before.status,
        lastTransition.to,
        lastTransition.at,
        lastTransition.reason
      );
    }

    void persistComandas();

    res.status(200).json({ ok: true, comanda });
  } catch (error) {
    res.status(400).json({
      ok: false,
      message: error instanceof Error ? error.message : 'Falha ao atualizar status da comanda.'
    });
  }
});

app.post('/api/v1/comandas/:numero/pesagem', (req, res) => {
  try {
    const before = comandaService.get(req.params.numero);
    if (!before) {
      res.status(404).json({ ok: false, message: 'Comanda nao encontrada.' });
      return;
    }

    const comanda = comandaService.markPesagemEmAndamento(req.params.numero, parseNumero(req.body?.reason));

    if (before.status !== comanda.status) {
      const lastTransition = comanda.transitions[comanda.transitions.length - 1];
      if (lastTransition) {
        void appendTransitionAudit(
          comanda.numero,
          before.status,
          lastTransition.to,
          lastTransition.at,
          lastTransition.reason
        );
      }
    }

    void persistComandas();

    res.status(200).json({ ok: true, comanda });
  } catch (error) {
    res.status(400).json({
      ok: false,
      message: error instanceof Error ? error.message : 'Falha ao registrar pesagem.'
    });
  }
});

io.on('connection', (socket) => {
  socket.on('peso_sensor', (data: PesoSensorPayload) => {
    const active = comandaService.getActive();
    if (active && comandaService.canEmitWeight()) {
      const beforeStatus = active.status;
      const updated = comandaService.markPesagemEmAndamento(active.numero, 'peso_sensor');
      if (beforeStatus !== updated.status) {
        const lastTransition = updated.transitions[updated.transitions.length - 1];
        if (lastTransition) {
          void appendTransitionAudit(
            updated.numero,
            beforeStatus,
            lastTransition.to,
            lastTransition.at,
            lastTransition.reason
          );
          void persistComandas();
        }
      }

      io.emit('atualizar_peso', data);
    }
  });
});

const serialPath = process.env.SERIAL_PORT_PATH;

if (serialPath) {
  try {
    startScaleReader(serialPath, {
      onStableWeight: (peso) => {
        const active = comandaService.getActive();
        if (active && comandaService.canEmitWeight()) {
          const beforeStatus = active.status;
          const updated = comandaService.markPesagemEmAndamento(active.numero, 'peso_sensor_serial');
          if (beforeStatus !== updated.status) {
            const lastTransition = updated.transitions[updated.transitions.length - 1];
            if (lastTransition) {
              void appendTransitionAudit(
                updated.numero,
                beforeStatus,
                lastTransition.to,
                lastTransition.at,
                lastTransition.reason
              );
              void persistComandas();
            }
          }

          io.emit('atualizar_peso', {
            peso,
            origem: 'sensor_serial',
            timestamp: new Date().toISOString()
          } satisfies PesoSensorPayload);
        }
      }
    });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Falha ao iniciar leitura do sensor:', error);
  }
}

const PORT = Number(process.env.PORT ?? 3001);

void (async () => {
  try {
    await initializeComandas();
    httpServer.listen(PORT, () => {
      // eslint-disable-next-line no-console
      console.log(`Servidor backend rodando na porta ${PORT}`);
    });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Falha ao iniciar backend de comandas:', error);
    process.exitCode = 1;
  }
})();
