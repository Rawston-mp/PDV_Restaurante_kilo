import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import {
  COMANDA_STATUSES,
  ComandaLockConflictError,
  ComandaLockNotFoundError,
  ComandaLockOwnershipError,
  ComandaStateMachineService,
  type ComandaItemRecord,
  type ComandaLockOwner,
  type ComandaLockStationId,
  type ComandaPesagemInput,
  type ComandaStatus
} from './domain/comandaStateMachine';
import type { ComandaStore } from './infrastructure/comandaStore';
import { createComandaStore } from './infrastructure/comandaStore';
import { startScaleReader } from './services/scaleReader.service';

type PesoSensorPayload = {
  peso: number;
  origem?: string;
  timestamp?: string;
};

const app = express();
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.sendStatus(204);
    return;
  }

  next();
});
app.use(express.json());

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: '*'
  }
});

const comandaService = new ComandaStateMachineService();
let comandaStore: ComandaStore;

const LOCK_OWNERS: ComandaLockOwner[] = ['COMANDA_A', 'COMANDA_B'];
const LOCK_STATIONS: ComandaLockStationId[] = ['BALANCA_A', 'BALANCA_B'];

const parseNumero = (value: unknown) => (typeof value === 'string' ? value.trim() : '');

const parseLockOwner = (value: unknown): ComandaLockOwner | null => {
  if (typeof value !== 'string') {
    return null;
  }

  const normalized = value.trim().toUpperCase();
  return LOCK_OWNERS.includes(normalized as ComandaLockOwner) ? (normalized as ComandaLockOwner) : null;
};

const parseLockStationId = (value: unknown): ComandaLockStationId | null => {
  if (typeof value !== 'string') {
    return null;
  }

  const normalized = value.trim().toUpperCase();
  return LOCK_STATIONS.includes(normalized as ComandaLockStationId)
    ? (normalized as ComandaLockStationId)
    : null;
};

const parsePositiveNumber = (value: unknown) => {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
    return value;
  }

  if (typeof value === 'string') {
    const parsed = Number(value);
    if (Number.isFinite(parsed) && parsed > 0) {
      return parsed;
    }
  }

  return undefined;
};

const parseStatus = (value: unknown): ComandaStatus | null => {
  if (typeof value !== 'string') {
    return null;
  }

  const normalized = value.trim().toUpperCase();
  return COMANDA_STATUSES.includes(normalized as ComandaStatus) ? (normalized as ComandaStatus) : null;
};

