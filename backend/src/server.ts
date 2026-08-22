import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import {
  COMANDA_STATUSES,
  ComandaLockConflictError,
  ComandaLockNotFoundError,
  ComandaLockOwnershipError,
  ComandaStateMachineService,
  normalizeComandaNumber,
  type ComandaItemRecord,
  type ComandaRecord,
  type ComandaLockOwner,
  type ComandaLockStationId,
  type ComandaPesagemInput,
  type ComandaStatus
} from './domain/comandaStateMachine';
import type { ComandaStore } from './infrastructure/comandaStore';
import { createComandaStore } from './infrastructure/comandaStore';
import type { ProductRecord, ProductStore } from './infrastructure/productStore';
import { createProductStore } from './infrastructure/productStore';
import type {
  ComandaLockTransactionContext,
  OperationalPostgresStore
} from './infrastructure/operationalStore';
import { createOperationalStore } from './infrastructure/operationalStore';
import type { CatalogAdminPostgresStore } from './infrastructure/catalogAdminStore';
import { createCatalogAdminStore } from './infrastructure/catalogAdminStore';
import { buildPostgresConfig, loadedRuntimeEnvironmentFile } from './infrastructure/postgresConfig';
import { startScaleReader } from './services/scaleReader.service';

type PesoSensorPayload = {
  peso: number;
  origem?: string;
  timestamp?: string;
};

type CloseBatchPayment = {
  id?: string;
  method: string;
  label?: string;
  amount: number;
};

type CloseBatchResult = {
  beforeByNumero: Map<string, ComandaRecord | null>;
  comandas: ComandaRecord[];
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
app.use(express.json({ limit: '10mb' }));

const jsonParseErrorHandler: express.ErrorRequestHandler = (error, _req, res, next) => {
  if (error && typeof error === 'object' && 'type' in error && error.type === 'entity.too.large') {
    res.status(413).json({
      ok: false,
      message: 'Payload muito grande. Reduza a imagem do produto ou remova a foto antes de sincronizar.'
    });
    return;
  }

  if (error instanceof SyntaxError && 'body' in error) {
    res.status(400).json({
      ok: false,
      message: 'JSON invalido na requisicao.'
    });
    return;
  }

  next(error);
};

app.use(jsonParseErrorHandler);

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: '*'
  }
});

const comandaService = new ComandaStateMachineService();
let comandaStore: ComandaStore;
let productStore: ProductStore | null = null;
let productStoreError: string | null = null;
let operationalStore: OperationalPostgresStore | null = null;
let operationalStoreError: string | null = null;
let catalogAdminStore: CatalogAdminPostgresStore | null = null;
let catalogAdminStoreError: string | null = null;

const runtimeDatabaseTarget = (() => {
  const config = buildPostgresConfig();
  if (config.connectionString) {
    try {
      const url = new URL(config.connectionString);
      return `${url.hostname}:${url.port || '5432'}${url.pathname}`;
    } catch {
      return 'connection-string-configured';
    }
  }
  return `${config.host}:${config.port}/${config.database}`;
})();

const LOCK_OWNERS: ComandaLockOwner[] = ['COMANDA_A', 'COMANDA_B'];
const LOCK_STATIONS: ComandaLockStationId[] = ['BALANCA_A', 'BALANCA_B'];

const parseNumero = (value: unknown) => (typeof value === 'string' ? value.trim() : '');
const parseComandaNumero = (value: unknown) => normalizeComandaNumber(value);

const parseNumber = (value: unknown, fallback = 0) => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string' && value.trim()) {
    const trimmed = value.trim();
    const normalized = trimmed.includes(',')
      ? trimmed.replace(/\./g, '').replace(',', '.')
      : trimmed;
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  return fallback;
};

const parseProductPayload = (body: unknown): ProductRecord | null => {
  if (typeof body !== 'object' || body === null) {
    return null;
  }

  const payload = body as { product?: unknown };
  const rawProduct = typeof payload.product === 'object' && payload.product !== null
    ? payload.product
    : body;

  return rawProduct as ProductRecord;
};

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
  if (error instanceof Error && error.message === 'Comanda nao encontrada.') {
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

  if (error instanceof Error && error.message === 'Comanda nao encontrada.') {
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
    console.log(`Persistencia de comanda: ${result.usingPostgres ? 'PostgreSQL' : 'arquivo local'}`);
  }

  const snapshot = await comandaStore.loadState();
  if (!snapshot) {
    return;
  }

  comandaService.loadSnapshot(snapshot);
};

