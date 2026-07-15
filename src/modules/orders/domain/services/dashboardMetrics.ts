import type { CashMovement } from '@/modules/finance/domain/entities/CashMovement';
import type { Order } from '@/modules/orders/domain/entities/Order';
import type { Product } from '@/modules/products/domain/entities/Product';

export type DashboardPeriod = {
  start: Date;
  end: Date;
  label: string;
};

export type DashboardPaymentSlice = {
  name: string;
  amount: number;
  percentage: number;
};

export type DashboardHourlySale = {
  hour: number;
  amount: number;
  label: string;
  isPeak: boolean;
};

export type DashboardTopProduct = {
  productId: string;
  name: string;
  category: string;
  quantity: number;
  unit: 'KG' | 'UN';
  total: number;
};

export type DashboardMetrics = {
  revenueToday: number;
  salesCount: number;
  averageTicket: number;
  openComandas: number;
  lowStockCount: number;
  movementLevel: 'BAIXO' | 'MEDIO' | 'ALTO';
  movementLabel: string;
  paymentMethods: DashboardPaymentSlice[];
  hourlySales: DashboardHourlySale[];
  topProducts: DashboardTopProduct[];
  activeSales: Order[];
  recentIncome: number;
  recentExpense: number;
};

const SAO_PAULO_TIME_ZONE = 'America/Sao_Paulo';
const DAY_FORMATTER = new Intl.DateTimeFormat('en-CA', {
  timeZone: SAO_PAULO_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit'
});

const HOUR_FORMATTER = new Intl.DateTimeFormat('pt-BR', {
  timeZone: SAO_PAULO_TIME_ZONE,
  hour: '2-digit',
  hour12: false
});

const parseSaoPauloDayKey = (date: Date) => DAY_FORMATTER.format(date);

const parseSaoPauloHour = (date: Date) => {
  const value = HOUR_FORMATTER.format(date).replace(/\D/g, '');
  return Number.parseInt(value, 10);
};