const parseOptionalText = (value: unknown) => {
  if (typeof value !== 'string') {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed || undefined;
};

const parseComandaItemsPayload = (body: unknown): ComandaItemRecord[] | null => {
  if (typeof body !== 'object' || body === null) {
    return null;
  }

  const payload = body as { items?: unknown; itens?: unknown };
  const items = Array.isArray(payload.items) ? payload.items : payload.itens;
  return Array.isArray(items) ? (items as ComandaItemRecord[]) : null;
};

const parseComandaPesagemInput = (body: unknown): ComandaPesagemInput | null => {
  if (typeof body !== 'object' || body === null) {
    return null;
  }

  const payload = body as Record<string, unknown>;
  const peso = parsePositiveNumber(payload.peso);
  if (!peso) {
    return null;
  }

  return {
    id: parseOptionalText(payload.id),
    peso,
    origem: parseOptionalText(payload.origem) ?? parseOptionalText(payload.origin),
    owner: parseLockOwner(payload.owner) ?? undefined,
    stationId: parseLockStationId(payload.stationId) ?? undefined,
    itemId: parseOptionalText(payload.itemId),
    productName: parseOptionalText(payload.productName),
    reason: parseOptionalText(payload.reason)
  };
};

const resolveComandaMutationError = (error: unknown, fallbackMessage: string) => {
  if (error instanceof Error && error.message === 'Comanda não encontrada.') {
    return {
      status: 404,
      body: {
        ok: false,
        message: error.message
      }
    };
  }

  return {
    status: 400,
    body: {
      ok: false,
      message: error instanceof Error ? error.message : fallbackMessage
    }
  };
};

let persistenceQueue: Promise<void> = Promise.resolve();
let auditQueue: Promise<void> = Promise.resolve();

const logPersistenceFailure = (operation: string, error: unknown) => {
  console.error(`[persistencia] Falha em ${operation}:`, error);
};

const persistComandas = () => {
  const snapshot = comandaService.snapshot();
  persistenceQueue = persistenceQueue
    .then(() => comandaStore.saveState(snapshot))
    .catch((error) => logPersistenceFailure('salvar estado das comandas', error));

  return persistenceQueue;
};

const appendComandaAudit = (event: Parameters<ComandaStore['appendAudit']>[0]) => {
  auditQueue = auditQueue
    .then(() => comandaStore.appendAudit(event))
    .catch((error) => logPersistenceFailure('registrar auditoria da comanda', error));

  return auditQueue;
};

const appendTransitionAudit = async (
  numero: string,
  fromStatus: ComandaStatus,
  toStatus: ComandaStatus,
  at: string,
  reason?: string
) => {
  await appendComandaAudit({
    action: 'TRANSITION',
    numero,
    fromStatus,
    toStatus,
    at,
    reason
  });
};

const resolveLockError = (error: unknown) => {
  if (error instanceof ComandaLockConflictError) {
    return {
      status: 409,
      body: {
        ok: false,
        message: error.message,
        conflictLock: error.lock
      }
    };
  }

  if (error instanceof ComandaLockOwnershipError) {
    return {
      status: 403,
      body: {
        ok: false,
        message: error.message
      }
    };
  }

  if (error instanceof ComandaLockNotFoundError) {
    return {
      status: 409,
      body: {
        ok: false,
        message: error.message
      }
    };
  }

  if (error instanceof Error && error.message === 'Comanda não encontrada.') {
    return {
      status: 404,
      body: {
        ok: false,
        message: error.message
      }
    };
  }

  return {
    status: 400,
    body: {
      ok: false,
      message: error instanceof Error ? error.message : 'Falha ao processar lock da comanda.'
    }
  };
};

const initializeComandas = async () => {
  if (!comandaStore) {
    const result = await createComandaStore();
    comandaStore = result.store;

    // eslint-disable-next-line no-console
    console.log(`Persistência de comanda: ${result.usingPostgres ? 'PostgreSQL' : 'arquivo local'}`);
  }

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
    void appendComandaAudit({
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
    res.status(400).json({ ok: false, message: 'O campo número é obrigatório.' });
    return;
  }

  try {
    const comanda = comandaService.open(numero);
    void persistComandas();
    void appendComandaAudit({
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
    res.status(404).json({ ok: false, message: 'Comanda não encontrada.' });
    return;
  }

  res.status(200).json({ ok: true, comanda });
});

app.get('/api/v1/comandas/:numero/items', (req, res) => {
  const comanda = comandaService.get(req.params.numero);
  if (!comanda) {
    res.status(404).json({ ok: false, message: 'Comanda não encontrada.' });
    return;
  }

  res.status(200).json({
    ok: true,
    numero: comanda.numero,
    status: comanda.status,
    items: comanda.items,
    updatedAt: comanda.updatedAt
  });
});

app.put('/api/v1/comandas/:numero/items', (req, res) => {
  const items = parseComandaItemsPayload(req.body);
  if (!items) {
    res.status(400).json({ ok: false, message: 'Campo items deve ser uma lista.' });
    return;
  }

  try {
    const reason = parseOptionalText(req.body?.reason) ?? 'items_sync';
    const comanda = comandaService.setItems(req.params.numero, items, reason);

    void appendComandaAudit({
      action: 'ITEMS_SYNCED',
      numero: comanda.numero,
      toStatus: comanda.status,
      at: comanda.updatedAt,
      reason,
      itemCount: comanda.items.length
    });
    void persistComandas();

    res.status(200).json({ ok: true, comanda, items: comanda.items });
  } catch (error) {
    const response = resolveComandaMutationError(error, 'Falha ao salvar itens da comanda.');
    res.status(response.status).json(response.body);
  }
});

app.post('/api/v1/comandas/:numero/items', (req, res) => {
  const rawItem = typeof req.body?.item === 'object' && req.body.item !== null ? req.body.item : req.body;

  try {
    const reason = parseOptionalText(req.body?.reason) ?? 'item_added';
    const comanda = comandaService.addItem(req.params.numero, rawItem as ComandaItemRecord, reason);
    const item = comanda.items[0];

    void appendComandaAudit({
      action: 'ITEM_ADDED',
      numero: comanda.numero,
      toStatus: comanda.status,
      at: comanda.updatedAt,
      reason,
      itemId: item?.id,
      itemCount: comanda.items.length
    });
    void persistComandas();

    res.status(201).json({ ok: true, comanda, item });
  } catch (error) {
    const response = resolveComandaMutationError(error, 'Falha ao adicionar item da comanda.');
    res.status(response.status).json(response.body);
  }
});

app.get('/api/v1/comandas/:numero/pesagens', (req, res) => {
  const comanda = comandaService.get(req.params.numero);
  if (!comanda) {
    res.status(404).json({ ok: false, message: 'Comanda não encontrada.' });
    return;
  }

  res.status(200).json({
    ok: true,
    numero: comanda.numero,
    status: comanda.status,
    pesagens: comanda.pesagens,
    updatedAt: comanda.updatedAt
  });
});

app.get('/api/v1/comandas', (_req, res) => {
  res.status(200).json({ ok: true, comandas: comandaService.getAll() });
});

app.put('/api/v1/comandas/:numero/status', (req, res) => {
  const nextStatus = parseStatus(req.body?.status);
  if (!nextStatus) {
    res.status(400).json({ ok: false, message: 'Status inválido.' });
    return;
  }

  try {
    const before = comandaService.get(req.params.numero);
    if (!before) {
      res.status(404).json({ ok: false, message: 'Comanda não encontrada.' });
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
      res.status(404).json({ ok: false, message: 'Comanda não encontrada.' });
      return;
    }

    const pesagemInput = parseComandaPesagemInput(req.body);
    if (pesagemInput) {
      const result = comandaService.recordPesagem(req.params.numero, pesagemInput);
      const comanda = result.comanda;

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

      void appendComandaAudit({
        action: 'PESAGEM_RECORDED',
        numero: comanda.numero,
        toStatus: comanda.status,
        at: result.pesagem.createdAt,
        reason: pesagemInput.reason ?? 'pesagem_registrada',
        itemId: result.pesagem.itemId,
        peso: result.pesagem.peso,
        origem: result.pesagem.origem
      });
      void persistComandas();

      res.status(200).json({ ok: true, comanda, pesagem: result.pesagem });
      return;
    }

    const comanda = comandaService.markPesagemEmAndamento(req.params.numero, parseOptionalText(req.body?.reason) ?? 'peso_recebido');

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
    const response = resolveComandaMutationError(error, 'Falha ao registrar pesagem.');
    res.status(response.status).json(response.body);
  }
});

app.post('/api/v1/comandas/:numero/lock/acquire', (req, res) => {
  const owner = parseLockOwner(req.body?.owner);
  const stationId = parseLockStationId(req.body?.stationId);

  if (!owner || !stationId) {
    res.status(400).json({
      ok: false,
      message: 'Os campos owner e stationId são obrigatórios (COMANDA_A|COMANDA_B, BALANCA_A|BALANCA_B).'
    });
    return;
  }

  try {
    const result = comandaService.acquireLock(req.params.numero, {
      owner,
      stationId,
      ttlSeconds: parsePositiveNumber(req.body?.ttlSeconds)
    });

    if (result.expiredPreviousLock) {
      void appendComandaAudit({
        action: 'LOCK_EXPIRED',
        numero: result.comanda.numero,
        at: result.comanda.updatedAt,
        reason: parseNumero(req.body?.reason) || 'lock_expired_before_acquire'
      });
    }

    void appendComandaAudit({
      action: 'LOCK_ACQUIRED',
      numero: result.comanda.numero,
      toStatus: result.comanda.status,
      at: result.lock.heartbeatAt,
      reason: parseNumero(req.body?.reason) || 'lock_acquire',
      lockOwner: result.lock.owner,
      lockStationId: result.lock.stationId,
      lockExpiresAt: result.lock.expiresAt
    });
    void persistComandas();

    res.status(200).json({
      ok: true,
      comanda: result.comanda,
      lock: result.lock
    });
  } catch (error) {
    const response = resolveLockError(error);
    res.status(response.status).json(response.body);
  }
});

app.post('/api/v1/comandas/:numero/lock/renew', (req, res) => {
  const owner = parseLockOwner(req.body?.owner);
  const stationId = parseLockStationId(req.body?.stationId);

  if (!owner || !stationId) {
    res.status(400).json({
      ok: false,
      message: 'Os campos owner e stationId são obrigatórios (COMANDA_A|COMANDA_B, BALANCA_A|BALANCA_B).'
    });
    return;
  }

  try {
    const result = comandaService.renewLock(req.params.numero, {
      owner,
      stationId,
      ttlSeconds: parsePositiveNumber(req.body?.ttlSeconds)
    });

    void appendComandaAudit({
      action: 'LOCK_RENEWED',
      numero: result.comanda.numero,
      toStatus: result.comanda.status,
      at: result.lock.heartbeatAt,
      reason: parseNumero(req.body?.reason) || 'lock_renew',
      lockOwner: result.lock.owner,
      lockStationId: result.lock.stationId,
      lockExpiresAt: result.lock.expiresAt
    });
    void persistComandas();

    res.status(200).json({
      ok: true,
      comanda: result.comanda,
      lock: result.lock
    });
  } catch (error) {
    const response = resolveLockError(error);
    res.status(response.status).json(response.body);
  }
});

app.post('/api/v1/comandas/:numero/lock/release', (req, res) => {
  const owner = parseLockOwner(req.body?.owner);
  const stationId = parseLockStationId(req.body?.stationId);

  if (!owner || !stationId) {
    res.status(400).json({
      ok: false,
      message: 'Os campos owner e stationId são obrigatórios (COMANDA_A|COMANDA_B, BALANCA_A|BALANCA_B).'
    });
    return;
  }

  try {
    const comanda = comandaService.releaseLock(req.params.numero, {
      owner,
      stationId
    });

    void appendComandaAudit({
      action: 'LOCK_RELEASED',
      numero: comanda.numero,
      toStatus: comanda.status,
      at: comanda.updatedAt,
      reason: parseNumero(req.body?.reason) || 'lock_release',
      lockOwner: owner,
      lockStationId: stationId
    });
    void persistComandas();

    res.status(200).json({
      ok: true,
      comanda
    });
  } catch (error) {
    const response = resolveLockError(error);
    res.status(response.status).json(response.body);
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
} else {
  // eslint-disable-next-line no-console
  console.warn('Leitor de balança desativado: defina SERIAL_PORT_PATH para habilitar a leitura serial.');
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
