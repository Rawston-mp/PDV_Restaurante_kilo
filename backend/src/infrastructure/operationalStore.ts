import type { Pool } from 'pg';

import type {
  ComandaRecord,
  ComandaStateSnapshot
} from '../domain/comandaStateMachine';
import { normalizeComandaNumber } from '../domain/comandaStateMachine';
import type { ComandaAuditEvent } from './comandaFileStore';
import { createPostgresPool } from './postgresConfig';

export type RegisterSaleInput = {
  id?: string;
  comandaNumero?: string;
  documentMode: 'NFCE' | 'ORCAMENTO';
  status?: string;
  subtotal?: number;
  discount?: number;
  total: number;
  operator?: string;
  pdv?: string;
  customerDocument?: string;
  closedAt?: string;
  payments?: Array<{
    id?: string;
    method: string;
    label?: string;
    amount: number;
  }>;
};

export type RegisterCashSessionInput = {
  id: string;
  status: 'OPEN' | 'CLOSED';
  openedAt: string;
  closedAt?: string;
  openedBy?: string;
  closedBy?: string;
  totalSales?: number;
  attendanceCount?: number;
  expectedTotals?: Record<string, number>;
};

export type RegisterFinanceEntryInput = {
  id: string;
  financeCode?: string;
  tab: 'DESPESAS' | 'RECEITA' | 'CONTA_CORRENTE';
  movementType?: 'ENTRADA' | 'SAIDA';
  category?: string;
  amount: number;
  description?: string;
  accountName?: string;
  documentRef?: string;
  status: string;
  dueDate?: string;
  competenceDate?: string;
  supplierName?: string;
  convenioId?: string;
  convenioName?: string;
  paymentMethod?: string;
  launchedAt?: string;
  sourceJson?: unknown;
};

export type FinanceEntryFilters = {
  tab?: string;
  status?: string;
  accountName?: string;
  dateFrom?: string;
  dateTo?: string;
};

export type ComandaLockTransactionContext = {
  lockedComandas: unknown[];
  mirrorComandas: (comandas: ComandaRecord[]) => Promise<void>;
  registerSale: (input: RegisterSaleInput) => Promise<unknown>;
};

const toNumber = (value: unknown, fallback = 0) => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value.replace(',', '.'));
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  return fallback;
};

const sumItems = (comanda: ComandaRecord) =>
  Number(comanda.items.reduce((sum, item) => sum + toNumber(item.subtotal), 0).toFixed(2));

const findClosedAt = (comanda: ComandaRecord) =>
  [...comanda.transitions]
    .reverse()
    .find((transition) => transition.to === 'FECHADA_ORCAMENTO' || transition.to === 'FECHADA_VENDA')
    ?.at;

const saleIdForComanda = (comanda: ComandaRecord) => `venda-comanda-${comanda.numero}-${comanda.status}`;

export class OperationalPostgresStore {
  constructor(private readonly pool: Pool) {}