const normalizeDate = (value: Date | string | undefined) => {
  if (!value) {
    return null;
  }

  const parsed = value instanceof Date ? value : new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const isWithinPeriod = (value: Date | string | undefined, period: DashboardPeriod) => {
  const parsed = normalizeDate(value);
  return Boolean(parsed && parsed >= period.start && parsed <= period.end);
};

const isCanceledOrder = (order: Order) => {
  const searchable = `${order.id} ${order.table} ${order.status}`.toUpperCase();
  return searchable.includes('CANCEL');
};

const getOrderItemQuantity = (item: Order['items'][number]) => {
  if (item.byWeight) {
    return item.weight && item.weight > 0 ? item.weight : item.quantity;
  }

  return item.quantity;
};

const getOrderItemTotal = (item: Order['items'][number]) => item.unitPrice * getOrderItemQuantity(item);

export const createTodayPeriod = (now = new Date()): DashboardPeriod => {
  const dayKey = parseSaoPauloDayKey(now);
  return {
    start: new Date(`${dayKey}T00:00:00-03:00`),
    end: new Date(`${dayKey}T23:59:59.999-03:00`),
    label: 'Hoje'
  };
};

export const createCustomPeriod = (startInput: string, endInput: string, now = new Date()): DashboardPeriod => {
  const fallback = createTodayPeriod(now);
  const start = startInput ? new Date(`${startInput}T00:00:00-03:00`) : fallback.start;
  const end = endInput ? new Date(`${endInput}T23:59:59.999-03:00`) : fallback.end;

  return {
    start: Number.isNaN(start.getTime()) ? fallback.start : start,
    end: Number.isNaN(end.getTime()) ? fallback.end : end,
    label: startInput || endInput ? 'Período filtrado' : fallback.label
  };
};

export const buildDashboardMetrics = ({
  orders,
  cashMovements,
  products,
  period,
  openComandas
}: {
  orders: Order[];
  cashMovements: CashMovement[];
  products: Product[];
  period: DashboardPeriod;
  openComandas: number;
}): DashboardMetrics => {
  const activeSales = orders.filter((order) => !isCanceledOrder(order) && isWithinPeriod(order.createdAt, period));
  const periodMovements = cashMovements.filter((movement) => isWithinPeriod(movement.launchedAt, period));
  const revenueToday = activeSales.reduce((sum, order) => sum + order.total, 0);
  const salesCount = activeSales.length;
  const averageTicket = salesCount > 0 ? revenueToday / salesCount : 0;
  const lowStockCount = products.filter((product) => product.stock > 0 && product.stock <= 3).length;

  const hourlyMap = new Map<number, number>();
  for (let hour = 6; hour <= 22; hour += 1) {
    hourlyMap.set(hour, 0);
  }

  for (const sale of activeSales) {
    const createdAt = normalizeDate(sale.createdAt);
    if (!createdAt) {
      continue;
    }

    const hour = parseSaoPauloHour(createdAt);
    if (hourlyMap.has(hour)) {
      hourlyMap.set(hour, (hourlyMap.get(hour) ?? 0) + sale.total);
    }
  }

  const peakHourlyAmount = Math.max(0, ...hourlyMap.values());
  const hourlySales = [...hourlyMap.entries()].map(([hour, amount]) => ({
    hour,
    amount,
    label: `${String(hour).padStart(2, '0')}h`,
    isPeak: amount > 0 && amount === peakHourlyAmount
  }));

  const paymentMap = new Map<string, number>();
  let recentIncome = 0;
  let recentExpense = 0;
  for (const movement of periodMovements) {
    const key = movement.paymentMethod || movement.category || movement.convenioName || 'Sem meio';
    if (movement.movementType === 'ENTRADA') {
      paymentMap.set(key, (paymentMap.get(key) ?? 0) + movement.amount);
      recentIncome += movement.amount;
    } else {
      recentExpense += movement.amount;
    }
  }

  if (paymentMap.size === 0 && revenueToday > 0) {
    paymentMap.set('Não informado', revenueToday);
  }

  const paymentTotal = [...paymentMap.values()].reduce((sum, amount) => sum + amount, 0);
  const paymentMethods = [...paymentMap.entries()]
    .map(([name, amount]) => ({
      name,
      amount,
      percentage: paymentTotal > 0 ? (amount / paymentTotal) * 100 : 0
    }))
    .sort((left, right) => right.amount - left.amount)
    .slice(0, 5);

  const productMap = new Map<string, DashboardTopProduct>();
  const productCategoryById = new Map(products.map((product) => [product.id, product.category]));

  for (const sale of activeSales) {
    for (const item of sale.items) {
      const unit = item.byWeight ? 'KG' : 'UN';
      const quantity = getOrderItemQuantity(item);
      const key = `${item.productId}-${unit}`;
      const current = productMap.get(key) ?? {
        productId: item.productId,
        name: item.productName,
        category: productCategoryById.get(item.productId) ?? 'Sem categoria',
        quantity: 0,
        unit,
        total: 0
      };
      current.quantity += quantity;
      current.total += getOrderItemTotal(item);
      productMap.set(key, current);
    }
  }

  const topProducts = [...productMap.values()].sort((left, right) => right.total - left.total).slice(0, 6);
  const movementLevel = salesCount >= 12 ? 'ALTO' : salesCount >= 4 ? 'MEDIO' : 'BAIXO';
  const movementLabel =
    movementLevel === 'ALTO'
      ? 'Fluxo de clientes elevado'
      : movementLevel === 'MEDIO'
        ? 'Fluxo moderado'
        : 'Fluxo baixo ou início do turno';

  return {
    revenueToday,
    salesCount,
    averageTicket,
    openComandas,
    lowStockCount,
    movementLevel,
    movementLabel,
    paymentMethods,
    hourlySales,
    topProducts,
    activeSales,
    recentIncome,
    recentExpense
  };
};
