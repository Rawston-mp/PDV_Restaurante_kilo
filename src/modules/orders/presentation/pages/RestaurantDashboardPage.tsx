import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import {
  AlertTriangle,
  Banknote,
  BarChart3,
  CalendarDays,
  CircleDollarSign,
  ClipboardList,
  CreditCard,
  Gauge,
  RefreshCw,
  ShoppingCart,
  UsersRound
} from 'lucide-react';

import { useAuth } from '@/modules/auth/presentation/providers/AuthProvider';
import type { CashMovement } from '@/modules/finance/domain/entities/CashMovement';
import {
  cashMovementCategoriesStorageKey,
  cashMovementCategoriesUpdatedEvent,
  readCashMovementCategoryCatalog,
  type CashMovementCategoryCatalog
} from '@/modules/finance/infrastructure/local/cashMovementCategories';
import { financeContainer } from '@/modules/finance/infrastructure/container/financeContainer';
import { useCashMovementsQuery } from '@/modules/finance/presentation/hooks/useCashMovementsQuery';
import { useCreateCashMovement } from '@/modules/finance/presentation/hooks/useCreateCashMovement';
import { ordersContainer } from '@/modules/orders/infrastructure/container/ordersContainer';
import { useOrdersQuery } from '@/modules/orders/presentation/hooks/useOrdersQuery';
import { useProductsQuery } from '@/modules/products/presentation/hooks/useProductsQuery';
import { useConveniosQuery } from '@/modules/convenios/presentation/hooks/useConveniosQuery';
import { WelcomeHero } from '@/modules/home/presentation/components/WelcomeHero';
import {
  buildDashboardMetrics,
  createCustomPeriod,
  createTodayPeriod,
  type DashboardMetrics
} from '@/modules/orders/domain/services/dashboardMetrics';
import {
  formatCurrencyInput,
  normalizeCurrencyInputChange,
  parseCurrencyInput
} from '@/shared/domain/services/currencyInput';

const currencyFormatter = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL'
});

const dateFormatter = new Intl.DateTimeFormat('pt-BR', {
  timeZone: 'America/Sao_Paulo',
  day: '2-digit',
  month: 'long',
  year: 'numeric'
});

const movementTypeLabels = {
  ENTRADA: 'Entrada',
  SAIDA: 'Saída'
} as const;