  async initialize() {
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS comandas (
        numero TEXT PRIMARY KEY,
        status TEXT NOT NULL,
        total NUMERIC(14, 2) NOT NULL DEFAULT 0,
        item_count INTEGER NOT NULL DEFAULT 0,
        opened_at TIMESTAMPTZ NOT NULL,
        closed_at TIMESTAMPTZ,
        updated_at TIMESTAMPTZ NOT NULL,
        active BOOLEAN NOT NULL DEFAULT TRUE,
        lock_json JSONB,
        source_snapshot JSONB NOT NULL
      )
    `);

    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS comanda_items (
        id TEXT PRIMARY KEY,
        comanda_numero TEXT NOT NULL REFERENCES comandas(numero) ON DELETE CASCADE,
        name TEXT NOT NULL,
        quantity NUMERIC(14, 3) NOT NULL DEFAULT 0,
        weight NUMERIC(14, 3),
        unit_price NUMERIC(14, 2) NOT NULL DEFAULT 0,
        subtotal NUMERIC(14, 2) NOT NULL DEFAULT 0,
        by_weight BOOLEAN NOT NULL DEFAULT FALSE,
        by_unit BOOLEAN NOT NULL DEFAULT FALSE,
        launch_source TEXT,
        raw_json JSONB NOT NULL,
        created_at TIMESTAMPTZ,
        updated_at TIMESTAMPTZ
      )
    `);

    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS comanda_pesagens (
        id TEXT PRIMARY KEY,
        comanda_numero TEXT NOT NULL REFERENCES comandas(numero) ON DELETE CASCADE,
        weight NUMERIC(14, 3) NOT NULL,
        origin TEXT,
        owner TEXT,
        station_id TEXT,
        item_id TEXT,
        product_name TEXT,
        reason TEXT,
        created_at TIMESTAMPTZ NOT NULL,
        raw_json JSONB NOT NULL
      )
    `);

    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS vendas (
        id TEXT PRIMARY KEY,
        comanda_numero TEXT REFERENCES comandas(numero) ON DELETE SET NULL,
        document_mode TEXT NOT NULL CHECK (document_mode IN ('NFCE', 'ORCAMENTO')),
        status TEXT NOT NULL DEFAULT 'CLOSED',
        subtotal NUMERIC(14, 2) NOT NULL DEFAULT 0,
        discount NUMERIC(14, 2) NOT NULL DEFAULT 0,
        total NUMERIC(14, 2) NOT NULL DEFAULT 0,
        operator TEXT,
        pdv TEXT,
        customer_document TEXT,
        source TEXT NOT NULL DEFAULT 'BACKEND',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        closed_at TIMESTAMPTZ
      )
    `);

    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS pagamentos (
        id TEXT PRIMARY KEY,
        venda_id TEXT NOT NULL REFERENCES vendas(id) ON DELETE CASCADE,
        method TEXT NOT NULL,
        label TEXT,
        amount NUMERIC(14, 2) NOT NULL DEFAULT 0,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS caixa_sessions (
        id TEXT PRIMARY KEY,
        status TEXT NOT NULL CHECK (status IN ('OPEN', 'CLOSED')),
        opened_at TIMESTAMPTZ NOT NULL,
        closed_at TIMESTAMPTZ,
        opened_by TEXT,
        closed_by TEXT,
        total_sales NUMERIC(14, 2) NOT NULL DEFAULT 0,
        attendance_count INTEGER NOT NULL DEFAULT 0,
        expected_totals JSONB NOT NULL DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS financeiro (
        id TEXT PRIMARY KEY,
        finance_code TEXT,
        tab TEXT NOT NULL,
        movement_type TEXT,
        category TEXT,
        amount NUMERIC(14, 2) NOT NULL DEFAULT 0,
        description TEXT,
        account_name TEXT,
        document_ref TEXT,
        status TEXT NOT NULL,
        due_date DATE,
        competence_date DATE,
        supplier_name TEXT,
        convenio_id TEXT,
        convenio_name TEXT,
        payment_method TEXT,
        launched_at TIMESTAMPTZ,
        source_json JSONB,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS audit_logs (
        id BIGSERIAL PRIMARY KEY,
        action TEXT NOT NULL,
        user_id TEXT,
        user_role TEXT,
        entity TEXT NOT NULL,
        entity_id TEXT,
        before_json JSONB,
        after_json JSONB,
        status TEXT NOT NULL DEFAULT 'SUCCESS',
        reason TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    await this.pool.query('CREATE INDEX IF NOT EXISTS idx_comandas_status ON comandas(status)');
    await this.pool.query('ALTER TABLE comanda_items ADD COLUMN IF NOT EXISTS launch_source TEXT');
    await this.pool.query('CREATE INDEX IF NOT EXISTS idx_comanda_items_numero ON comanda_items(comanda_numero)');
    await this.pool.query('CREATE INDEX IF NOT EXISTS idx_vendas_closed_at ON vendas(closed_at)');
    await this.pool.query('CREATE INDEX IF NOT EXISTS idx_pagamentos_venda ON pagamentos(venda_id)');
    await this.pool.query('CREATE INDEX IF NOT EXISTS idx_financeiro_status ON financeiro(status)');
    await this.pool.query('CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs(entity, entity_id)');
  }

  async mirrorComandaSnapshot(snapshot: ComandaStateSnapshot) {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      for (const comanda of snapshot.comandas) {
        const total = sumItems(comanda);
        const closedAt = findClosedAt(comanda) ?? null;
        const active = !['FECHADA_ORCAMENTO', 'FECHADA_VENDA', 'CANCELADA', 'ARQUIVADA'].includes(comanda.status);

        await client.query(
          `
            INSERT INTO comandas (
              numero, status, total, item_count, opened_at, closed_at, updated_at,
              active, lock_json, source_snapshot
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10::jsonb)
            ON CONFLICT (numero)
            DO UPDATE SET
              status = EXCLUDED.status,
              total = EXCLUDED.total,
              item_count = EXCLUDED.item_count,
              closed_at = EXCLUDED.closed_at,
              updated_at = EXCLUDED.updated_at,
              active = EXCLUDED.active,
              lock_json = EXCLUDED.lock_json,
              source_snapshot = EXCLUDED.source_snapshot
          `,
          [
            comanda.numero,
            comanda.status,
            total,
            comanda.items.length,
            comanda.createdAt,
            closedAt,
            comanda.updatedAt,
            active,
            comanda.lock ? JSON.stringify(comanda.lock) : null,
            JSON.stringify(comanda)
          ]
        );

        await client.query('DELETE FROM comanda_items WHERE comanda_numero = $1', [comanda.numero]);
        for (const item of comanda.items) {
          await client.query(
            `
              INSERT INTO comanda_items (
                id, comanda_numero, name, quantity, weight, unit_price, subtotal,
                by_weight, by_unit, launch_source, raw_json, created_at, updated_at
              )
              VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::jsonb, $12, $13)
            `,
            [
              item.id,
              comanda.numero,
              item.nome,
              toNumber(item.quantidade),
              item.peso ?? null,
              toNumber(item.precoUnitario),
              toNumber(item.subtotal),
              !Boolean(item.porUnidade),
              Boolean(item.porUnidade),
              // origem_lancamento nao existe mais em ComandaItemRecord; coluna mantida nullable.
          null,
              JSON.stringify(item),
              item.createdAt ?? null,
              item.updatedAt ?? null
            ]
          );
        }

        await client.query('DELETE FROM comanda_pesagens WHERE comanda_numero = $1', [comanda.numero]);
        for (const pesagem of comanda.pesagens) {
          await client.query(
            `
              INSERT INTO comanda_pesagens (
                id, comanda_numero, weight, origin, owner, station_id, item_id,
                product_name, reason, created_at, raw_json
              )
              VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::jsonb)
            `,
            [
              pesagem.id,
              comanda.numero,
              pesagem.peso,
              pesagem.origem ?? null,
              pesagem.owner ?? null,
              pesagem.stationId ?? null,
              pesagem.itemId ?? null,
              pesagem.productName ?? null,
              pesagem.reason ?? null,
              pesagem.createdAt,
              JSON.stringify(pesagem)
            ]
          );
        }

        if (comanda.status === 'FECHADA_ORCAMENTO' || comanda.status === 'FECHADA_VENDA') {
          await this.registerSaleInClient(client, {
            id: saleIdForComanda(comanda),
            comandaNumero: comanda.numero,
            documentMode: comanda.status === 'FECHADA_VENDA' ? 'NFCE' : 'ORCAMENTO',
            status: 'CLOSED',
            subtotal: total,
            total,
            closedAt: closedAt ?? comanda.updatedAt,
            pdv: 'CAIXA',
            operator: 'CAIXA'
          });
        }
      }

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async appendAudit(event: ComandaAuditEvent) {
    await this.pool.query(
      `
        INSERT INTO audit_logs (
          action, entity, entity_id, after_json, status, reason, created_at
        )
        VALUES ($1, 'COMANDA', $2, $3::jsonb, 'SUCCESS', $4, $5)
      `,
      [
        event.action,
        event.numero,
        JSON.stringify(event),
        event.reason ?? null,
        event.at ?? new Date().toISOString()
      ]
    );
  }

  private async mirrorComandaRecordInClient(client: Pick<Pool, 'query'>, comanda: ComandaRecord) {
    const total = sumItems(comanda);
    const closedAt = findClosedAt(comanda) ?? null;
    const active = !['FECHADA_ORCAMENTO', 'FECHADA_VENDA', 'CANCELADA', 'ARQUIVADA'].includes(comanda.status);

    await client.query(
      `
        INSERT INTO comandas (
          numero, status, total, item_count, opened_at, closed_at, updated_at,
          active, lock_json, source_snapshot
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10::jsonb)
        ON CONFLICT (numero)
        DO UPDATE SET
          status = EXCLUDED.status,
          total = EXCLUDED.total,
          item_count = EXCLUDED.item_count,
          closed_at = EXCLUDED.closed_at,
          updated_at = EXCLUDED.updated_at,
          active = EXCLUDED.active,
          lock_json = EXCLUDED.lock_json,
          source_snapshot = EXCLUDED.source_snapshot
      `,
      [
        comanda.numero,
        comanda.status,
        total,
        comanda.items.length,
        comanda.createdAt,
        closedAt,
        comanda.updatedAt,
        active,
        comanda.lock ? JSON.stringify(comanda.lock) : null,
        JSON.stringify(comanda)
      ]
    );

    await client.query('DELETE FROM comanda_items WHERE comanda_numero = $1', [comanda.numero]);
    for (const item of comanda.items) {
      await client.query(
        `
          INSERT INTO comanda_items (
            id, comanda_numero, name, quantity, weight, unit_price, subtotal,
            by_weight, by_unit, launch_source, raw_json, created_at, updated_at
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::jsonb, $12, $13)
        `,
        [
          item.id,
          comanda.numero,
          item.nome,
          toNumber(item.quantidade),
          item.peso ?? null,
          toNumber(item.precoUnitario),
          toNumber(item.subtotal),
          !Boolean(item.porUnidade),
          Boolean(item.porUnidade),
          // origem_lancamento nao existe mais em ComandaItemRecord; coluna mantida nullable.
          null,
          JSON.stringify(item),
          item.createdAt ?? null,
          item.updatedAt ?? null
        ]
      );
    }

    await client.query('DELETE FROM comanda_pesagens WHERE comanda_numero = $1', [comanda.numero]);
    for (const pesagem of comanda.pesagens) {
      await client.query(
        `
          INSERT INTO comanda_pesagens (
            id, comanda_numero, weight, origin, owner, station_id, item_id,
            product_name, reason, created_at, raw_json
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::jsonb)
        `,
        [
          pesagem.id,
          comanda.numero,
          pesagem.peso,
          pesagem.origem ?? null,
          pesagem.owner ?? null,
          pesagem.stationId ?? null,
          pesagem.itemId ?? null,
          pesagem.productName ?? null,
          pesagem.reason ?? null,
          pesagem.createdAt,
          JSON.stringify(pesagem)
        ]
      );
    }
  }

  async registerSale(input: RegisterSaleInput) {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const sale = await this.registerSaleInClient(client, input);
      await client.query('COMMIT');
      return sale;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  private async registerSaleInClient(client: Pick<Pool, 'query'>, input: RegisterSaleInput) {
    const id = input.id ?? `venda-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const closedAt = input.closedAt ?? new Date().toISOString();
    const subtotal = toNumber(input.subtotal, input.total);
    const discount = toNumber(input.discount);
    const total = toNumber(input.total);

    const result = await client.query(
      `
        INSERT INTO vendas (
          id, comanda_numero, document_mode, status, subtotal, discount, total,
          operator, pdv, customer_document, source, closed_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'BACKEND', $11)
        ON CONFLICT (id)
        DO UPDATE SET
          comanda_numero = EXCLUDED.comanda_numero,
          document_mode = EXCLUDED.document_mode,
          status = EXCLUDED.status,
          subtotal = EXCLUDED.subtotal,
          discount = EXCLUDED.discount,
          total = EXCLUDED.total,
          operator = EXCLUDED.operator,
          pdv = EXCLUDED.pdv,
          customer_document = EXCLUDED.customer_document,
          closed_at = EXCLUDED.closed_at
        RETURNING *
      `,
      [
        id,
        input.comandaNumero ?? null,
        input.documentMode,
        input.status ?? 'CLOSED',
        subtotal,
        discount,
        total,
        input.operator ?? null,
        input.pdv ?? null,
        input.customerDocument ?? null,
        closedAt
      ]
    );

    if (input.payments) {
      await client.query('DELETE FROM pagamentos WHERE venda_id = $1', [id]);
      for (const [index, payment] of input.payments.entries()) {
        await client.query(
          `
            INSERT INTO pagamentos (id, venda_id, method, label, amount)
            VALUES ($1, $2, $3, $4, $5)
            ON CONFLICT (id)
            DO UPDATE SET
              method = EXCLUDED.method,
              label = EXCLUDED.label,
              amount = EXCLUDED.amount
          `,
          [
            payment.id ?? `${id}-pagamento-${index + 1}`,
            id,
            payment.method,
            payment.label ?? null,
            toNumber(payment.amount)
          ]
        );
      }
    }

    return result.rows[0];
  }

  async registerCashSession(input: RegisterCashSessionInput) {
    const result = await this.pool.query(
      `
        INSERT INTO caixa_sessions (
          id, status, opened_at, closed_at, opened_by, closed_by,
          total_sales, attendance_count, expected_totals, updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, NOW())
        ON CONFLICT (id)
        DO UPDATE SET
          status = EXCLUDED.status,
          closed_at = EXCLUDED.closed_at,
          opened_by = EXCLUDED.opened_by,
          closed_by = EXCLUDED.closed_by,
          total_sales = EXCLUDED.total_sales,
          attendance_count = EXCLUDED.attendance_count,
          expected_totals = EXCLUDED.expected_totals,
          updated_at = NOW()
        RETURNING *
      `,
      [
        input.id,
        input.status,
        input.openedAt,
        input.closedAt ?? null,
        input.openedBy ?? null,
        input.closedBy ?? null,
        toNumber(input.totalSales),
        Math.trunc(toNumber(input.attendanceCount)),
        JSON.stringify(input.expectedTotals ?? {})
      ]
    );

    return result.rows[0];
  }

  async registerFinanceEntry(input: RegisterFinanceEntryInput) {
    const result = await this.pool.query(
      `
        INSERT INTO financeiro (
          id, finance_code, tab, movement_type, category, amount, description,
          account_name, document_ref, status, due_date, competence_date,
          supplier_name, convenio_id, convenio_name, payment_method, launched_at,
          source_json, updated_at
        )
        VALUES (
          $1, $2, $3, $4, $5, $6, $7,
          $8, $9, $10, $11, $12,
          $13, $14, $15, $16, $17,
          $18::jsonb, NOW()
        )
        ON CONFLICT (id)
        DO UPDATE SET
          finance_code = EXCLUDED.finance_code,
          tab = EXCLUDED.tab,
          movement_type = EXCLUDED.movement_type,
          category = EXCLUDED.category,
          amount = EXCLUDED.amount,
          description = EXCLUDED.description,
          account_name = EXCLUDED.account_name,
          document_ref = EXCLUDED.document_ref,
          status = EXCLUDED.status,
          due_date = EXCLUDED.due_date,
          competence_date = EXCLUDED.competence_date,
          supplier_name = EXCLUDED.supplier_name,
          convenio_id = EXCLUDED.convenio_id,
          convenio_name = EXCLUDED.convenio_name,
          payment_method = EXCLUDED.payment_method,
          launched_at = EXCLUDED.launched_at,
          source_json = EXCLUDED.source_json,
          updated_at = NOW()
        RETURNING *
      `,
      [
        input.id,
        input.financeCode ?? null,
        input.tab,
        input.movementType ?? null,
        input.category ?? null,
        toNumber(input.amount),
        input.description ?? null,
        input.accountName ?? null,
        input.documentRef ?? null,
        input.status,
        input.dueDate ?? null,
        input.competenceDate ?? null,
        input.supplierName ?? null,
        input.convenioId ?? null,
        input.convenioName ?? null,
        input.paymentMethod ?? null,
        input.launchedAt ?? null,
        JSON.stringify(input.sourceJson ?? input)
      ]
    );

    return result.rows[0];
  }

  async listFinanceEntries(filters: FinanceEntryFilters = {}) {
    const conditions: string[] = [];
    const values: unknown[] = [];

    if (filters.tab) {
      values.push(filters.tab);
      conditions.push(`tab = $${values.length}`);
    }

    if (filters.status) {
      values.push(filters.status);
      conditions.push(`status = $${values.length}`);
    }

    if (filters.accountName) {
      values.push(filters.accountName);
      conditions.push(`account_name = $${values.length}`);
    }

    if (filters.dateFrom) {
      values.push(filters.dateFrom);
      conditions.push(`COALESCE(competence_date, due_date, launched_at::date, created_at::date) >= $${values.length}::date`);
    }

    if (filters.dateTo) {
      values.push(filters.dateTo);
      conditions.push(`COALESCE(competence_date, due_date, launched_at::date, created_at::date) <= $${values.length}::date`);
    }

    const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const result = await this.pool.query(
      `
        SELECT *
        FROM financeiro
        ${whereClause}
        ORDER BY COALESCE(launched_at, updated_at, created_at) DESC, id DESC
      `,
      values
    );

    return result.rows;
  }

  async findFinanceEntryById(id: string) {
    const result = await this.pool.query('SELECT * FROM financeiro WHERE id = $1', [id]);
    return result.rowCount ? result.rows[0] : null;
  }

  async deleteFinanceEntry(id: string) {
    await this.pool.query('DELETE FROM financeiro WHERE id = $1', [id]);
  }

  /**
   * Bloqueia um lote de comandas em ordem fixa e executa o fechamento em uma única transação.
   * A ordenação evita deadlocks quando dois caixas tentam fechar comandas em conjunto.
   */
  async withComandaLocks<T>(
    numeros: string[],
    fn: (context: ComandaLockTransactionContext) => Promise<T>
  ): Promise<T> {
    const normalizedNumbers = [...new Set(numeros.map(normalizeComandaNumber).filter(Boolean))]
      .sort((left, right) => left.localeCompare(right, 'pt-BR', { numeric: true }));
    const client = await this.pool.connect();

    try {
      await client.query('BEGIN');

      const lockedComandas = normalizedNumbers.length > 0
        ? (await client.query(
          `
            SELECT *
            FROM comandas
            WHERE numero = ANY($1::text[])
            ORDER BY numero
            FOR UPDATE
          `,
          [normalizedNumbers]
        )).rows
        : [];

      const result = await fn({
        lockedComandas,
        mirrorComandas: async (comandas) => {
          for (const comanda of comandas) {
            await this.mirrorComandaRecordInClient(client, comanda);
          }
        },
        registerSale: (input) => this.registerSaleInClient(client, input)
      });

      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Bloqueio pessimista para o caixa / balança no PostgreSQL (FOR UPDATE)
   * Impede condições de corrida entre a Balança e o Caixa ao ler a comanda para alteração/fechamento.
   */
  async findComandaForUpdate(client: Pick<Pool, 'query'>, numero: string) {
    const result = await client.query(
      'SELECT * FROM comandas WHERE numero = $1 FOR UPDATE',
      [normalizeComandaNumber(numero)]
    );
    return result.rowCount ? result.rows[0] : null;
  }

  /**
   * Executa um callback envelopado em uma transação segura com FOR UPDATE na comanda informada.
   */
  async withComandaLock<T>(numero: string, fn: (comandaRow: any) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const comandaRow = await this.findComandaForUpdate(client, normalizeComandaNumber(numero));
      const result = await fn(comandaRow);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
}

export const createOperationalStore = async () => {
  const store = new OperationalPostgresStore(createPostgresPool());
  await store.initialize();
  return store;
};