const initializeProducts = async () => {
  try {
    productStore = await createProductStore();
    productStoreError = null;
    // eslint-disable-next-line no-console
    console.log(`Persistencia de produtos: ${productStore.storageKind === 'POSTGRES' ? 'PostgreSQL' : 'arquivo local compartilhado'}`);
  } catch (error) {
    productStore = null;
    productStoreError = error instanceof Error ? error.message : 'erro desconhecido';
    // eslint-disable-next-line no-console
    console.error('Falha ao iniciar persistencia PostgreSQL de produtos:', error);
  }
};

const initializeOperationalStore = async () => {
  try {
    operationalStore = await createOperationalStore();
    operationalStoreError = null;
    // eslint-disable-next-line no-console
    console.log('Persistencia operacional: PostgreSQL');
  } catch (error) {
    operationalStore = null;
    operationalStoreError = error instanceof Error ? error.message : 'erro desconhecido';
    // eslint-disable-next-line no-console
    console.error('Falha ao iniciar persistencia operacional PostgreSQL:', error);
  }
};

const initializeCatalogAdminStore = async () => {
  try {
    catalogAdminStore = await createCatalogAdminStore();
    catalogAdminStoreError = null;
    // eslint-disable-next-line no-console
    console.log('Persistencia de cadastros/admin: PostgreSQL');
  } catch (error) {
    catalogAdminStore = null;
    catalogAdminStoreError = error instanceof Error ? error.message : 'erro desconhecido';
    // eslint-disable-next-line no-console
    console.error('Falha ao iniciar persistencia PostgreSQL de cadastros/admin:', error);
  }
};

const requireProductStore = (res: express.Response): ProductStore | null => {
  if (productStore) {
    return productStore;
  }

  res.status(503).json({
    ok: false,
    message: `Banco de produtos indisponivel. O sistema continuara usando cache local ate o PostgreSQL voltar.${productStoreError ? ` Detalhe: ${productStoreError}` : ''}`
  });
  return null;
};

const requireOperationalStore = (res: express.Response): OperationalPostgresStore | null => {
  if (operationalStore) {
    return operationalStore;
  }

  res.status(503).json({
    ok: false,
    message: `Banco operacional indisponivel. Comandas, vendas, caixa e financeiro continuarao no modo local ate o PostgreSQL voltar.${operationalStoreError ? ` Detalhe: ${operationalStoreError}` : ''}`
  });
  return null;
};

const requireCatalogAdminStore = (res: express.Response): CatalogAdminPostgresStore | null => {
  if (catalogAdminStore) {
    return catalogAdminStore;
  }

  res.status(503).json({
    ok: false,
    message: `Banco de cadastros/admin indisponivel. O sistema continuara usando cache local ate o PostgreSQL voltar.${catalogAdminStoreError ? ` Detalhe: ${catalogAdminStoreError}` : ''}`
  });
  return null;
};

app.get('/api/v1/runtime', (_req, res) => {
  res.status(200).json({
    ok: true,
    service: 'pdv-touch-backend',
    apiVersion: 1,
    databaseTarget: runtimeDatabaseTarget,
    environmentConfigured: Boolean(loadedRuntimeEnvironmentFile || process.env.DATABASE_URL || process.env.PRODUCT_DATABASE_URL),
    stores: {
      products: productStore ? productStore.storageKind.toLowerCase() : 'unavailable',
      operational: operationalStore ? 'ready' : 'unavailable',
      catalog: catalogAdminStore ? 'ready' : 'unavailable'
    }
  });
});

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

