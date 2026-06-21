import { useMemo, useState, type FormEvent } from 'react';

import type { Order } from '@/modules/orders/domain/entities/Order';
import type { OrderStatus } from '@/modules/orders/domain/entities/Order';
import { ordersContainer } from '@/modules/orders/infrastructure/container/ordersContainer';
import { useOrdersQuery } from '@/modules/orders/presentation/hooks/useOrdersQuery';
import { useCashMovementsQuery } from '@/modules/finance/presentation/hooks/useCashMovementsQuery';
import { useCreateCashMovement } from '@/modules/finance/presentation/hooks/useCreateCashMovement';
import { useConveniosQuery } from '@/modules/convenios/presentation/hooks/useConveniosQuery';
import { financeContainer } from '@/modules/finance/infrastructure/container/financeContainer';
import type { CashMovement } from '@/modules/finance/domain/entities/CashMovement';

const currencyFormatter = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL'
});

const statusLabels: Record<OrderStatus, string> = {
  PENDENTE: 'Pendente',
  EM_PREPARO: 'Em preparo',
  PRONTO: 'Pronto',
  ENTREGUE: 'Entregue'
};

const movementTypeLabels = {
  ENTRADA: 'Entrada',
  SAIDA: 'Saída'
} as const;

const incomeCategories = ['PIX', 'DINHEIRO', 'TRANSFERENCIA', 'FIADO', 'CARTAO', 'OUTRO'] as const;
const expenseCategories = ['TROCO', 'INSUMOS', 'FORNECEDOR', 'BANCO', 'MANUTENCAO', 'OUTROS'] as const;

const normalizeDate = (value: Date | string | undefined) => {
  if (!value) {
    return null;
  }

  const parsed = value instanceof Date ? value : new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const startOfDay = (date: Date) => {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
};

const startOfMonth = (date: Date) => {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  next.setDate(1);
  return next;
};

const formatDayLabel = (date: Date) =>
  new Intl.DateTimeFormat('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' }).format(date);