const formatDateTimeInput = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day}T${hours}:${minutes}`;
};

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
  const next = startOfDay(date);
  next.setDate(1);
  return next;
};

const isWithinPeriod = (date: Date | string | undefined, start: Date, end: Date) => {
  const parsed = normalizeDate(date);
  return Boolean(parsed && parsed >= start && parsed <= end);
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

function parseDateTimeInput(value: string) {
  if (!value) {
    return new Date();
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
}

function MetricCard({
  icon,
  label,
  value,
  helper,
  tone = 'default'
}: {
  icon: ReactNode;
  label: string;
  value: string;
  helper: string;
  tone?: 'default' | 'accent';
}) {
  return (
    <article className={`restaurant-dashboard-metric ${tone === 'accent' ? 'is-accent' : ''}`}>
      <div className="restaurant-dashboard-metric-icon" aria-hidden="true">
        {icon}
      </div>
      <div>
        <span>{label}</span>
        <strong>{value}</strong>
        <small>{helper}</small>
      </div>
    </article>
  );
}

function DashboardEmptyState({ children }: { children: React.ReactNode }) {
  return <p className="restaurant-dashboard-empty">{children}</p>;
}

function PaymentDonut({ metrics }: { metrics: DashboardMetrics }) {
  const colors = ['#7c3aed', '#2563eb', '#f97316', '#22c55e', '#64748b'];
  const hasPayments = metrics.paymentMethods.length > 0;
  let currentOffset = 0;
  const gradient = metrics.paymentMethods
    .map((slice, index) => {
      const start = currentOffset;
      currentOffset += slice.percentage;
      return `${colors[index % colors.length]} ${start}% ${currentOffset}%`;
    })
    .join(', ');

  return (
    <div className="restaurant-dashboard-payment">
      <div
        className="restaurant-dashboard-donut"
        style={{ background: hasPayments ? `conic-gradient(${gradient})` : undefined }}
        aria-hidden="true"
      >
        <span />
      </div>
      <div className="restaurant-dashboard-payment-list">
        {hasPayments ? (
          metrics.paymentMethods.map((slice, index) => (
            <div key={slice.name}>
              <i style={{ backgroundColor: colors[index % colors.length] }} />
              <span>{slice.name}</span>
              <strong>{slice.percentage.toFixed(0)}%</strong>
            </div>
          ))
        ) : (
          <DashboardEmptyState>Nenhum pagamento registrado no período.</DashboardEmptyState>
        )}
      </div>
    </div>
  );
}

export function RestaurantDashboardPage() {
  const { user } = useAuth();
  const { orders, reload: reloadOrders, closedSalesCount, closedBudgetsCount } = useOrdersQuery();
  const { cashMovements, reload: reloadCashMovements } = useCashMovementsQuery();
  const { products } = useProductsQuery();
  const { convenios } = useConveniosQuery();
  const { createCashMovement, saving: savingCashMovement } = useCreateCashMovement();
  const [periodStartInput, setPeriodStartInput] = useState('');
  const [periodEndInput, setPeriodEndInput] = useState('');
  const [movementType, setMovementType] = useState<'ENTRADA' | 'SAIDA'>('ENTRADA');
  const [movementCategory, setMovementCategory] = useState('PIX');
  const [movementCategoryCatalog, setMovementCategoryCatalog] = useState<CashMovementCategoryCatalog>(() =>
    readCashMovementCategoryCatalog()
  );
  const [movementAmount, setMovementAmount] = useState('');
  const [movementDescription, setMovementDescription] = useState('');
  const [movementConvenioId, setMovementConvenioId] = useState('');
  const [movementLaunchedAt, setMovementLaunchedAt] = useState(formatDateTimeInput(new Date()));
  const [movementError, setMovementError] = useState<string | null>(null);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);

  const period = useMemo(
    () => (periodStartInput || periodEndInput
      ? createCustomPeriod(periodStartInput, periodEndInput)
      : createTodayPeriod()),
    [periodEndInput, periodStartInput]
  );

  const dashboard = useMemo(
    () =>
      buildDashboardMetrics({
        orders,
        cashMovements,
        products,
        period,
        openComandas: Math.max(0, orders.filter((order) => order.status !== 'ENTREGUE').length)
      }),
    [cashMovements, orders, period, products]
  );

  const movementCategoryOptions = movementCategoryCatalog[movementType];
  const activeConvenios = convenios.filter((convenio) => convenio.active);
  const maxHourlyAmount = Math.max(1, ...dashboard.hourlySales.map((hour) => hour.amount));
  const maxProductTotal = Math.max(1, ...dashboard.topProducts.map((product) => product.total));
  const today = new Date();
  const monthStart = startOfMonth(today);
  const todayStart = startOfDay(today);
  const currentMonthSales = orders.filter((order) => isWithinPeriod(order.createdAt, monthStart, today));
  const currentMonthRevenue = currentMonthSales.reduce((sum, order) => sum + order.total, 0);
  const todayMovements = cashMovements.filter((movement) => isWithinPeriod(movement.launchedAt, todayStart, today));
  const currentShiftOpenedAt = todayMovements.length > 0
    ? [...todayMovements].sort((left, right) => {
        const leftTime = normalizeDate(left.launchedAt)?.getTime() ?? 0;
        const rightTime = normalizeDate(right.launchedAt)?.getTime() ?? 0;
        return leftTime - rightTime;
      })[0].launchedAt
    : todayStart;
  const monthLabel = currencyFormatter.format(currentMonthRevenue);

  useEffect(() => {
    const syncCategoryCatalog = () => setMovementCategoryCatalog(readCashMovementCategoryCatalog());
    const reloadDashboardData = () => {
      void Promise.all([reloadOrders(), reloadCashMovements()]);
    };
    const onStorage = (event: StorageEvent) => {
      if (event.key === cashMovementCategoriesStorageKey) {
        syncCategoryCatalog();
      }
    };

    window.addEventListener(cashMovementCategoriesUpdatedEvent, syncCategoryCatalog);
    window.addEventListener('pdv.dashboard-refresh', reloadDashboardData);
    window.addEventListener('storage', onStorage);

    return () => {
      window.removeEventListener(cashMovementCategoriesUpdatedEvent, syncCategoryCatalog);
      window.removeEventListener('pdv.dashboard-refresh', reloadDashboardData);
      window.removeEventListener('storage', onStorage);
    };
  }, [reloadCashMovements, reloadOrders]);

  useEffect(() => {
    if (!movementCategoryOptions.includes(movementCategory)) {
      setMovementCategory(movementCategoryOptions[0]);
    }
  }, [movementCategory, movementCategoryOptions]);

  const onSync = async () => {
    setIsSyncing(true);
    try {
      const result = await ordersContainer.syncOrders.execute();
      await Promise.all([reloadOrders(), reloadCashMovements()]);
      setSyncMessage(
        `Sincronização concluída: ${result.mergedCount} pedidos, ${result.resolvedConflicts} conflitos resolvidos.`
      );
    } catch {
      setSyncMessage('Não foi possível sincronizar agora. Dados locais continuam disponíveis.');
    } finally {
      setIsSyncing(false);
    }
  };

  const onCreateMovement = async (event: FormEvent) => {
    event.preventDefault();

    const amount = parseCurrencyInput(movementAmount);
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
    setMovementCategory(movementCategoryCatalog[movementType][0]);
    setMovementLaunchedAt(formatDateTimeInput(new Date()));
    setMovementError(null);
  };

  const onDeleteMovement = async (movementId: string) => {
    await financeContainer.cashMovementRepository.delete(movementId);
    await reloadCashMovements();
  };

  const exportClosingCsv = (kind: 'diario' | 'mensal') => {
    const now = new Date();
    const start = kind === 'diario' ? startOfDay(now) : startOfMonth(now);
    const end = now;
    const closingOrders = orders.filter((order) => isWithinPeriod(order.createdAt, start, end));
    const closingMovements: CashMovement[] = cashMovements.filter((movement) =>
      isWithinPeriod(movement.launchedAt, start, end)
    );
    const filename = `fechamento-${kind}-${now.toISOString().slice(0, 10)}.csv`;
    const rows: string[][] = [
      ['tipo', 'data', 'codigo', 'descricao', 'categoria', 'valor', 'convenio', 'meio_pagamento', 'status_pedido'],
      ...closingOrders.map((order) => [
        'VENDA',
        normalizeDate(order.createdAt)?.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' }) ?? '--',
        order.id,
        order.table,
        'VENDA',
        order.total.toFixed(2),
        '',
        '',
        order.status
      ]),
      ...closingMovements.map((movement) => [
        'MOVIMENTO',
        normalizeDate(movement.launchedAt)?.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' }) ?? '--',
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

  const recentMovements = [...cashMovements]
    .sort((left, right) => (normalizeDate(right.launchedAt)?.getTime() ?? 0) - (normalizeDate(left.launchedAt)?.getTime() ?? 0))
    .slice(0, 5);

  return (
    <section className="restaurant-dashboard-page" aria-label="Dashboard do restaurante">
      <div className="restaurant-dashboard-welcome">
        <WelcomeHero />
      </div>

      <header className="restaurant-dashboard-header">
        <div>
          <h2>Dashboard</h2>
          <p>Visão geral do restaurante</p>
        </div>
        <div className="restaurant-dashboard-toolbar" aria-label="Filtros do dashboard">
          <label>
            <CalendarDays size={18} aria-hidden="true" />
            <span className="sr-only">Período</span>
            <input
              type="date"
              value={periodStartInput}
              onChange={(event) => setPeriodStartInput(event.target.value)}
              aria-label="Data inicial"
            />
          </label>
          <label>
            <span className="sr-only">Data final</span>
            <input
              type="date"
              value={periodEndInput}
              onChange={(event) => setPeriodEndInput(event.target.value)}
              aria-label="Data final"
            />
          </label>
          <button type="button" onClick={() => {
            setPeriodStartInput('');
            setPeriodEndInput('');
          }}>
            Hoje, {dateFormatter.format(today)}
          </button>
          <div className="restaurant-dashboard-user" title={user?.name ?? 'Operador'}>
            <span>{(user?.name ?? 'OP').slice(0, 2).toUpperCase()}</span>
            <div>
              <strong>{user?.name ?? 'Operador'}</strong>
              <small>{user?.role ?? 'Operador'}</small>
            </div>
          </div>
        </div>
      </header>

      <section className="restaurant-dashboard-metrics" aria-label="Indicadores principais">
        <MetricCard
          tone="accent"
          icon={<BarChart3 size={28} />}
          label="Faturamento hoje"
          value={currencyFormatter.format(dashboard.revenueToday)}
          helper={`${dashboard.activeSales.length} venda(s) fiscal(is) no período`}
        />
        <MetricCard
          icon={<ShoppingCart size={28} />}
          label="Vendas"
          value={String(dashboard.salesCount)}
          helper={`${closedSalesCount} fechadas · ${closedBudgetsCount} orçamento(s)`}
        />
        <MetricCard
          icon={<CircleDollarSign size={28} />}
          label="Ticket médio"
          value={currencyFormatter.format(dashboard.averageTicket)}
          helper={`Mês atual: ${monthLabel}`}
        />
        <MetricCard
          icon={<UsersRound size={28} />}
          label="Comandas abertas"
          value={String(dashboard.openComandas)}
          helper="Comandas ainda não entregues no painel local"
        />
      </section>

      {syncMessage && <p className="restaurant-dashboard-notice">{syncMessage}</p>}

      <section className="restaurant-dashboard-main-grid">
        <article className="restaurant-dashboard-card restaurant-dashboard-sales-chart">
          <div className="restaurant-dashboard-card-header">
            <div>
              <h3>Vendas por horário</h3>
              <p>Valores filtrados pelo fechamento selecionado.</p>
            </div>
            <button type="button" onClick={onSync} disabled={isSyncing}>
              <RefreshCw size={16} aria-hidden="true" />
              {isSyncing ? 'Atualizando' : 'Sincronizar'}
            </button>
          </div>

          {dashboard.activeSales.length === 0 ? (
            <DashboardEmptyState>Nenhuma venda fiscal fechada neste período.</DashboardEmptyState>
          ) : (
            <div className="restaurant-dashboard-hour-chart" aria-label="Gráfico de vendas por horário">
              {dashboard.hourlySales.map((hour) => (
                <div key={hour.hour} className="restaurant-dashboard-hour">
                  {hour.isPeak && <span className="restaurant-dashboard-peak">Pico</span>}
                  <div className="restaurant-dashboard-hour-track">
                    <i style={{ height: `${Math.max(4, (hour.amount / maxHourlyAmount) * 100)}%` }} />
                  </div>
                  <small>{hour.label}</small>
                </div>
              ))}
            </div>
          )}
        </article>

        <article className="restaurant-dashboard-card">
          <div className="restaurant-dashboard-card-header">
            <div>
              <h3>Formas de pagamento</h3>
              <p>Usa lançamentos financeiros reais; se a venda não informar meio, aparece como não informado.</p>
            </div>
          </div>
          <PaymentDonut metrics={dashboard} />
        </article>

        <aside className="restaurant-dashboard-side">
          <article className={`restaurant-dashboard-card restaurant-dashboard-movement is-${dashboard.movementLevel.toLowerCase()}`}>
            <Gauge size={34} aria-hidden="true" />
            <div>
              <h3>{dashboard.movementLevel === 'ALTO' ? 'Alto' : dashboard.movementLevel === 'MEDIO' ? 'Médio' : 'Baixo'}</h3>
              <p>{dashboard.movementLabel}</p>
            </div>
          </article>

          <article className="restaurant-dashboard-card restaurant-dashboard-alert">
            <AlertTriangle size={34} aria-hidden="true" />
            <div>
              <h3>Atenção</h3>
              <p>
                {dashboard.lowStockCount > 0
                  ? `${dashboard.lowStockCount} produto(s) com estoque baixo`
                  : 'Nenhum alerta de estoque baixo'}
              </p>
            </div>
          </article>

          <article className="restaurant-dashboard-card restaurant-dashboard-status-list">
            <div>
              <Banknote size={24} aria-hidden="true" />
              <span>Caixa</span>
              <strong>Online</strong>
            </div>
            <div>
              <Gauge size={24} aria-hidden="true" />
              <span>Balança A</span>
              <strong>Local</strong>
            </div>
            <div>
              <Gauge size={24} aria-hidden="true" />
              <span>Balança B</span>
              <strong>Local</strong>
            </div>
            <div>
              <ClipboardList size={24} aria-hidden="true" />
              <span>NFC-e</span>
              <strong>Config.</strong>
            </div>
          </article>
        </aside>

        <article className="restaurant-dashboard-card restaurant-dashboard-products">
          <div className="restaurant-dashboard-card-header">
            <div>
              <h3>Produtos mais vendidos</h3>
              <p>Produtos por faturamento; itens por peso aparecem em kg.</p>
            </div>
            <span>{period.label}</span>
          </div>

          {dashboard.topProducts.length === 0 ? (
            <DashboardEmptyState>Nenhum produto vendido no período.</DashboardEmptyState>
          ) : (
            <div className="restaurant-dashboard-table-wrap">
              <table className="restaurant-dashboard-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Produto</th>
                    <th>Categoria</th>
                    <th>Quantidade</th>
                    <th>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {dashboard.topProducts.map((product, index) => (
                    <tr key={`${product.productId}-${product.unit}`}>
                      <td>{index + 1}</td>
                      <td>
                        <strong>{product.name}</strong>
                        <div className="restaurant-dashboard-product-bar">
                          <i style={{ width: `${Math.max(8, (product.total / maxProductTotal) * 100)}%` }} />
                        </div>
                      </td>
                      <td>{product.category}</td>
                      <td>
                        {product.quantity.toLocaleString('pt-BR', {
                          minimumFractionDigits: product.unit === 'KG' ? 3 : 0,
                          maximumFractionDigits: product.unit === 'KG' ? 3 : 0
                        })}{' '}
                        {product.unit.toLowerCase()}
                      </td>
                      <td>{currencyFormatter.format(product.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </article>

        <article className="restaurant-dashboard-card restaurant-dashboard-shift">
          <div className="restaurant-dashboard-card-header">
            <div>
              <h3>Caixa e livro financeiro</h3>
              <p>Entradas e saídas manuais continuam disponíveis para fechamento.</p>
            </div>
            <span>Caixa aberto desde {normalizeDate(currentShiftOpenedAt)?.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
          </div>

          <form className="restaurant-dashboard-finance-form" onSubmit={onCreateMovement} autoComplete="off">
            <label>
              Tipo
              <select
                value={movementType}
                onChange={(event) => {
                  const nextType = event.target.value as 'ENTRADA' | 'SAIDA';
                  setMovementType(nextType);
                  setMovementCategory(movementCategoryCatalog[nextType][0]);
                  setMovementConvenioId('');
                }}
              >
                <option value="ENTRADA">Entrada</option>
                <option value="SAIDA">Saída</option>
              </select>
            </label>
            <label>
              Categoria
              <select value={movementCategory} onChange={(event) => setMovementCategory(event.target.value)}>
                {movementCategoryOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Valor
              <input
                inputMode="decimal"
                value={movementAmount}
                onChange={(event) => setMovementAmount(normalizeCurrencyInputChange(event.target.value))}
                onBlur={() => setMovementAmount(formatCurrencyInput(movementAmount))}
                placeholder="0,00"
              />
            </label>
            <label>
              Convênio
              <select
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
            </label>
            <label className="is-wide">
              Descrição
              <input
                value={movementDescription}
                onChange={(event) => setMovementDescription(event.target.value)}
                placeholder="Ex.: PIX Banco Z, retirada de troco, gasto com insumos"
              />
            </label>
            <label>
              Data e hora
              <input
                type="datetime-local"
                value={movementLaunchedAt}
                onChange={(event) => setMovementLaunchedAt(event.target.value)}
              />
            </label>
            <button type="submit" disabled={savingCashMovement}>
              {savingCashMovement ? 'Salvando...' : 'Salvar lançamento'}
            </button>
            {movementError && <p className="products-form-warning">{movementError}</p>}
          </form>

          <div className="restaurant-dashboard-shift-actions">
            <button type="button" onClick={() => exportClosingCsv('diario')}>Exportar fechamento diário</button>
            <button type="button" onClick={() => exportClosingCsv('mensal')}>Exportar fechamento mensal</button>
          </div>

          {recentMovements.length === 0 ? (
            <DashboardEmptyState>Nenhum lançamento financeiro registrado ainda.</DashboardEmptyState>
          ) : (
            <ul className="restaurant-dashboard-movement-list">
              {recentMovements.map((movement) => (
                <li key={movement.id}>
                  <div>
                    <strong>{movement.description}</strong>
                    <span>
                      {movementTypeLabels[movement.movementType]} · {movement.category} · {movement.convenioName ?? 'Sem convênio'}
                    </span>
                  </div>
                  <div>
                    <strong>{currencyFormatter.format(movement.amount)}</strong>
                    <button type="button" onClick={() => void onDeleteMovement(movement.id)}>Excluir</button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </article>
      </section>
    </section>
  );
}