app.get('/api/v1/comandas/:numero/items', (req, res) => {
  const comanda = comandaService.get(req.params.numero);
  if (!comanda) {
    res.status(404).json({ ok: false, message: 'Comanda nao encontrada.' });
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

    void comandaStore.appendAudit({
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

    void comandaStore.appendAudit({
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
    res.status(404).json({ ok: false, message: 'Comanda nao encontrada.' });
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

app.get('/api/v1/products', async (_req, res) => {
  const store = requireProductStore(res);
  if (!store) {
    return;
  }

  try {
    const products = await store.list();
    res.status(200).json({ ok: true, products });
  } catch (error) {
    res.status(500).json({
      ok: false,
      message: error instanceof Error ? error.message : 'Falha ao listar produtos.'
    });
  }
});

app.get('/api/v1/products/:id', async (req, res) => {
  const store = requireProductStore(res);
  if (!store) {
    return;
  }

  try {
    const product = await store.findById(req.params.id);
    if (!product) {
      res.status(404).json({ ok: false, message: 'Produto não encontrado.' });
      return;
    }

    res.status(200).json({ ok: true, product });
  } catch (error) {
    res.status(500).json({
      ok: false,
      message: error instanceof Error ? error.message : 'Falha ao consultar produto.'
    });
  }
});

app.put('/api/v1/products/:id', async (req, res) => {
  const store = requireProductStore(res);
  if (!store) {
    return;
  }

  const product = parseProductPayload(req.body);
  if (!product || product.id !== req.params.id) {
    res.status(400).json({ ok: false, message: 'Produto inválido ou ID divergente.' });
    return;
  }

  try {
    const savedProduct = await store.save(product);
    res.status(200).json({ ok: true, product: savedProduct });
  } catch (error) {
    res.status(400).json({
      ok: false,
      message: error instanceof Error ? error.message : 'Falha ao salvar produto.'
    });
  }
});

app.post('/api/v1/products', async (req, res) => {
  const store = requireProductStore(res);
  if (!store) {
    return;
  }

  const product = parseProductPayload(req.body);
  if (!product) {
    res.status(400).json({ ok: false, message: 'Produto inválido.' });
    return;
  }

  try {
    const savedProduct = await store.save(product);
    res.status(201).json({ ok: true, product: savedProduct });
  } catch (error) {
    res.status(400).json({
      ok: false,
      message: error instanceof Error ? error.message : 'Falha ao criar produto.'
    });
  }
});

app.delete('/api/v1/products/:id', async (req, res) => {
  const store = requireProductStore(res);
  if (!store) {
    return;
  }

  try {
    const deleted = await store.delete(req.params.id);
    res.status(200).json({ ok: true, deleted });
  } catch (error) {
    res.status(500).json({
      ok: false,
      message: error instanceof Error ? error.message : 'Falha ao excluir produto.'
    });
  }
});

app.get('/api/v1/catalog/:entity', async (req, res) => {
  const store = requireCatalogAdminStore(res);
  if (!store) {
    return;
  }

  try {
    const records = await store.listCatalog(req.params.entity);
    res.status(200).json({ ok: true, entity: req.params.entity, records });
  } catch (error) {
    res.status(400).json({
      ok: false,
      message: error instanceof Error ? error.message : 'Falha ao listar cadastro.'
    });
  }
});

app.get('/api/v1/catalog/:entity/:id', async (req, res) => {
  const store = requireCatalogAdminStore(res);
  if (!store) {
    return;
  }

  try {
    const record = await store.findCatalogById(req.params.entity, req.params.id);
    if (!record) {
      res.status(404).json({ ok: false, message: 'Cadastro não encontrado.' });
      return;
    }

    res.status(200).json({ ok: true, entity: req.params.entity, record });
  } catch (error) {
    res.status(400).json({
      ok: false,
      message: error instanceof Error ? error.message : 'Falha ao consultar cadastro.'
    });
  }
});

app.post('/api/v1/catalog/:entity', async (req, res) => {
  const store = requireCatalogAdminStore(res);
  if (!store) {
    return;
  }

  const payload = req.body?.record ?? req.body;
  try {
    const record = await store.saveCatalog(req.params.entity, payload);
    res.status(201).json({ ok: true, entity: req.params.entity, record });
  } catch (error) {
    res.status(400).json({
      ok: false,
      message: error instanceof Error ? error.message : 'Falha ao salvar cadastro.'
    });
  }
});

app.put('/api/v1/catalog/:entity/:id', async (req, res) => {
  const store = requireCatalogAdminStore(res);
  if (!store) {
    return;
  }

  const payload = req.body?.record ?? req.body;
  try {
    const record = await store.saveCatalog(req.params.entity, {
      ...(typeof payload === 'object' && payload !== null ? payload : {}),
      id: req.params.id
    });
    res.status(200).json({ ok: true, entity: req.params.entity, record });
  } catch (error) {
    res.status(400).json({
      ok: false,
      message: error instanceof Error ? error.message : 'Falha ao atualizar cadastro.'
    });
  }
});

app.delete('/api/v1/catalog/:entity/:id', async (req, res) => {
  const store = requireCatalogAdminStore(res);
  if (!store) {
    return;
  }

  try {
    await store.deleteCatalog(req.params.entity, req.params.id);
    res.status(200).json({ ok: true, entity: req.params.entity });
  } catch (error) {
    res.status(400).json({
      ok: false,
      message: error instanceof Error ? error.message : 'Falha ao excluir cadastro.'
    });
  }
});

app.get('/api/v1/admin/:entity', async (req, res) => {
  const store = requireCatalogAdminStore(res);
  if (!store) {
    return;
  }

  try {
    const records = await store.listAdmin(req.params.entity);
    res.status(200).json({ ok: true, entity: req.params.entity, records });
  } catch (error) {
    res.status(400).json({
      ok: false,
      message: error instanceof Error ? error.message : 'Falha ao listar configuração administrativa.'
    });
  }
});

app.get('/api/v1/admin/:entity/:id', async (req, res) => {
  const store = requireCatalogAdminStore(res);
  if (!store) {
    return;
  }

  try {
    const record = await store.findAdminById(req.params.entity, req.params.id);
    if (!record) {
      res.status(404).json({ ok: false, message: 'Configuração administrativa não encontrada.' });
      return;
    }

    res.status(200).json({ ok: true, entity: req.params.entity, record });
  } catch (error) {
    res.status(400).json({
      ok: false,
      message: error instanceof Error ? error.message : 'Falha ao consultar configuração administrativa.'
    });
  }
});

app.post('/api/v1/admin/:entity', async (req, res) => {
  const store = requireCatalogAdminStore(res);
  if (!store) {
    return;
  }

  const payload = req.body?.record ?? req.body;
  try {
    const record = await store.saveAdmin(req.params.entity, payload);
    res.status(201).json({ ok: true, entity: req.params.entity, record });
  } catch (error) {
    res.status(400).json({
      ok: false,
      message: error instanceof Error ? error.message : 'Falha ao salvar configuração administrativa.'
    });
  }
});

app.put('/api/v1/admin/:entity/:id', async (req, res) => {
  const store = requireCatalogAdminStore(res);
  if (!store) {
    return;
  }

  const payload = req.body?.record ?? req.body;
  try {
    const record = await store.saveAdmin(req.params.entity, {
      ...(typeof payload === 'object' && payload !== null ? payload : {}),
      id: req.params.id
    });
    res.status(200).json({ ok: true, entity: req.params.entity, record });
  } catch (error) {
    res.status(400).json({
      ok: false,
      message: error instanceof Error ? error.message : 'Falha ao atualizar configuração administrativa.'
    });
  }
});

app.delete('/api/v1/admin/:entity/:id', async (req, res) => {
  const store = requireCatalogAdminStore(res);
  if (!store) {
    return;
  }

  try {
    await store.deleteAdmin(req.params.entity, req.params.id);
    res.status(200).json({ ok: true, entity: req.params.entity });
  } catch (error) {
    res.status(400).json({
      ok: false,
      message: error instanceof Error ? error.message : 'Falha ao excluir configuração administrativa.'
    });
  }
});

app.get('/api/v1/catalog-admin/health', (_req, res) => {
  res.status(catalogAdminStore ? 200 : 503).json({
    ok: Boolean(catalogAdminStore),
    store: catalogAdminStore ? 'PostgreSQL' : 'indisponível',
    message: catalogAdminStoreError
  });
});

app.get('/api/v1/operational/health', (_req, res) => {
  res.status(operationalStore ? 200 : 503).json({
    ok: Boolean(operationalStore),
    store: operationalStore ? 'PostgreSQL' : 'indisponível',
    message: operationalStoreError
  });
});

app.post('/api/v1/vendas', async (req, res) => {
  const store = requireOperationalStore(res);
  if (!store) {
    return;
  }

  const payload = req.body ?? {};
  const documentMode = parseNumero(payload.documentMode).toUpperCase();
  const total = parseNumber(payload.total, Number.NaN);

  if (!['NFCE', 'ORCAMENTO'].includes(documentMode) || !Number.isFinite(total)) {
    res.status(400).json({
      ok: false,
      message: 'Venda inválida. Informe documentMode (NFCE ou ORCAMENTO) e total.'
    });
    return;
  }

  try {
    const venda = await store.registerSale({
      id: parseOptionalText(payload.id),
      comandaNumero: parseOptionalText(payload.comandaNumero),
      documentMode: documentMode as 'NFCE' | 'ORCAMENTO',
      status: parseOptionalText(payload.status),
      subtotal: parseNumber(payload.subtotal, total),
      discount: parseNumber(payload.discount),
      total,
      operator: parseOptionalText(payload.operator),
      pdv: parseOptionalText(payload.pdv),
      customerDocument: parseOptionalText(payload.customerDocument),
      closedAt: parseOptionalText(payload.closedAt),
      payments: Array.isArray(payload.payments)
        ? payload.payments.map((payment: Record<string, unknown>, index: number) => ({
          id: parseOptionalText(payment.id),
          method: parseOptionalText(payment.method) ?? `PAGAMENTO_${index + 1}`,
          label: parseOptionalText(payment.label),
          amount: parseNumber(payment.amount)
        }))
        : undefined
    });

    res.status(201).json({ ok: true, venda });
  } catch (error) {
    res.status(400).json({
      ok: false,
      message: error instanceof Error ? error.message : 'Falha ao registrar venda.'
    });
  }
});

app.post('/api/v1/caixa-sessions', async (req, res) => {
  const store = requireOperationalStore(res);
  if (!store) {
    return;
  }

  const payload = req.body ?? {};
  const id = parseOptionalText(payload.id);
  const status = parseNumero(payload.status).toUpperCase();
  const openedAt = parseOptionalText(payload.openedAt);

  if (!id || !['OPEN', 'CLOSED'].includes(status) || !openedAt) {
    res.status(400).json({
      ok: false,
      message: 'Sessão de caixa inválida. Informe id, status (OPEN ou CLOSED) e openedAt.'
    });
    return;
  }

  try {
    const session = await store.registerCashSession({
      id,
      status: status as 'OPEN' | 'CLOSED',
      openedAt,
      closedAt: parseOptionalText(payload.closedAt),
      openedBy: parseOptionalText(payload.openedBy),
      closedBy: parseOptionalText(payload.closedBy),
      totalSales: parseNumber(payload.totalSales),
      attendanceCount: parseNumber(payload.attendanceCount),
      expectedTotals: typeof payload.expectedTotals === 'object' && payload.expectedTotals !== null
        ? payload.expectedTotals as Record<string, number>
        : undefined
    });

    res.status(201).json({ ok: true, session });
  } catch (error) {
    res.status(400).json({
      ok: false,
      message: error instanceof Error ? error.message : 'Falha ao registrar sessão de caixa.'
    });
  }
});

app.post('/api/v1/financeiro', async (req, res) => {
  const store = requireOperationalStore(res);
  if (!store) {
    return;
  }

  const payload = req.body ?? {};
  const id = parseOptionalText(payload.id);
  const tab = parseNumero(payload.tab).toUpperCase();
  const amount = parseNumber(payload.amount, Number.NaN);

  if (!id || !['DESPESAS', 'RECEITA', 'CONTA_CORRENTE'].includes(tab) || !Number.isFinite(amount)) {
    res.status(400).json({
      ok: false,
      message: 'Lançamento financeiro inválido. Informe id, tab e amount.'
    });
    return;
  }

  try {
    const entry = await store.registerFinanceEntry({
      id,
      financeCode: parseOptionalText(payload.financeCode),
      tab: tab as 'DESPESAS' | 'RECEITA' | 'CONTA_CORRENTE',
      movementType: parseOptionalText(payload.movementType) as 'ENTRADA' | 'SAIDA' | undefined,
      category: parseOptionalText(payload.category),
      amount,
      description: parseOptionalText(payload.description),
      accountName: parseOptionalText(payload.accountName),
      documentRef: parseOptionalText(payload.documentRef),
      status: parseOptionalText(payload.status) ?? 'ABERTO',
      dueDate: parseOptionalText(payload.dueDate),
      competenceDate: parseOptionalText(payload.competenceDate),
      supplierName: parseOptionalText(payload.supplierName),
      convenioId: parseOptionalText(payload.convenioId),
      convenioName: parseOptionalText(payload.convenioName),
      paymentMethod: parseOptionalText(payload.paymentMethod),
      launchedAt: parseOptionalText(payload.launchedAt),
      sourceJson: payload
    });

    res.status(201).json({ ok: true, entry });
  } catch (error) {
    res.status(400).json({
      ok: false,
      message: error instanceof Error ? error.message : 'Falha ao registrar lançamento financeiro.'
    });
  }
});

app.get('/api/v1/financeiro', async (req, res) => {
  const store = requireOperationalStore(res);
  if (!store) {
    return;
  }

  try {
    const entries = await store.listFinanceEntries({
      tab: parseOptionalText(req.query.tab),
      status: parseOptionalText(req.query.status),
      accountName: parseOptionalText(req.query.accountName),
      dateFrom: parseOptionalText(req.query.dateFrom),
      dateTo: parseOptionalText(req.query.dateTo)
    });

    res.status(200).json({ ok: true, entries });
  } catch (error) {
    res.status(400).json({
      ok: false,
      message: error instanceof Error ? error.message : 'Falha ao listar lançamentos financeiros.'
    });
  }
});

app.get('/api/v1/financeiro/:id', async (req, res) => {
  const store = requireOperationalStore(res);
  if (!store) {
    return;
  }

  try {
    const entry = await store.findFinanceEntryById(req.params.id);
    if (!entry) {
      res.status(404).json({ ok: false, message: 'Lançamento financeiro não encontrado.' });
      return;
    }

    res.status(200).json({ ok: true, entry });
  } catch (error) {
    res.status(400).json({
      ok: false,
      message: error instanceof Error ? error.message : 'Falha ao consultar lançamento financeiro.'
    });
  }
});

app.delete('/api/v1/financeiro/:id', async (req, res) => {
  const store = requireOperationalStore(res);
  if (!store) {
    return;
  }

  try {
    await store.deleteFinanceEntry(req.params.id);
    res.status(200).json({ ok: true });
  } catch (error) {
    res.status(400).json({
      ok: false,
      message: error instanceof Error ? error.message : 'Falha ao excluir lançamento financeiro.'
    });
  }
});

app.post('/api/v1/comandas/close-batch', async (req, res) => {
  const numeros: string[] = Array.isArray(req.body?.numeros)
    ? (req.body.numeros as unknown[]).map(parseComandaNumero).filter(Boolean)
    : [];
  const documentMode = parseNumero(req.body?.documentMode).toUpperCase();
  const payments: CloseBatchPayment[] = Array.isArray(req.body?.payments)
    ? (req.body.payments as unknown[])
      .map((raw, index): CloseBatchPayment => {
        const payment = (typeof raw === 'object' && raw !== null ? raw : {}) as Record<string, unknown>;
        return {
          id: parseOptionalText(payment.id),
          method: parseOptionalText(payment.method) ?? `PAGAMENTO_${index + 1}`,
          label: parseOptionalText(payment.label),
          amount: parseNumber(payment.amount)
        };
      })
      .filter((payment) => payment.amount > 0)
    : [];
  const targetStatus = documentMode === 'ORCAMENTO'
    ? 'FECHADA_ORCAMENTO'
    : documentMode === 'NFCE'
      ? 'FECHADA_VENDA'
      : null;

  if (numeros.length === 0 || !targetStatus) {
    res.status(400).json({
      ok: false,
      message: 'Informe as comandas e o modo de documento (NFCE ou ORCAMENTO).'
    });
    return;
  }

  if (payments.length > 0 && !operationalStore) {
    res.status(503).json({
      ok: false,
      message: `Banco operacional indisponível. O pagamento não foi gravado no PostgreSQL.${operationalStoreError ? ` Detalhe: ${operationalStoreError}` : ''}`
    });
    return;
  }

  const snapshotBeforeClose = comandaService.snapshot();

  try {
    const reason = parseNumero(req.body?.reason) || 'fechamento_comandas_unidas_caixa';
    const closeAndRegister = async (
      registerSale?: ComandaLockTransactionContext['registerSale'],
      mirrorComandas?: ComandaLockTransactionContext['mirrorComandas']
    ): Promise<CloseBatchResult> => {
      const beforeByNumero = new Map<string, ComandaRecord | null>(
        numeros.map((numero) => [numero, comandaService.get(numero)] as const)
      );
      const comandas = comandaService.closeMany(
        numeros,
        targetStatus,
        reason
      );

      if (mirrorComandas) {
        await mirrorComandas(comandas);
      }

      if (registerSale && payments.length > 0) {
        await Promise.all(comandas.map((comanda) => {
          const subtotal = comanda.items.reduce((sum, item) => sum + parseNumber(item.subtotal), 0);
          const discount = parseNumber(req.body?.discount);
          const total = Math.max(0, subtotal - discount);
          const saleId = `venda-comanda-${comanda.numero}-${targetStatus}`;

          return registerSale({
            id: saleId,
            comandaNumero: comanda.numero,
            documentMode: documentMode as 'NFCE' | 'ORCAMENTO',
            status: 'CLOSED',
            subtotal,
            discount,
            total,
            operator: parseOptionalText(req.body?.operator) ?? 'CAIXA',
            pdv: parseOptionalText(req.body?.pdv) ?? 'CAIXA',
            customerDocument: parseOptionalText(req.body?.customerDocument),
            closedAt: comanda.updatedAt,
            payments: payments.map((payment, index) => ({
              ...payment,
              id: `${saleId}-pagamento-${index + 1}`
            }))
          });
        }));
      }

      return { beforeByNumero, comandas };
    };

    const { beforeByNumero, comandas } = operationalStore
      ? await operationalStore.withComandaLocks(numeros, ({ registerSale, mirrorComandas }) =>
        closeAndRegister(registerSale, mirrorComandas)
      )
      : await closeAndRegister();

    await persistComandas();
    await Promise.all(comandas.flatMap((comanda) => {
      const before = beforeByNumero.get(comanda.numero);
      const previousTransitionCount = before?.transitions.length ?? 0;
      return comanda.transitions.slice(previousTransitionCount).map((transition) => appendTransitionAudit(
        comanda.numero,
        transition.from,
        transition.to,
        transition.at,
        transition.reason
      ));
    }));

    res.status(200).json({ ok: true, comandas });
  } catch (error) {
    comandaService.loadSnapshot(snapshotBeforeClose);
    void persistComandas();
    res.status(400).json({
      ok: false,
      message: error instanceof Error ? error.message : 'Falha ao fechar comandas em lote.'
    });
  }
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

      void comandaStore.appendAudit({
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
      message: 'Campos owner e stationId sao obrigatorios (COMANDA_A|COMANDA_B, BALANCA_A|BALANCA_B).'
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
      void comandaStore.appendAudit({
        action: 'LOCK_EXPIRED',
        numero: result.comanda.numero,
        at: result.comanda.updatedAt,
        reason: parseNumero(req.body?.reason) || 'lock_expired_before_acquire'
      });
    }

    void comandaStore.appendAudit({
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
      message: 'Campos owner e stationId sao obrigatorios (COMANDA_A|COMANDA_B, BALANCA_A|BALANCA_B).'
    });
    return;
  }

  try {
    const result = comandaService.renewLock(req.params.numero, {
      owner,
      stationId,
      ttlSeconds: parsePositiveNumber(req.body?.ttlSeconds)
    });

    void comandaStore.appendAudit({
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
      message: 'Campos owner e stationId sao obrigatorios (COMANDA_A|COMANDA_B, BALANCA_A|BALANCA_B).'
    });
    return;
  }

  try {
    const comanda = comandaService.releaseLock(req.params.numero, {
      owner,
      stationId
    });

    void comandaStore.appendAudit({
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
  console.warn('Leitor de balanca desativado: defina SERIAL_PORT_PATH para habilitar leitura serial.');
}

const PORT = Number(process.env.PORT ?? 3001);

void (async () => {
  try {
    await initializeComandas();
    // Os stores PostgreSQL nao bloqueiam o boot: cada um degrada para 503 e o
    // frontend continua no cache local ate o banco voltar.
    await Promise.all([
      initializeProducts(),
      initializeOperationalStore(),
      initializeCatalogAdminStore()
    ]);
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