const formatDateTimeInput = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day}T${hours}:${minutes}`;
};

const parseDateTimeInput = (value: string) => {
  if (!value) {
    return new Date();
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
};

const isWithinPeriod = (date: Date | string | undefined, start: Date | null, end: Date | null) => {
  const parsed = normalizeDate(date);
  if (!parsed) {
    return false;
  }

  if (start && parsed < start) {
    return false;
  }

  if (end && parsed > end) {
    return false;
  }

  return true;
};

const createCsvContent = (rows: string[][]) =>
  rows
    .map((row) => row.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(';'))
    .join('\n');

const triggerCsvDownload = (filename: string, content: string) => {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
};

export function DashboardPage() {
  const { orders, reload: reloadOrders } = useOrdersQuery();
  const { cashMovements, reload: reloadCashMovements } = useCashMovementsQuery();
  const { convenios } = useConveniosQuery();
  const { createCashMovement, saving: savingCashMovement } = useCreateCashMovement();
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [movementType, setMovementType] = useState<'ENTRADA' | 'SAIDA'>('ENTRADA');
  const [movementCategory, setMovementCategory] = useState('PIX');
  const [movementAmount, setMovementAmount] = useState('');
  const [movementDescription, setMovementDescription] = useState('');
  const [movementConvenioId, setMovementConvenioId] = useState('');
  const [movementLaunchedAt, setMovementLaunchedAt] = useState(formatDateTimeInput(new Date()));
  const [movementError, setMovementError] = useState<string | null>(null);
  const [periodStartInput, setPeriodStartInput] = useState('');
  const [periodEndInput, setPeriodEndInput] = useState('');
  const [periodStart, setPeriodStart] = useState<Date | null>(null);
  const [periodEnd, setPeriodEnd] = useState<Date | null>(null);

  const dashboard = useMemo(() => {
    const now = new Date();
    const todayStart = periodStart ?? startOfDay(now);
    const monthStart = periodStart ?? startOfMonth(now);
    const periodEndDate = periodEnd ?? now;
    const lastSevenDays = Array.from({ length: 7 }, (_, index) => {
      const date = startOfDay(new Date(now));
      date.setDate(date.getDate() - (6 - index));
      return date;
    });

    const reportOrders = orders.filter((order) => isWithinPeriod(order.createdAt, periodStart, periodEndDate));
    const reportMovements = cashMovements.filter((movement) => isWithinPeriod(movement.launchedAt, periodStart, periodEndDate));

    const orderSummary = reportOrders.reduce(
      (accumulator, order) => {
        const createdAt = normalizeDate(order.createdAt);
        accumulator.totalSales += order.total;

        if (createdAt) {
          if (createdAt >= todayStart) {
            accumulator.todaySales += order.total;
          }

          if (createdAt >= monthStart) {
            accumulator.monthSales += order.total;
          }

          const dayKey = createdAt.toISOString().slice(0, 10);
          accumulator.dailySales.set(dayKey, (accumulator.dailySales.get(dayKey) ?? 0) + order.total);
        }

        accumulator.totalItems += order.items.reduce((sum, item) => sum + item.quantity, 0);
        accumulator.statusCounts[order.status] += 1;

        for (const item of order.items) {
          const current = accumulator.productSales.get(item.productName) ?? { quantity: 0, revenue: 0 };
          current.quantity += item.quantity;
          current.revenue += item.unitPrice * item.quantity;
          accumulator.productSales.set(item.productName, current);
        }

        return accumulator;
      },
      {
        totalSales: 0,
        todaySales: 0,
        monthSales: 0,
        totalItems: 0,
        statusCounts: {
          PENDENTE: 0,
          EM_PREPARO: 0,
          PRONTO: 0,
          ENTREGUE: 0
        } as Record<OrderStatus, number>,
        dailySales: new Map<string, number>(),
        productSales: new Map<string, { quantity: number; revenue: number }>()
      }
    );

    const movementSummary = reportMovements.reduce(
      (accumulator, movement) => {
        const launchedAt = normalizeDate(movement.launchedAt);

        if (movement.movementType === 'ENTRADA') {
          accumulator.totalIncome += movement.amount;
        } else {
          accumulator.totalExpense += movement.amount;
        }

        if (launchedAt) {
          if (launchedAt >= todayStart) {
            if (movement.movementType === 'ENTRADA') {
              accumulator.todayIncome += movement.amount;
            } else {
              accumulator.todayExpense += movement.amount;
            }
          }

          if (launchedAt >= monthStart) {
            if (movement.movementType === 'ENTRADA') {
              accumulator.monthIncome += movement.amount;
            } else {
              accumulator.monthExpense += movement.amount;
            }
          }

          const dayKey = launchedAt.toISOString().slice(0, 10);
          const current = accumulator.dailyMovements.get(dayKey) ?? { income: 0, expense: 0 };
          if (movement.movementType === 'ENTRADA') {
            current.income += movement.amount;
          } else {
            current.expense += movement.amount;
          }
          accumulator.dailyMovements.set(dayKey, current);
        }

        const channelName = movement.convenioName ?? movement.category;
        const currentChannel = accumulator.channels.get(channelName) ?? { income: 0, expense: 0, movements: 0 };
        currentChannel.movements += 1;
        if (movement.movementType === 'ENTRADA') {
          currentChannel.income += movement.amount;
        } else {
          currentChannel.expense += movement.amount;
        }
        accumulator.channels.set(channelName, currentChannel);

        return accumulator;
      },
      {
        totalIncome: 0,
        totalExpense: 0,
        todayIncome: 0,
        todayExpense: 0,
        monthIncome: 0,
        monthExpense: 0,
        dailyMovements: new Map<string, { income: number; expense: number }>(),
        channels: new Map<string, { income: number; expense: number; movements: number }>()
      }
    );

    const averageTicket = reportOrders.length ? orderSummary.totalSales / reportOrders.length : 0;

    const recentDays = lastSevenDays.map((date) => {
      const key = date.toISOString().slice(0, 10);
      const movement = movementSummary.dailyMovements.get(key) ?? { income: 0, expense: 0 };

      return {
        label: formatDayLabel(date),
        sales: orderSummary.dailySales.get(key) ?? 0,
        income: movement.income,
        expense: movement.expense,
        isToday: key === now.toISOString().slice(0, 10)
      };
    });

    const topChannels = [...movementSummary.channels.entries()]
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => (b.income + b.expense) - (a.income + a.expense))
      .slice(0, 5);

    const topProducts = [...orderSummary.productSales.entries()]
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);

    const peakDailySalesValue = Math.max(1, ...recentDays.map((day) => day.sales));
    const peakDailyMovementValue = Math.max(1, ...recentDays.map((day) => Math.max(day.income, day.expense)));
    const peakProductValue = Math.max(1, ...topProducts.map((product) => product.revenue));
    const channelPeak = Math.max(1, ...topChannels.map((channel) => channel.income + channel.expense));

    return {
      totalSales: orderSummary.totalSales,
      todaySales: orderSummary.todaySales,
      monthSales: orderSummary.monthSales,
      averageTicket,
      totalItems: orderSummary.totalItems,
      statusCounts: orderSummary.statusCounts,
      recentDays,
      topProducts,
      topChannels,
      peakDailySalesValue,
      peakDailyMovementValue,
      peakProductValue,
      channelPeak,
      movementSummary,
      deliveredRate: reportOrders.length ? orderSummary.statusCounts.ENTREGUE / reportOrders.length : 0,
      todayBalance: movementSummary.todayIncome - movementSummary.todayExpense,
      monthBalance: movementSummary.monthIncome - movementSummary.monthExpense,
      reportOrders,
      reportMovements,
      periodLabel:
        periodStart || periodEnd
          ? `${periodStart ? periodStart.toLocaleDateString('pt-BR') : 'início'} até ${periodEnd ? periodEnd.toLocaleDateString('pt-BR') : 'agora'}`
          : 'período atual'
    };
  }, [cashMovements, orders, periodEnd, periodStart]);

  const statusCards = (Object.keys(dashboard.statusCounts) as OrderStatus[]).map((status) => ({
    status,
    label: statusLabels[status],
    value: dashboard.statusCounts[status]
  }));

  const activeConvenios = convenios.filter((convenio) => convenio.active);
  const movementCategoryOptions = movementType === 'ENTRADA' ? incomeCategories : expenseCategories;

  const sortedMovements = useMemo(
    () =>
      [...cashMovements].sort((left, right) => {
        const rightTime = normalizeDate(right.launchedAt)?.getTime() ?? 0;
        const leftTime = normalizeDate(left.launchedAt)?.getTime() ?? 0;
        return rightTime - leftTime;
      }),
    [cashMovements]
  );

  const onSync = async () => {
    const result = await ordersContainer.syncOrders.execute();
    await reloadOrders();
    setSyncMessage(
      `Sincronização concluída: ${result.mergedCount} pedidos, ${result.resolvedConflicts} conflitos resolvidos.`
    );
  };

  const onCreateMovement = async (event: FormEvent) => {
    event.preventDefault();

    const amount = Number(movementAmount.replace(',', '.'));
    if (!Number.isFinite(amount) || amount <= 0) {
      setMovementError('Informe um valor válido para o lançamento.');
      return;
    }

    const relatedConvenio = activeConvenios.find((convenio) => convenio.id === movementConvenioId);
    const categoryLabel = relatedConvenio ? relatedConvenio.paymentMethod : movementCategory;

    await createCashMovement({
      movementCode: `${movementType === 'ENTRADA' ? 'E' : 'S'}-${Date.now().toString().slice(-6)}`,
      movementType,
      category: categoryLabel,
      amount,
      description: movementDescription.trim() || relatedConvenio?.name || categoryLabel,
      launchedAt: parseDateTimeInput(movementLaunchedAt),
      convenioId: relatedConvenio?.id,
      convenioName: relatedConvenio?.name,
      paymentMethod: relatedConvenio?.paymentMethod
    });

    await reloadCashMovements();
    setMovementAmount('');
    setMovementDescription('');
    setMovementConvenioId('');
    setMovementCategory(movementType === 'ENTRADA' ? 'PIX' : 'TROCO');
    setMovementLaunchedAt(formatDateTimeInput(new Date()));
    setMovementError(null);
  };

  const onDeleteMovement = async (movementId: string) => {
    await financeContainer.cashMovementRepository.delete(movementId);
    await reloadCashMovements();
  };

  const applyPeriodFilter = () => {
    setPeriodStart(periodStartInput ? startOfDay(new Date(periodStartInput)) : null);
    setPeriodEnd(periodEndInput ? new Date(`${periodEndInput}T23:59:59`) : null);
  };

  const clearPeriodFilter = () => {
    setPeriodStartInput('');
    setPeriodEndInput('');
    setPeriodStart(null);
    setPeriodEnd(null);
  };

  const exportClosingCsv = (kind: 'diario' | 'mensal') => {
    const now = new Date();
    const start = kind === 'diario' ? startOfDay(now) : startOfMonth(now);
    const end = kind === 'diario' ? now : now;
    const closingOrders: Order[] = orders.filter((order) => isWithinPeriod(order.createdAt, start, end));
    const closingMovements: CashMovement[] = cashMovements.filter((movement) => isWithinPeriod(movement.launchedAt, start, end));
    const filename = `fechamento-${kind}-${now.toISOString().slice(0, 10)}.csv`;

    const rows: string[][] = [
      ['tipo', 'data', 'código', 'descrição', 'categoria', 'valor', 'convênio', 'meio_pagamento', 'status_pedido'],
      ...closingOrders.map((order) => [
        'PEDIDO',
        normalizeDate(order.createdAt)?.toLocaleString('pt-BR') ?? '--',
        order.id,
        `Pedido ${order.table}`,
        'VENDA',
        order.total.toFixed(2),
        '',
        '',
        order.status
      ]),
      ...closingMovements.map((movement) => [
        'MOVIMENTO',
        normalizeDate(movement.launchedAt)?.toLocaleString('pt-BR') ?? '--',
        movement.movementCode,
        movement.description,
        movement.category,
        movement.movementType === 'ENTRADA' ? movement.amount.toFixed(2) : `-${movement.amount.toFixed(2)}`,
        movement.convenioName ?? '',
        movement.paymentMethod ?? '',
        movement.movementType
      ])
    ];

    triggerCsvDownload(filename, createCsvContent(rows));
  };

  const exportFilteredCsv = () => {
    const filename = `fechamento-filtrado-${new Date().toISOString().slice(0, 10)}.csv`;
    const rows: string[][] = [
      ['tipo', 'data', 'código', 'descrição', 'categoria', 'valor', 'convênio', 'meio_pagamento', 'status_pedido'],
      ...dashboard.reportOrders.map((order) => [
        'PEDIDO',
        normalizeDate(order.createdAt)?.toLocaleString('pt-BR') ?? '--',
        order.id,
        `Pedido ${order.table}`,
        'VENDA',
        order.total.toFixed(2),
        '',
        '',
        order.status
      ]),
      ...dashboard.reportMovements.map((movement) => [
        'MOVIMENTO',
        normalizeDate(movement.launchedAt)?.toLocaleString('pt-BR') ?? '--',
        movement.movementCode,
        movement.description,
        movement.category,
        movement.movementType === 'ENTRADA' ? movement.amount.toFixed(2) : `-${movement.amount.toFixed(2)}`,
        movement.convenioName ?? '',
        movement.paymentMethod ?? '',
        movement.movementType
      ])
    ];

    triggerCsvDownload(filename, createCsvContent(rows));
  };

  return (
    <section className="dashboard-page">
      <header className="card dashboard-hero">
        <div>
          <p className="products-eyebrow">Operação em tempo real</p>
          <h2>Dashboard</h2>
          <p className="products-subtitle">Leitura visual do fluxo de pedidos, caixa, convênios e saldo diario/mensal.</p>
        </div>
        <div className="dashboard-hero-actions">
          <button type="button" onClick={onSync}>Sincronizar pedidos</button>
          <span className="dashboard-hero-pill">{orders.length} pedidos monitorados</span>
        </div>
      </header>

      <section className="dashboard-kpis">
        <article className="card dashboard-kpi-card dashboard-kpi-card-accent">
          <span>Vendas do dia</span>
          <strong>{currencyFormatter.format(dashboard.todaySales)}</strong>
          <small>Total dos pedidos criados hoje</small>
        </article>
        <article className="card dashboard-kpi-card">
          <span>Saldo do dia</span>
          <strong>{currencyFormatter.format(dashboard.todayBalance)}</strong>
          <small>Entradas menos saídas registradas</small>
        </article>
        <article className="card dashboard-kpi-card">
          <span>Vendas do mes</span>
          <strong>{currencyFormatter.format(dashboard.monthSales)}</strong>
          <small>Volume acumulado no mês</small>
        </article>
        <article className="card dashboard-kpi-card">
          <span>Saldo do mes</span>
          <strong>{currencyFormatter.format(dashboard.monthBalance)}</strong>
          <small>Movimentacao financeira acumulada</small>
        </article>
      </section>

      <section className="card dashboard-panel dashboard-period-card">
        <div className="dashboard-panel-header">
          <div>
            <p className="products-eyebrow">Período</p>
            <h3>Filtrar fechamento</h3>
          </div>
          <span>{dashboard.periodLabel}</span>
        </div>

        <div className="dashboard-period-form">
          <div>
            <label htmlFor="period-start">Data inicial</label>
            <input
              id="period-start"
              type="date"
              value={periodStartInput}
              onChange={(event) => setPeriodStartInput(event.target.value)}
            />
          </div>
          <div>
            <label htmlFor="period-end">Data final</label>
            <input
              id="period-end"
              type="date"
              value={periodEndInput}
              onChange={(event) => setPeriodEndInput(event.target.value)}
            />
          </div>
          <div className="dashboard-period-actions">
            <button type="button" onClick={applyPeriodFilter}>Aplicar filtro</button>
            <button type="button" className="button-muted" onClick={clearPeriodFilter}>Limpar</button>
            <button type="button" onClick={exportFilteredCsv}>Exportar CSV filtrado</button>
          </div>
          <div className="dashboard-period-actions dashboard-period-actions-wide">
            <button type="button" onClick={() => exportClosingCsv('diario')}>Exportar fechamento diário</button>
            <button type="button" onClick={() => exportClosingCsv('mensal')}>Exportar fechamento mensal</button>
          </div>
        </div>
      </section>

      <section className="dashboard-grid">
        <article className="card dashboard-panel dashboard-panel-wide">
          <div className="dashboard-panel-header">
            <div>
              <p className="products-eyebrow">Caixa</p>
              <h3>Lançar entrada ou saída</h3>
            </div>
            <span>Use convênios para classificar as entradas e as saídas do fechamento.</span>
          </div>

          <form className="dashboard-finance-form" onSubmit={onCreateMovement}>
            <div>
              <label htmlFor="movement-type">Tipo</label>
              <select
                id="movement-type"
                value={movementType}
                onChange={(event) => {
                  const nextType = event.target.value as 'ENTRADA' | 'SAIDA';
                  setMovementType(nextType);
                  setMovementCategory(nextType === 'ENTRADA' ? 'PIX' : 'TROCO');
                  setMovementConvenioId('');
                }}
              >
                <option value="ENTRADA">Entrada</option>
                <option value="SAIDA">Saída</option>
              </select>
            </div>

            <div>
              <label htmlFor="movement-category">Categoria</label>
              <select
                id="movement-category"
                value={movementCategory}
                onChange={(event) => setMovementCategory(event.target.value)}
              >
                {movementCategoryOptions.map((option) => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="movement-amount">Valor</label>
              <input
                id="movement-amount"
                inputMode="decimal"
                value={movementAmount}
                onChange={(event) => setMovementAmount(event.target.value)}
                placeholder="0,00"
              />
            </div>

            <div>
              <label htmlFor="movement-convenio">Convênio</label>
              <select
                id="movement-convenio"
                value={movementConvenioId}
                onChange={(event) => {
                  const convenio = activeConvenios.find((item) => item.id === event.target.value);
                  setMovementConvenioId(event.target.value);
                  if (convenio) {
                    setMovementCategory(convenio.paymentMethod);
                    setMovementDescription(convenio.name);
                  }
                }}
              >
                <option value="">Sem convênio</option>
                {activeConvenios.map((convenio) => (
                  <option key={convenio.id} value={convenio.id}>
                    {convenio.name} ({convenio.paymentMethod})
                  </option>
                ))}
              </select>
            </div>

            <div className="dashboard-finance-span-2">
              <label htmlFor="movement-description">Descrição</label>
              <input
                id="movement-description"
                value={movementDescription}
                onChange={(event) => setMovementDescription(event.target.value)}
                placeholder="Ex.: PIX Banco Z, retirada de troco, gasto com insumos"
              />
            </div>

            <div>
              <label htmlFor="movement-launched-at">Data e hora</label>
              <input
                id="movement-launched-at"
                type="datetime-local"
                value={movementLaunchedAt}
                onChange={(event) => setMovementLaunchedAt(event.target.value)}
              />
            </div>

            <div className="dashboard-finance-actions">
              <button type="submit" disabled={savingCashMovement}>Salvar lançamento</button>
              <span>{savingCashMovement ? 'Gravando movimentação...' : 'Lançamentos diários e mensais ficam persistidos localmente.'}</span>
            </div>

            {movementError && <p className="products-form-warning">{movementError}</p>}
          </form>
        </article>

        <article className="card dashboard-panel dashboard-panel-wide">
          <div className="dashboard-panel-header">
            <div>
              <p className="products-eyebrow">Status</p>
              <h3>Fluxo por etapa</h3>
            </div>
            <span>Distribuicao atual da fila</span>
          </div>

          <div className="dashboard-status-bars">
            {statusCards.map((item) => {
              const total = Math.max(1, orders.length);
              const percentage = (item.value / total) * 100;

              return (
                <div key={item.status} className="dashboard-status-row">
                  <div className="dashboard-status-row-labels">
                    <strong>{item.label}</strong>
                    <span>{item.value} pedidos</span>
                  </div>
                  <div className="dashboard-status-track">
                    <div className={`dashboard-status-fill dashboard-status-${item.status.toLowerCase()}`} style={{ width: `${percentage}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </article>

        <article className="card dashboard-panel">
          <div className="dashboard-panel-header">
            <div>
              <p className="products-eyebrow">Tendencia</p>
              <h3>Vendas e caixa dos últimos 7 dias</h3>
            </div>
            <span>{currencyFormatter.format(dashboard.peakDailySalesValue)} no pico de vendas</span>
          </div>

          <div className="dashboard-bars-chart">
            {dashboard.recentDays.map((day) => {
              const salesHeight = Math.max(10, (day.sales / dashboard.peakDailySalesValue) * 100);
              const incomeHeight = Math.max(10, (day.income / dashboard.peakDailyMovementValue) * 100);
              const expenseHeight = Math.max(10, (day.expense / dashboard.peakDailyMovementValue) * 100);

              return (
                <div key={day.label} className="dashboard-bar-item">
                  <div className="dashboard-bar-value">{currencyFormatter.format(day.sales)}</div>
                  <div className="dashboard-stack-track">
                    <div className="dashboard-stack-column">
                      <div className="dashboard-stack-fill dashboard-stack-income" style={{ height: `${incomeHeight}%` }} />
                      <div className="dashboard-stack-fill dashboard-stack-expense" style={{ height: `${expenseHeight}%` }} />
                    </div>
                    <div className="dashboard-stack-sales" style={{ height: `${salesHeight}%` }} />
                  </div>
                  <span>{day.label}{day.isToday ? ' • hoje' : ''}</span>
                </div>
              );
            })}
          </div>
        </article>

        <article className="card dashboard-panel">
          <div className="dashboard-panel-header">
            <div>
              <p className="products-eyebrow">Convênios</p>
              <h3>Top canais e meios</h3>
            </div>
            <span>Entradas e saídas por origem</span>
          </div>

          {dashboard.topChannels.length === 0 ? (
            <p className="empty-state">Nenhuma movimentação financeira registrada.</p>
          ) : (
            <div className="dashboard-channel-list">
              {dashboard.topChannels.map((channel) => {
                const total = channel.income + channel.expense;
                const width = Math.max(8, (total / dashboard.channelPeak) * 100);

                return (
                  <div key={channel.name} className="dashboard-channel-row">
                    <div className="dashboard-channel-meta">
                      <strong>{channel.name}</strong>
                      <span>
                        {currencyFormatter.format(channel.income)} entrada | {currencyFormatter.format(channel.expense)} saída
                      </span>
                    </div>
                    <div className="dashboard-channel-track">
                      <div className="dashboard-channel-fill" style={{ width: `${width}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </article>

        <article className="card dashboard-panel dashboard-panel-wide">
          <div className="dashboard-panel-header">
            <div>
              <p className="products-eyebrow">Caixa</p>
              <h3>Resumo diário e mensal</h3>
            </div>
            <span>Fechamento operacional do período</span>
          </div>

          <div className="dashboard-finance-summary-grid">
            <div>
              <span>Entradas do dia</span>
              <strong>{currencyFormatter.format(dashboard.movementSummary.todayIncome)}</strong>
            </div>
            <div>
              <span>Saídas do dia</span>
              <strong>{currencyFormatter.format(dashboard.movementSummary.todayExpense)}</strong>
            </div>
            <div>
              <span>Entradas do mês</span>
              <strong>{currencyFormatter.format(dashboard.movementSummary.monthIncome)}</strong>
            </div>
            <div>
              <span>Saídas do mês</span>
              <strong>{currencyFormatter.format(dashboard.movementSummary.monthExpense)}</strong>
            </div>
          </div>
        </article>

        <article className="card dashboard-panel dashboard-panel-wide">
          <div className="dashboard-panel-header">
            <div>
              <p className="products-eyebrow">Movimentos</p>
              <h3>Últimos lançamentos</h3>
            </div>
            <span>{cashMovements.length} registros no livro-caixa</span>
          </div>

          {cashMovements.length === 0 ? (
            <p className="empty-state">Nenhum lançamento financeiro registrado ainda.</p>
          ) : (
            <ul className="dashboard-movement-list">
              {sortedMovements.slice(0, 8).map((movement) => (
                <li key={movement.id}>
                  <div>
                    <strong>
                      <span className="products-id-tag">{movement.movementCode}</span> {movement.description}
                    </strong>
                    <span>
                      {movementTypeLabels[movement.movementType]} | {movement.category} | {movement.convenioName ?? 'Sem convênio'}
                    </span>
                    <span>{normalizeDate(movement.launchedAt)?.toLocaleString('pt-BR') ?? '--'}</span>
                  </div>
                  <div>
                    <strong>{currencyFormatter.format(movement.amount)}</strong>
                    <button type="button" className="products-delete-button" onClick={() => void onDeleteMovement(movement.id)}>
                      Excluir
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </article>

        <article className="card dashboard-panel dashboard-panel-wide">
          <div className="dashboard-panel-header">
            <div>
              <p className="products-eyebrow">Mix</p>
              <h3>Produtos mais fortes do caixa</h3>
            </div>
            <span>Top 5 por faturamento</span>
          </div>

          {dashboard.topProducts.length === 0 ? (
            <p className="empty-state">Nenhum item vendido ainda.</p>
          ) : (
            <div className="dashboard-product-list">
              {dashboard.topProducts.map((product, index) => {
                const width = Math.max(8, (product.revenue / dashboard.peakProductValue) * 100);

                return (
                  <div key={product.name} className="dashboard-product-row">
                    <div className="dashboard-product-meta">
                      <strong>
                        <span className="products-id-tag">#{index + 1}</span> {product.name}
                      </strong>
                      <span>
                        {product.quantity} unidades | {currencyFormatter.format(product.revenue)}
                      </span>
                    </div>
                    <div className="dashboard-product-track">
                      <div className="dashboard-product-fill" style={{ width: `${width}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </article>
      </section>

      <section className="card dashboard-sync-card">
        <div>
          <p className="products-eyebrow">Sincronização</p>
          <h3>Último status</h3>
          {syncMessage ? <p>{syncMessage}</p> : <p>Execute a sincronização para atualizar os dados locais.</p>}
        </div>
      </section>
    </section>
  );
}
