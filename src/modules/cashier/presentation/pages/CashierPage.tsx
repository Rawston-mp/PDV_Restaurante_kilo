// ─── CaixaPage — PDV Touch ────────────────────────────────────────────────────
// Layout 60/40 | Tailwind CSS | Lucide React
// Sem modais para fluxos básicos; PaymentPanel desliza sobre a zona esquerda.
// ─────────────────────────────────────────────────────────────────────────────

import '@/modules/cashier/caixa.css';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Clock3, CornerUpLeft, LockKeyhole, LogOut, Power, UserRound } from 'lucide-react';
import { AboutSystemButton } from '@/app/AboutSystemButton';
import { useAuth } from '@/modules/auth/presentation/providers/AuthProvider';
import type { Product } from '@/modules/products/domain/entities/Product';
import { useProductsQuery } from '@/modules/products/presentation/hooks/useProductsQuery';
import { productsContainer } from '@/modules/products/infrastructure/container/productsContainer';
import { type CashierCartItem } from '@/modules/cashier/presentation/components/CartItem';
import { type CashierProduct } from '@/modules/cashier/presentation/components/ProductCard';
import { SmartInput } from '@/modules/cashier/presentation/components/SmartInput';
import { CategoryTabs } from '@/modules/cashier/presentation/components/CategoryTabs';
import { ProductGrid } from '@/modules/cashier/presentation/components/ProductGrid';
import { CartPanel } from '@/modules/cashier/presentation/components/CartPanel';
import { PaymentPanel, type PaymentConfirmPayload } from '@/modules/cashier/presentation/components/PaymentPanel';
import { CashRegisterClose } from '@/modules/cashier/presentation/components/CashRegisterClose';
import { CashierVirtualKeyboard } from '@/modules/cashier/presentation/components/CashierVirtualKeyboard';
import { type PaymentDocumentMode, type PaymentEntry } from '@/modules/cashier/types';
import { buildReceiptText } from '@/fiscal/receiptService';
import { convertNonFiscalToMockNfce } from '@/fiscal/mockNfce';
import type { NonFiscalReceipt, PaymentType, ReceiptEmitter, ReceiptItem, ReceiptPayment } from '@/fiscal/types';
import { financeContainer } from '@/modules/finance/infrastructure/container/financeContainer';
import { ordersContainer } from '@/modules/orders/infrastructure/container/ordersContainer';
import { useClientsQuery } from '@/modules/clients/presentation/hooks/useClientsQuery';
import { clientsContainer } from '@/modules/clients/infrastructure/container/clientsContainer';
import type { ItemComanda } from '@/types/comanda';
import { API_BASE_URL } from '@/shared/infrastructure/api/runtimeEndpoint';
import {
  fetchComandaItemsFromBackend,
  saveComandaItemsToBackend
} from '@/shared/infrastructure/api/comandaApi';
import {
  clearComandaCache,
  isComandaLocallyCancelled,
  listLocallyCancelledComandaNumbers,
  listOpenComandaNumbers,
  markComandaLocallyCancelled,
  readCancelledComandas,
  readComandaItems,
  removeComandaCacheEntry,
  unmarkComandaLocallyCancelled,
  upsertComandaItems
} from '@/shared/infrastructure/storage/comandaCache';
import { loadDigitalCertificateSettings } from '@/shared/domain/services/digitalCertificateRules';

// ─────────────────────────────────────────────────────────────────────────────
// CashierPage — tela de caixa unificada
// ─────────────────────────────────────────────────────────────────────────────

type View = 'pos' | 'payment';
type CashCloseTab = 'MENU' | 'FECHAMENTO' | 'ADMINISTRATIVO';
type CashCloseSection = 'INICIO' | 'RECEBIMENTO_FIADO';

type HeaderComandaStatus =
  | 'ABERTA'
  | 'EM_USO_BALANCA'
  | 'PRONTA_PARA_CAIXA'
  | 'EM_FECHAMENTO'
  | 'FECHADA_ORCAMENTO'
  | 'FECHADA_VENDA'
  | 'CANCELADA'
  | 'ARQUIVADA';

type HeaderComandaRecord = {
  numero: string;
  status: HeaderComandaStatus;
  updatedAt?: string;
};

type ActiveComandaEntry = {
  numero: string;
  origem: 'BALANCA' | 'CAIXA';
  status?: HeaderComandaStatus;
};

type CashierNotice = {
  tone: 'info' | 'success' | 'warning' | 'error';
  message: string;
};

type CashierSessionState = {
  isOpen: boolean;
  sequence: number;
  expectedTotals: Record<string, number>;
  totalSales: number;
  attendanceCount: number;
  openedAt?: string;
  openedBy?: string;
  closedAt?: string;
  closedBy?: string;
};

type PendingCashierAction =
  | {
      kind: 'CANCEL_COMANDA';
      numero: string;
      title: string;
      description: string;
    }
  | {
      kind: 'CLEAR_COMANDA_CACHE';
      title: string;
      description: string;
    }
  | {
      kind: 'REMOVE_ITEM';
      itemId: string;
      itemName: string;
      title: string;
      description: string;
    };

const API_BASE = API_BASE_URL;
const CASHIER_SESSION_STORAGE_KEY = 'pdv.cashier.active-session';
const CASHIER_SESSION_CHANGED_EVENT = 'pdv.cashier.session-changed';
const NON_OPEN_COMANDA_STATUSES: HeaderComandaStatus[] = ['FECHADA_ORCAMENTO', 'FECHADA_VENDA', 'CANCELADA', 'ARQUIVADA'];
const COUNTABLE_CLOSED_COMANDA_STATUSES: HeaderComandaStatus[] = ['FECHADA_ORCAMENTO', 'FECHADA_VENDA', 'CANCELADA'];
const NOTICE_TONE_CLASSES: Record<CashierNotice['tone'], string> = {
  info: 'border-sky-200 bg-sky-50 text-sky-800',
  success: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  warning: 'border-orange-200 bg-orange-50 text-orange-800',
  error: 'border-red-200 bg-red-50 text-red-800'
};

const normalizeSearchText = (value: string) =>
  value
    .normalize('NFD')
      .replace(/[^\x00-\x7F]/g, '')
    .toLowerCase();

const escapeHtml = (value: string) =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');

const formatQuantity = (quantity: number, unit: 'KG' | 'UN') =>
  quantity.toLocaleString('pt-BR', {
    minimumFractionDigits: unit === 'KG' ? 3 : 0,
    maximumFractionDigits: unit === 'KG' ? 3 : 0
  });

const formatCashierCurrency = (value: number) =>
  value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const formatLaunchDateTime = (date: Date) =>
  date.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

const readCashierSessionState = (): CashierSessionState => {
  try {
    const raw = window.localStorage.getItem(CASHIER_SESSION_STORAGE_KEY);
    if (!raw) {
      return { isOpen: false, sequence: 0, expectedTotals: {}, totalSales: 0, attendanceCount: 0 };
    }

    const parsed = JSON.parse(raw) as Partial<CashierSessionState>;
    return {
      isOpen: Boolean(parsed.isOpen),
      sequence: Number(parsed.sequence ?? 0),
      expectedTotals: parsed.expectedTotals ?? {},
      totalSales: Number(parsed.totalSales ?? 0),
      attendanceCount: Number(parsed.attendanceCount ?? 0),
      openedAt: parsed.openedAt,
      openedBy: parsed.openedBy,
      closedAt: parsed.closedAt,
      closedBy: parsed.closedBy
    };
  } catch {
    return { isOpen: false, sequence: 0, expectedTotals: {}, totalSales: 0, attendanceCount: 0 };
  }
};

const persistCashierSessionState = (session: CashierSessionState) => {
  window.localStorage.setItem(CASHIER_SESSION_STORAGE_KEY, JSON.stringify(session));
  window.dispatchEvent(new CustomEvent(CASHIER_SESSION_CHANGED_EVENT, { detail: session }));
};

const CASHIER_PAYMENT_SUMMARY_LABELS: Array<{ method: PaymentEntry['method']; label: string }> = [
  { method: 'DINHEIRO', label: 'Dinheiro' },
  { method: 'PIX', label: 'PIX' },
  { method: 'DEBITO', label: 'Débito' },
  { method: 'CREDITO', label: 'Crédito' },
  { method: 'FIADO', label: 'Fiado' },
  { method: 'TICKET', label: 'Ticket' }
];

const parseTaxRate = (value?: string) => {
  const trimmed = value?.replace('%', '').trim();
  if (!trimmed) {
    return 0;
  }

  const normalized = trimmed.includes(',')
    ? trimmed.replace(/\./g, '').replace(',', '.')
    : trimmed;
  const rate = Number(normalized);
  return Number.isFinite(rate) && rate >= 0 ? rate : 0;
};

const hasValidTaxRateInput = (value?: string) => {
  const trimmed = value?.replace('%', '').trim();
  if (!trimmed) {
    return false;
  }

  const normalized = trimmed.includes(',')
    ? trimmed.replace(/\./g, '').replace(',', '.')
    : trimmed;
  const rate = Number(normalized);
  return Number.isFinite(rate) && rate >= 0;
};

const validateFiscalItemsForNfce = (items: CashierCartItem[]) => {
  const errors: string[] = [];

  for (const item of items) {
    const missingFields = [
      !item.ncm?.trim() ? 'NCM' : null,
      !item.cfop?.trim() ? 'CFOP' : null,
      !(item.taxSituationCode?.trim() || item.cstIcms?.trim()) ? 'CST/CSOSN' : null,
      !item.fiscalType?.trim() ? 'tipo fiscal' : null,
      !hasValidTaxRateInput(item.aliqIcms) ? 'alíquota ICMS' : null,
      !hasValidTaxRateInput(item.aliqPis) ? 'alíquota PIS' : null,
      !hasValidTaxRateInput(item.aliqCofins) ? 'alíquota COFINS' : null
    ].filter(Boolean);

    if (missingFields.length > 0) {
      errors.push(`${item.name}: ${missingFields.join(', ')}`);
    }
  }

  return errors;
};

const sortComandasByNumero = (items: ActiveComandaEntry[]) =>
  [...items].sort((a, b) => {
    const numeroA = Number(a.numero);
    const numeroB = Number(b.numero);

    const isNumeroAValido = Number.isFinite(numeroA);
    const isNumeroBValido = Number.isFinite(numeroB);

    if (isNumeroAValido && isNumeroBValido) {
      return numeroA - numeroB;
    }

    return a.numero.localeCompare(b.numero, 'pt-BR');
  });

const readLocalOpenComandas = (): ActiveComandaEntry[] => {
  return listOpenComandaNumbers().map((numero) => ({
    numero,
    origem: 'CAIXA' as const
  }));
};

const isBackendComandaNewerThanLocalCancel = (comanda: HeaderComandaRecord) => {
  const cancelledSnapshot = readCancelledComandas()[comanda.numero.trim()];
  if (!cancelledSnapshot) {
    return false;
  }

  const backendUpdatedAt = Date.parse(comanda.updatedAt ?? '');
  const locallyCancelledAt = Date.parse(cancelledSnapshot.cancelledAt);

  return Number.isFinite(backendUpdatedAt)
    && Number.isFinite(locallyCancelledAt)
    && backendUpdatedAt > locallyCancelledAt;
};

const shouldSkipBackendComandaAsLocallyCancelled = (comanda: HeaderComandaRecord) => {
  if (!isComandaLocallyCancelled(comanda.numero)) {
    return false;
  }

  if (isBackendComandaNewerThanLocalCancel(comanda)) {
    unmarkComandaLocallyCancelled(comanda.numero);
    return false;
  }

  return true;
};

const mergeOpenComandas = (backendComandas: HeaderComandaRecord[]) => {
  const entries = new Map<string, ActiveComandaEntry>();

  for (const comanda of backendComandas) {
    if (NON_OPEN_COMANDA_STATUSES.includes(comanda.status) || shouldSkipBackendComandaAsLocallyCancelled(comanda)) {
      continue;
    }

    entries.set(comanda.numero, {
      numero: comanda.numero,
      origem: 'BALANCA',
      status: comanda.status
    });
  }

  for (const localComanda of readLocalOpenComandas()) {
    if (!entries.has(localComanda.numero)) {
      entries.set(localComanda.numero, localComanda);
    }
  }

  return sortComandasByNumero([...entries.values()]);
};

const fetchComandaHeader = async (numero: string): Promise<HeaderComandaRecord | null> => {
  const response = await fetch(`${API_BASE}/api/v1/comandas/${encodeURIComponent(numero)}`);
  if (!response.ok) {
    return null;
  }

  const payload = await response.json().catch(() => null) as { comanda?: HeaderComandaRecord } | null;
  return payload?.comanda ?? null;
};

const mapComandaItemsToCashierCart = (
  items: ItemComanda[],
  catalog: CashierProduct[],
  sourceComandaNumber?: string
): CashierCartItem[] => {
  return items.map((item) => {
    const matchedProduct = catalog.find((product) => normalizeSearchText(product.name) === normalizeSearchText(item.nome));
    const sourceNumber = sourceComandaNumber?.trim();

    return {
      id: sourceNumber ? `comanda-${sourceNumber}-${item.id}` : item.id,
      name: item.nome,
      description: matchedProduct?.description,
      quantity: item.quantidade,
      unitPrice: item.precoUnitario,
      unit: item.porUnidade ? 'UN' : 'KG',
      productCode: matchedProduct?.productCode,
      barcode: matchedProduct?.barcode,
      ncm: matchedProduct?.ncm,
      cfop: matchedProduct?.cfop,
      taxSituationCode: matchedProduct?.taxSituationCode,
      cstIcms: matchedProduct?.cstIcms,
      fiscalType: matchedProduct?.fiscalType,
      aliqIcms: matchedProduct?.aliqIcms,
      aliqPis: matchedProduct?.aliqPis,
      aliqCofins: matchedProduct?.aliqCofins,
      imageUrl: matchedProduct?.imageUrl,
      sourceComandaNumber: sourceNumber,
      sourceItemId: item.id,
      catalogProductId: matchedProduct?.id
    };
  });
};

const mapCashierCartToComandaItems = (items: CashierCartItem[]): ItemComanda[] =>
  items.map((item) => ({
    id: item.sourceItemId ?? item.id,
    nome: item.name,
    precoUnitario: item.unitPrice,
    quantidade: item.quantity,
    categoriaId: 'CAIXA',
    subtotal: Number((item.quantity * item.unitPrice).toFixed(2)),
    porUnidade: item.unit === 'UN',
    peso: item.unit === 'KG' ? item.quantity : undefined
  }));

const groupCashierItemsByComanda = (
  primaryNumber: string,
  joinedNumbers: string[],
  items: CashierCartItem[]
) => {
  const numbers = [...new Set([primaryNumber, ...joinedNumbers].map((numero) => numero.trim()).filter(Boolean))];
  return numbers.map((numero) => ({
    numero,
    items: items.filter((item) => (item.sourceComandaNumber?.trim() || primaryNumber) === numero)
  }));
};

const extractComandaNumber = (raw: string, options: { allowBareNumber?: boolean } = {}) => {
  const { allowBareNumber = true } = options;
  const input = raw.trim();
  if (!input) {
    return null;
  }

  const explicitTagMatch = input.match(/^(?:comanda|cmd|mesa|balanca)\s*[:#-]?\s*(\d{1,12})$/i);
  if (explicitTagMatch) {
    return explicitTagMatch[1];
  }

  const digitsOnly = input.match(/^\d{1,12}$/);
  if (allowBareNumber && digitsOnly) {
    return digitsOnly[0];
  }

  return null;
};

export function CashierPage() {
  const { user, signOut } = useAuth();
  const { products, setProducts } = useProductsQuery();
  const { clients, setClients } = useClientsQuery();
  const [view, setView]                     = useState<View>('pos');
  const [cashCloseInitialTab, setCashCloseInitialTab] = useState<CashCloseTab>('MENU');
  const [cashCloseInitialSection, setCashCloseInitialSection] = useState<CashCloseSection>('INICIO');
  const [query, setQuery]                   = useState('');
  const [activeCategory, setActiveCategory] = useState('Todos');
  const [comandaNumber, setComandaNumber]   = useState('');
  const [paymentDocumentMode, setPaymentDocumentMode] = useState<PaymentDocumentMode>('ORCAMENTO');
  const [cartItems, setCartItems]           = useState<CashierCartItem[]>([]);
  const [openComandasCount, setOpenComandasCount] = useState(0);
  const [closedComandasCount, setClosedComandasCount] = useState(0);
  const [openComandas, setOpenComandas] = useState<ActiveComandaEntry[]>([]);
  const [joinedComandaNumbers, setJoinedComandaNumbers] = useState<string[]>([]);
  const [isJoinMode, setIsJoinMode] = useState(false);
  const [isJoiningComandas, setIsJoiningComandas] = useState(false);
  const [isCashierKeyboardVisible, setIsCashierKeyboardVisible] = useState(false);
  const [cashierSession, setCashierSession] = useState<CashierSessionState>(() => readCashierSessionState());
  const [isCashCloseSpanOpen, setIsCashCloseSpanOpen] = useState(false);
  const [isComandaItemsSyncing, setIsComandaItemsSyncing] = useState(false);
  const [hasUnsyncedItemChanges, setHasUnsyncedItemChanges] = useState(false);
  const [isOpenComandasPanelOpen, setIsOpenComandasPanelOpen] = useState(false);
  const [notice, setNotice] = useState<CashierNotice | null>(null);
  const [pendingAction, setPendingAction] = useState<PendingCashierAction | null>(null);
  const [isCancelSelectionMode, setIsCancelSelectionMode] = useState(false);
  const comandaLoadRequestRef = useRef(0);
  const skipNextCartSyncRef = useRef(false);
  const pendingCartSyncRef = useRef<Promise<boolean> | null>(null);
  const isCashierOpen = cashierSession.isOpen;
  const hasActiveComanda = Boolean(comandaNumber.trim()) && openComandas.some((entry) => entry.numero === comandaNumber.trim());
  const activeComandaLabel = hasActiveComanda ? comandaNumber.trim() : 'Sem comanda';
  const joinCandidates = openComandas.filter((entry) => (
    entry.numero !== comandaNumber.trim() && !joinedComandaNumbers.includes(entry.numero)
  ));

  const showNotice = (message: string, tone: CashierNotice['tone'] = 'info') => {
    setNotice({ message, tone });
  };

  const ensureCashierOpen = (actionLabel = 'operar o caixa') => {
    if (isCashierOpen) {
      return true;
    }

    showNotice(`Abra o caixa antes de ${actionLabel}.`, 'warning');
    return false;
  };

  const handleOpenCashier = () => {
    const nextSession: CashierSessionState = {
      isOpen: true,
      sequence: cashierSession.sequence + 1,
      expectedTotals: {},
      totalSales: 0,
      attendanceCount: 0,
      openedAt: new Date().toISOString(),
      openedBy: user?.name ?? user?.role ?? 'Operador',
      closedAt: undefined,
      closedBy: undefined
    };

    persistCashierSessionState(nextSession);
    setCashierSession(nextSession);
    setView('pos');
    setIsCashCloseSpanOpen(false);
    showNotice('Caixa aberto. As operações de venda estão liberadas.', 'success');
    focusProductSearchInput();
  };

  const openCashCloseSpan = (initialTab: CashCloseTab = 'MENU', initialSection: CashCloseSection = 'INICIO') => {
    if (!ensureCashierOpen('fechar ou administrar o caixa')) {
      return;
    }

    setCashCloseInitialTab(initialTab);
    setCashCloseInitialSection(initialSection);
    setView('pos');
    setIsCashierKeyboardVisible(false);
    setIsCashCloseSpanOpen(true);
  };

  const persistCashierCartSnapshot = (
    nextCartItems: CashierCartItem[],
    reason: string,
    options: { notifyOnFailure?: boolean } = {}
  ) => {
    const numero = comandaNumber.trim();
    if (!numero) {
      return Promise.resolve(true);
    }

    const groups = groupCashierItemsByComanda(numero, joinedComandaNumbers, nextCartItems);
    const syncPromise = Promise.all(
      groups.map(async (group) => {
        const items = mapCashierCartToComandaItems(group.items);
        upsertComandaItems(group.numero, items);

        try {
          await saveComandaItemsToBackend(group.numero, items, reason);
          return true;
        } catch {
          return false;
        }
      })
    ).then((results) => results.every(Boolean));

    pendingCartSyncRef.current = syncPromise;
    setIsComandaItemsSyncing(true);

    void syncPromise.then((synced) => {
      if (pendingCartSyncRef.current !== syncPromise) {
        return;
      }

      pendingCartSyncRef.current = null;
      setIsComandaItemsSyncing(false);
      setHasUnsyncedItemChanges(!synced);

      if (!synced && options.notifyOnFailure) {
        showNotice('Alteração salva localmente. Backend indisponível para sincronizar a comanda.', 'warning');
      }
    });

    return syncPromise;
  };

  const focusProductSearchInput = () => {
    window.requestAnimationFrame(() => {
      const searchInput = document.getElementById('cashier-smart-input') as HTMLInputElement | null;
      searchInput?.focus();
      searchInput?.select();
    });
  };

  const openProductSearch = () => {
    setView('pos');
    focusProductSearchInput();
  };

  const openPayment = (documentMode: PaymentDocumentMode = 'ORCAMENTO') => {
    if (!ensureCashierOpen('receber pagamento')) {
      return;
    }

    if (cartItems.length === 0) {
      showNotice('Adicione ao menos um produto antes de receber o pagamento.', 'warning');
      return;
    }

    setPaymentDocumentMode(documentMode);
    setIsJoinMode(false);
    setIsCashierKeyboardVisible(false);
    setView('payment');
  };

  const openJoinComandasPanel = () => {
    if (!ensureCashierOpen('juntar comandas')) {
      return;
    }

    const activeNumber = comandaNumber.trim();
    if (!activeNumber) {
      showNotice('Abra a comanda principal antes de juntar outras comandas.', 'warning');
      return;
    }

    if (joinCandidates.length === 0) {
      showNotice('Não há outras comandas abertas disponíveis para juntar.', 'warning');
      return;
    }

    setQuery('');
    setIsJoinMode(true);
    setView('pos');
    focusProductSearchInput();
    showNotice(`Digite ou leia a comanda que será unida à #${activeNumber} e pressione Enter.`, 'info');
  };

  const joinComandas = async (numbers: string[]) => {
    if (numbers.length === 0 || isJoiningComandas) {
      return;
    }

    setIsJoiningComandas(true);
    let usedLocalCache = false;

    try {
      const loadedGroups = await Promise.all(numbers.map(async (numero) => {
        try {
          const items = await fetchComandaItemsFromBackend(numero);
          upsertComandaItems(numero, items);
          return { numero, items };
        } catch {
          usedLocalCache = true;
          return { numero, items: readComandaItems(numero) };
        }
      }));

      skipNextCartSyncRef.current = true;
      setCartItems((currentItems) => [
        ...currentItems,
        ...loadedGroups.flatMap((group) => mapComandaItemsToCashierCart(group.items, catalogProducts, group.numero))
      ]);
      setJoinedComandaNumbers((current) => [...new Set([...current, ...numbers])]);
      setQuery('');
      setIsJoinMode(false);
      showNotice(
        `${numbers.length > 1 ? 'Comandas' : 'Comanda'} ${numbers.map((numero) => `#${numero}`).join(', ')} ${numbers.length > 1 ? 'adicionadas' : 'adicionada'} ao pagamento${usedLocalCache ? ' usando o cache local' : ''}.`,
        usedLocalCache ? 'warning' : 'success'
      );
      focusProductSearchInput();
    } finally {
      setIsJoiningComandas(false);
    }
  };

  const submitJoinComandaInput = (rawValue: string) => {
    const numero = extractComandaNumber(rawValue);
    if (!numero) {
      showNotice('Digite ou leia um número de comanda válido.', 'warning');
      return;
    }

    if (numero === comandaNumber.trim()) {
      showNotice('A comanda principal não pode ser unida a ela mesma.', 'warning');
      return;
    }

    if (joinedComandaNumbers.includes(numero)) {
      showNotice(`A comanda #${numero} já está unida ao pagamento.`, 'warning');
      return;
    }

    if (!openComandas.some((entry) => entry.numero === numero)) {
      showNotice(`A comanda #${numero} não está aberta ou não foi encontrada.`, 'warning');
      return;
    }

    void joinComandas([numero]);
  };

  const cancelComanda = async (numero: string) => {
    const trimmed = numero.trim();
    if (!trimmed) {
      return;
    }

    let backendCancelled = true;
    try {
      const response = await fetch(`${API_BASE}/api/v1/comandas/${encodeURIComponent(trimmed)}/status`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          status: 'CANCELADA',
          reason: 'cancelada_no_caixa'
        })
      });

      if (!response.ok) {
        throw new Error('Falha ao cancelar comanda no backend.');
      }
    } catch {
      backendCancelled = false;
    }

    markComandaLocallyCancelled(trimmed, backendCancelled ? 'cancelada_no_caixa' : 'cancelada_localmente_no_caixa');
    removeComandaCacheEntry(trimmed);
    setCartItems((currentItems) => (
      comandaNumber.trim() === trimmed
        ? []
        : currentItems.filter((item) => item.sourceComandaNumber !== trimmed)
    ));
    setJoinedComandaNumbers((current) => current.filter((numero) => numero !== trimmed));
    setOpenComandas((prev) => {
      const next = prev.filter((entry) => entry.numero !== trimmed);
      setOpenComandasCount(next.length);
      return next;
    });

    if (comandaNumber.trim() === trimmed) {
      setComandaNumber('');
      setJoinedComandaNumbers([]);
      setIsJoinMode(false);
      setQuery('');
      focusProductSearchInput();
    }

    setIsCancelSelectionMode(false);
    setIsOpenComandasPanelOpen(false);
    showNotice(
      backendCancelled
        ? `Comanda #${trimmed} cancelada.`
        : `Comanda #${trimmed} cancelada localmente. Confirme a sincronização quando o backend voltar.`,
      backendCancelled ? 'success' : 'warning'
    );
  };

  const requestCancelComanda = (numero: string) => {
    const trimmed = numero.trim();
    if (!trimmed) {
      return;
    }

    setPendingAction({
      kind: 'CANCEL_COMANDA',
      numero: trimmed,
      title: `Cancelar comanda #${trimmed}`,
      description: 'Essa ação remove a comanda da operação do caixa e registra o cancelamento quando o backend estiver disponível.'
    });
  };

  const clearComandaCacheNow = () => {
    clearComandaCache();
    setOpenComandas([]);
    setOpenComandasCount(0);
    setCartItems([]);
    setComandaNumber('');
    setJoinedComandaNumbers([]);
    setIsJoinMode(false);
    setQuery('');
    setIsOpenComandasPanelOpen(false);
    setIsCancelSelectionMode(false);
    focusProductSearchInput();
    showNotice('Cache local de comandas limpo.', 'success');
  };

  const confirmPendingAction = () => {
    const action = pendingAction;
    if (!action) {
      return;
    }

    setPendingAction(null);
    if (action.kind === 'CANCEL_COMANDA') {
      void cancelComanda(action.numero);
      return;
    }

    if (action.kind === 'REMOVE_ITEM') {
      const nextCartItems = cartItems.filter((item) => item.id !== action.itemId);
      skipNextCartSyncRef.current = true;
      setCartItems(nextCartItems);
      void persistCashierCartSnapshot(nextCartItems, 'caixa_item_removed', { notifyOnFailure: true });
      showNotice(`Produto "${action.itemName}" excluído da comanda.`, 'success');
      return;
    }

    clearComandaCacheNow();
  };

  const handleShortcutCancelComanda = () => {
    const activeNumber = comandaNumber.trim();
    if (activeNumber) {
      requestCancelComanda(activeNumber);
      return;
    }

    if (openComandas.length === 0) {
      showNotice('Não há comandas abertas para cancelar.', 'warning');
      return;
    }

    setIsCancelSelectionMode(true);
    setIsOpenComandasPanelOpen(true);
    showNotice('Selecione uma comanda aberta na lista e confirme o cancelamento.', 'info');
  };
  const loadComandaIntoCashier = async (numero: string) => {
    if (!ensureCashierOpen('abrir comanda no caixa')) {
      return;
    }

    const trimmed = numero.trim();
    if (!trimmed) {
      return;
    }

    const requestId = ++comandaLoadRequestRef.current;
    let backendComanda: HeaderComandaRecord | null = null;

    try {
      backendComanda = await fetchComandaHeader(trimmed);
    } catch {
      backendComanda = null;
    }

    if (isComandaLocallyCancelled(trimmed)
      && (!backendComanda || shouldSkipBackendComandaAsLocallyCancelled(backendComanda))) {
      setQuery('');
      focusProductSearchInput();
      showNotice(`Comanda #${trimmed} está cancelada localmente e não pode ser aberta no caixa.`, 'warning');
      return;
    }

    let loadedItems: ItemComanda[];
    let loadedFromBackend = false;

    const status = backendComanda?.status;
    if (status && NON_OPEN_COMANDA_STATUSES.includes(status)) {
      removeComandaCacheEntry(trimmed);
      if (status === 'CANCELADA') {
        markComandaLocallyCancelled(trimmed, 'cancelada_no_backend');
      }

      setQuery('');
      focusProductSearchInput();
      showNotice(`Comanda #${trimmed} está ${status.toLowerCase().replaceAll('_', ' ')} e não pode ser aberta no caixa.`, 'warning');
      return;
    }

    try {
      loadedItems = await fetchComandaItemsFromBackend(trimmed);
      loadedFromBackend = true;
    } catch {
      loadedItems = readComandaItems(trimmed);
    }

    if (requestId !== comandaLoadRequestRef.current) {
      return;
    }

    skipNextCartSyncRef.current = true;
    setComandaNumber(trimmed);
    setCartItems(mapComandaItemsToCashierCart(loadedItems, catalogProducts, trimmed));
    setJoinedComandaNumbers([]);
    setIsJoinMode(false);
    upsertComandaItems(trimmed, loadedItems);

    if (!loadedFromBackend) {
      showNotice(`Comanda #${trimmed} carregada do cache local. Backend indisponível para itens.`, 'warning');
    }

    setOpenComandas((prev) => {
      if (prev.some((entry) => entry.numero === trimmed)) {
        return prev;
      }

      const next = sortComandasByNumero([
        ...prev,
        {
          numero: trimmed,
          origem: 'CAIXA'
        }
      ]);
      setOpenComandasCount(next.length);

      return next;
    });
    setQuery('');
    focusProductSearchInput();
  };

  const handleSmartInputSubmit = (rawValue: string) => {
    if (!ensureCashierOpen('buscar produtos ou comandas')) {
      return;
    }

    if (isJoinMode) {
      submitJoinComandaInput(rawValue);
      return;
    }

    const trimmedValue = rawValue.trim();
    if (!trimmedValue) {
      return;
    }

    const explicitComandaFromInput = extractComandaNumber(rawValue, { allowBareNumber: false });
    if (!comandaNumber.trim() && explicitComandaFromInput) {
      void loadComandaIntoCashier(explicitComandaFromInput);
      return;
    }

    const normalizedInput = normalizeSearchText(trimmedValue);
    const visibleProducts = catalogProducts.filter((product) => !product.isHidden);
    const exactProduct = visibleProducts.find((product) => {
      const exactFields = [product.productCode, product.barcode, product.name].filter(Boolean);
      return exactFields.some((field) => normalizeSearchText(String(field)) === normalizedInput);
    });
    const productToAdd = exactProduct ?? (!/^\d{1,12}$/.test(trimmedValue) ? filteredProducts[0] : undefined);
    if (productToAdd) {
      addProduct(productToAdd);
      setQuery('');
      focusProductSearchInput();
      return;
    }

    const comandaFromInput = extractComandaNumber(rawValue);
    if (comandaFromInput && !comandaNumber.trim()) {
      void loadComandaIntoCashier(comandaFromInput);
      return;
    }

    showNotice(`Nenhum produto encontrado para "${trimmedValue}".`, 'warning');
  };

  const handleCashierVirtualKeyboardKeyPress = (key: string) => {
    if (key === 'Clear') {
      setQuery('');
      focusProductSearchInput();
      return;
    }

    if (key === 'Backspace') {
      setQuery((current) => current.slice(0, -1));
      focusProductSearchInput();
      return;
    }

    if (key === 'Enter') {
      handleSmartInputSubmit(query);
      focusProductSearchInput();
      return;
    }

    setQuery((current) => `${current}${key}`);
    focusProductSearchInput();
  };

  const refreshCurrentComanda = () => {
    const currentNumber = comandaNumber.trim();
    if (!currentNumber) {
      return;
    }

    void (async () => {
      const pendingSync = pendingCartSyncRef.current;
      if (pendingSync) {
        const synced = await pendingSync;
        if (!synced) {
          skipNextCartSyncRef.current = true;
          setCartItems(mapComandaItemsToCashierCart(readComandaItems(currentNumber), catalogProducts, currentNumber));
          showNotice('A comanda possui alterações locais pendentes. Sincronize antes de atualizar pelo backend.', 'warning');
          return;
        }
      }

      if (hasUnsyncedItemChanges) {
        skipNextCartSyncRef.current = true;
        setCartItems(mapComandaItemsToCashierCart(readComandaItems(currentNumber), catalogProducts, currentNumber));
        showNotice('A comanda possui alterações locais pendentes. Sincronize antes de atualizar pelo backend.', 'warning');
        return;
      }

      void loadComandaIntoCashier(currentNumber);
    })();
  };

  const leaveCurrentComandaOpen = () => {
    if (!ensureCashierOpen('manter a comanda aberta')) {
      return;
    }

    const currentNumber = comandaNumber.trim();
    if (!currentNumber) {
      showNotice('Nenhuma comanda ativa para manter aberta.', 'warning');
      focusProductSearchInput();
      return;
    }

    const groupedItems = groupCashierItemsByComanda(currentNumber, joinedComandaNumbers, cartItems);
    const returnedComandas = groupedItems.map<ActiveComandaEntry>((group) => {
      const existingEntry = openComandas.find((entry) => entry.numero === group.numero);
      return {
        numero: group.numero,
        origem: existingEntry?.origem ?? 'CAIXA',
        status: existingEntry?.status ?? 'PRONTA_PARA_CAIXA'
      };
    });
    const nextOpenComandas = sortComandasByNumero([
      ...new Map([
        ...openComandas.map((entry) => [entry.numero, entry] as const),
        ...returnedComandas.map((entry) => [entry.numero, entry] as const)
      ]).values()
    ]);

    for (const group of groupedItems) {
      const items = mapCashierCartToComandaItems(group.items);
      upsertComandaItems(group.numero, items);
      void saveComandaItemsToBackend(group.numero, items, 'caixa_leave_open').catch(() => {
        // O snapshot local preserva a comanda durante indisponibilidade temporaria.
      });
    }

    comandaLoadRequestRef.current += 1;
    skipNextCartSyncRef.current = true;
    setComandaNumber('');
    setCartItems([]);
    setJoinedComandaNumbers([]);
    setIsJoinMode(false);
    setQuery('');
    setActiveCategory('Todos');
    setView('pos');
    setPendingAction(null);
    setIsOpenComandasPanelOpen(false);
    setIsCancelSelectionMode(false);
    setIsCashierKeyboardVisible(false);
    setOpenComandas(nextOpenComandas);
    setOpenComandasCount(nextOpenComandas.length);
    void refreshComandaIndicators().catch(() => {
      // Os indicadores locais ja foram atualizados; o backend pode estar temporariamente indisponivel.
    });
    focusProductSearchInput();
    const involvedNumbers = [currentNumber, ...joinedComandaNumbers];
    showNotice(
      involvedNumbers.length === 1
        ? `Comanda #${currentNumber} mantida aberta para continuar o atendimento.`
        : `Comandas ${involvedNumbers.map((numero) => `#${numero}`).join(', ')} mantidas abertas para continuar o atendimento.`,
      'success'
    );
  };

  const notifyFeaturePending = (featureLabel: string) => {
    showNotice(`${featureLabel} em breve.`, 'info');
  };

  const handleCancelLastSale = () => {
    setCartItems([]);
    setView('pos');
  };

  const handleCancelCoupons = () => {
    notifyFeaturePending('Cancelar cupons');
    setView('pos');
  };

  const handleClearComandaCache = () => {
    setPendingAction({
      kind: 'CLEAR_COMANDA_CACHE',
      title: 'Limpar cache local de comandas',
      description: 'Essa ação remove os snapshots locais do caixa. Use apenas quando a fila local estiver inconsistente.'
    });
  };

  const now = new Date();

  const catalogProducts = useMemo<CashierProduct[]>(
    () =>
      products.map((product) => ({
        id: product.id,
        name: product.name,
        description: product.description,
        category: product.category,
        price: product.price,
        unit: product.byWeight ? 'KG' : 'UN',
        isUnavailable: product.isUnavailable,
        isHidden: product.isHidden,
        productCode: product.productCode,
        barcode: product.barcode,
        ncm: product.ncm,
        cfop: product.cfop,
        fiscalType: product.fiscalType,
        taxSituationCode: product.taxSituationCode,
        cstIcms: product.cstIcms,
        aliqIcms: product.aliqIcms,
        aliqPis: product.aliqPis,
        aliqCofins: product.aliqCofins,
        imageUrl: product.imageUrl
      })),
    [products]
  );

  const dynamicCategories = useMemo(() => {
    const categorySet = new Set<string>();
    for (const product of catalogProducts) {
      if (product.category.trim()) {
        categorySet.add(product.category);
      }
    }

    return ['Todos', ...[...categorySet].sort((a, b) => a.localeCompare(b, 'pt-BR'))];
  }, [catalogProducts]);

  const refreshComandaIndicators = useCallback(async () => {
    const response = await fetch(`${API_BASE}/api/v1/comandas`);
    if (!response.ok) {
      throw new Error('Falha ao consultar comandas no backend.');
    }

    const payload = (await response.json()) as { ok?: boolean; comandas?: HeaderComandaRecord[] };
    if (!Array.isArray(payload.comandas)) {
      return;
    }

    const mergedOpenComandas = mergeOpenComandas(payload.comandas);
    const totalOpen = mergedOpenComandas.length;
    const backendClosedNumbers = new Set(
      payload.comandas
        .filter((comanda) => COUNTABLE_CLOSED_COMANDA_STATUSES.includes(comanda.status))
        .map((comanda) => comanda.numero)
    );
    const localCancelledNumbers = listLocallyCancelledComandaNumbers()
      .filter((numero) => !backendClosedNumbers.has(numero));
    const totalClosed = backendClosedNumbers.size + localCancelledNumbers.length;

    for (const closedComanda of payload.comandas.filter((comanda) => NON_OPEN_COMANDA_STATUSES.includes(comanda.status))) {
      removeComandaCacheEntry(closedComanda.numero);
      if (closedComanda.status === 'CANCELADA') {
        markComandaLocallyCancelled(closedComanda.numero, 'cancelada_no_backend');
      }
    }

    setOpenComandas(mergedOpenComandas);
    setOpenComandasCount(totalOpen);
    setClosedComandasCount(totalClosed);
  }, []);

  useEffect(() => {
    let cancelled = false;

    const loadComandaIndicators = async () => {
      try {
        await refreshComandaIndicators();
        if (cancelled) {
          return;
        }
      } catch {
        if (!cancelled) {
          const localOpenComandas = readLocalOpenComandas();
          setOpenComandas(localOpenComandas);
          setOpenComandasCount(localOpenComandas.length);
          setClosedComandasCount(0);
        }
      }
    };

    void loadComandaIndicators();
    const intervalId = window.setInterval(() => {
      void loadComandaIndicators();
    }, 15000);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [refreshComandaIndicators]);

  const loadCashCloseExpectedTotals = async () => {
    const sessionSnapshot = readCashierSessionState();
    if (sessionSnapshot.isOpen && Object.keys(sessionSnapshot.expectedTotals).length > 0) {
      return {
        DINHEIRO: sessionSnapshot.expectedTotals.DINHEIRO ?? 0,
        DEBITO: sessionSnapshot.expectedTotals.DEBITO ?? 0,
        CREDITO: sessionSnapshot.expectedTotals.CREDITO ?? 0,
        PIX: sessionSnapshot.expectedTotals.PIX ?? 0,
        FIADO: sessionSnapshot.expectedTotals.FIADO ?? 0,
        TICKET: sessionSnapshot.expectedTotals.TICKET ?? 0
      };
    }

    try {
      const response = await fetch(`${API_BASE}/api/v1/caixa/expected-totals`);
      if (response.ok) {
        const payload = (await response.json()) as { expectedTotals?: Record<string, number> };
        if (payload.expectedTotals) {
          return payload.expectedTotals;
        }
      }
    } catch {
      // O endpoint ainda não existe no MVP; o fechamento cego continua sem simular valores.
    }

    return {
      DINHEIRO: 0,
      DEBITO: 0,
      CREDITO: 0,
      PIX: 0,
      FIADO: 0,
      TICKET: 0
    };
  };

  const getOpenComandasBeforeCashClose = async () => {
    try {
      const response = await fetch(`${API_BASE}/api/v1/comandas`);
      if (!response.ok) {
        throw new Error('Falha ao consultar comandas abertas antes do fechamento.');
      }

      const payload = (await response.json()) as { ok?: boolean; comandas?: HeaderComandaRecord[] };
      if (Array.isArray(payload.comandas)) {
        return mergeOpenComandas(payload.comandas);
      }
    } catch {
      // Sem backend, usa o cache local para não permitir fechar com comanda aberta nesta estação.
    }

    return readLocalOpenComandas();
  };

  const handleCashClose = async () => {
    const openComandasBeforeClose = await getOpenComandasBeforeCashClose();
    if (openComandasBeforeClose.length > 0) {
      setOpenComandas(openComandasBeforeClose);
      setOpenComandasCount(openComandasBeforeClose.length);
      setIsCashCloseSpanOpen(false);
      showNotice(
        `Não é possível fechar o caixa com ${openComandasBeforeClose.length} ${openComandasBeforeClose.length === 1 ? 'comanda aberta' : 'comandas abertas'}. Feche ou cancele as comandas antes do fechamento.`,
        'warning'
      );
      return;
    }

    try {
      const response = await fetch(`${API_BASE}/api/v1/comandas`);
      if (response.ok) {
        const payload = (await response.json()) as { ok?: boolean; comandas?: HeaderComandaRecord[] };
        if (Array.isArray(payload.comandas)) {
          const closedComandas = payload.comandas.filter((comanda) => COUNTABLE_CLOSED_COMANDA_STATUSES.includes(comanda.status));

          await Promise.all(
            closedComandas.map(async (comanda) => {
              try {
                await fetch(`${API_BASE}/api/v1/comandas/${encodeURIComponent(comanda.numero)}/status`, {
                  method: 'PUT',
                  headers: {
                    'Content-Type': 'application/json'
                  },
                  body: JSON.stringify({
                    status: 'ARQUIVADA',
                    reason: 'fechamento_caixa'
                  })
                });
              } catch {
                // segue para próximo registro sem interromper operação
              }

              removeComandaCacheEntry(comanda.numero);
            })
          );
        }
      }
    } catch {
      // mantém fechamento local mesmo sem backend
    }

    for (const locallyCancelledNumber of listLocallyCancelledComandaNumbers()) {
      unmarkComandaLocallyCancelled(locallyCancelledNumber);
    }

    await refreshComandaIndicators().catch(() => {
      setClosedComandasCount(0);
    });
    setClosedComandasCount(0);

    const nextSession: CashierSessionState = {
      ...cashierSession,
      isOpen: false,
      closedAt: new Date().toISOString(),
      closedBy: user?.name ?? user?.role ?? 'Operador'
    };
    persistCashierSessionState(nextSession);
    setCashierSession(nextSession);
    setCartItems([]);
    setComandaNumber('');
    setJoinedComandaNumbers([]);
    setIsJoinMode(false);
    setIsCashCloseSpanOpen(false);
    setView('pos');
    window.dispatchEvent(new CustomEvent('pdv.dashboard-refresh'));
    showNotice('Caixa fechado. Para vender novamente, abra o caixa.', 'success');
  };

  const accumulateSaleInCashierSession = (payments: PaymentEntry[], payableTotal: number) => {
    const currentSession = readCashierSessionState();
    if (!currentSession.isOpen) {
      return;
    }

    const nextTotals = { ...currentSession.expectedTotals };
    for (const payment of payments) {
      nextTotals[payment.method] = Number(((nextTotals[payment.method] ?? 0) + payment.amount).toFixed(2));
    }

    const nextSession: CashierSessionState = {
      ...currentSession,
      expectedTotals: nextTotals,
      totalSales: Number((currentSession.totalSales + payableTotal).toFixed(2)),
      attendanceCount: currentSession.attendanceCount + 1
    };

    persistCashierSessionState(nextSession);
    setCashierSession(nextSession);
    window.dispatchEvent(new CustomEvent('pdv.dashboard-refresh'));
  };

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isCashCloseSpanOpen) {
        event.preventDefault();
        setIsCashCloseSpanOpen(false);
        setIsCashierKeyboardVisible(false);
        setView('pos');
        focusProductSearchInput();
        return;
      }

      if (event.key === 'Escape' && isCashierKeyboardVisible) {
        event.preventDefault();
        setIsCashierKeyboardVisible(false);
        focusProductSearchInput();
        return;
      }

      if (event.key === 'F2') {
        event.preventDefault();
        openPayment('ORCAMENTO');
        return;
      }

      if (event.key === 'F9') {
        event.preventDefault();
        openPayment('ORCAMENTO');
        return;
      }

      if (event.key === 'F3') {
        event.preventDefault();
        openPayment('NFCE');
        return;
      }

      if (event.ctrlKey && !event.altKey && event.key.toLowerCase() === 'u') {
        event.preventDefault();
        openJoinComandasPanel();
        return;
      }

      if (event.ctrlKey && !event.altKey && event.key.toLowerCase() === 'x') {
        event.preventDefault();
        leaveCurrentComandaOpen();
        return;
      }

      if (event.key === 'F11') {
        // F11 abre fullscreen no navegador; aqui priorizamos atalho operacional do caixa.
        event.preventDefault();
        openCashCloseSpan('FECHAMENTO', 'INICIO');
        return;
      }

      if (event.key === 'F4') {
        event.preventDefault();
        openCashCloseSpan('ADMINISTRATIVO', 'RECEBIMENTO_FIADO');
        return;
      }

      if (event.key === 'F7') {
        event.preventDefault();
        openProductSearch();
        return;
      }

      if (event.key === 'F8') {
        event.preventDefault();
        handleShortcutCancelComanda();
        return;
      }

      if (event.ctrlKey && !event.altKey && event.key.toLowerCase() === 'c') {
        event.preventDefault();
        if (view !== 'pos') {
          setView('pos');
        }

        setIsCashierKeyboardVisible(true);
        focusProductSearchInput();
        return;
      }

      if (event.altKey && event.key.toLowerCase() === 'c') {
        event.preventDefault();
        handleCancelCoupons();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  });

  // ── Filtered products ──────────────────────────────────────────────────────
  const filteredProducts = useMemo(() => {
    const q = normalizeSearchText(query.trim());
    return catalogProducts.filter((p) => {
      if (p.isHidden) {
        return false;
      }

      const matchesCat   = activeCategory === 'Todos' || p.category === activeCategory;
      const haystack = normalizeSearchText([
        p.name,
        p.category,
        p.productCode ?? '',
        p.barcode ?? '',
        p.ncm ?? '',
        p.cfop ?? '',
        p.fiscalType ?? '',
        p.taxSituationCode ?? ''
      ].join(' '));
      const matchesQuery = !q || haystack.includes(q);
      return matchesCat && matchesQuery;
    });
  }, [activeCategory, query, catalogProducts]);

  useEffect(() => {
    if (skipNextCartSyncRef.current) {
      skipNextCartSyncRef.current = false;
      return;
    }

    const numero = comandaNumber.trim();
    if (!numero) {
      return;
    }

    void persistCashierCartSnapshot(cartItems, 'caixa_items_sync');
  }, [cartItems, comandaNumber, joinedComandaNumbers]);

  useEffect(() => {
    const current = comandaNumber.trim();
    if (!current) {
      return;
    }

    const isStillOpen = openComandas.some((entry) => entry.numero === current);
    if (isStillOpen) {
      return;
    }

    setComandaNumber('');
    setCartItems([]);
    setJoinedComandaNumbers([]);
    setIsJoinMode(false);
  }, [comandaNumber, openComandas]);

  const updateProductStatus = async (productId: string, patch: Partial<Pick<Product, 'isUnavailable' | 'isHidden'>>) => {
    const currentProduct = products.find((product) => product.id === productId);
    if (!currentProduct) {
      return;
    }

    const nextProduct = {
      ...currentProduct,
      ...patch,
      updatedAt: new Date(),
      version: currentProduct.version + 1
    };

    await productsContainer.productRepository.save(nextProduct);
    setProducts((prev) => prev.map((product) => (product.id === productId ? nextProduct : product)));
  };

  const handleToggleUnavailable = async (product: CashierProduct) => {
    await updateProductStatus(product.id, { isUnavailable: !product.isUnavailable });
  };

  const handleToggleHidden = async (product: CashierProduct) => {
    await updateProductStatus(product.id, { isHidden: !product.isHidden });
  };

  const subtotal = cartItems.reduce((s, i) => s + i.quantity * i.unitPrice, 0);

  const mapPaymentType = (method: PaymentEntry['method']): PaymentType => {
    const map: Record<PaymentEntry['method'], PaymentType> = {
      DINHEIRO: 'DINHEIRO',
      PIX: 'PIX',
      DEBITO: 'CARTAO_DEBITO',
      CREDITO: 'CARTAO_CREDITO',
      FIADO: 'OUTROS',
      TICKET: 'VALE'
    };

    return map[method] ?? 'OUTROS';
  };

  const buildReceiptEmitter = (): ReceiptEmitter => {
    const fiscalSettings = loadDigitalCertificateSettings();
    const addressParts = (fiscalSettings?.addressLine1 || '')
      .split(',')
      .map((part) => part.trim())
      .filter(Boolean);
    const hasStructuredAddress = addressParts.length >= 3;
    const addressStreet = hasStructuredAddress
      ? addressParts[0]
      : fiscalSettings?.addressLine1?.trim() || '';
    const addressNumber = hasStructuredAddress ? addressParts[1] : '';
    const addressDistrict = hasStructuredAddress ? addressParts.slice(2).join(', ') : '';
    const [city = '', uf = 'SP'] = (fiscalSettings?.cityUf || '')
      .split('/')
      .map((part) => part.trim());

    return {
      razaoSocial: fiscalSettings?.companyName?.trim() || 'RAZÃO SOCIAL DO RESTAURANTE LTDA',
      nomeFantasia: 'PDV_RESTAURANTE_KILO',
      cnpj: fiscalSettings?.cnpj?.trim() || '00000000000000',
      inscricaoEstadual: fiscalSettings?.stateRegistration?.trim() || undefined,
      endereco: {
        logradouro: addressStreet || 'Rua Exemplo',
        numero: addressNumber || 'S/N',
        bairro: addressDistrict || fiscalSettings?.addressLine2?.trim() || 'Bairro',
        municipio: city || 'São Paulo',
        uf: uf.toUpperCase() === 'SP' ? 'SP' : 'SP',
        cep: '00000000'
      }
    };
  };

  const printReceipt = (
    payments: PaymentEntry[],
    discountAmount = 0,
    documentMode: PaymentDocumentMode = 'NFCE',
    customerDocument = ''
  ) => {
    const opened = window.open('', '_blank', 'width=460,height=760');
    if (!opened) {
      return;
    }

    const now = new Date();
    const payableTotal = Math.max(0, subtotal - discountAmount);
    const totalPaid = payments.reduce((sum, payment) => sum + payment.amount, 0);
    const change = Math.max(0, totalPaid - payableTotal);
    const receiptComandaNumbers = [...new Set([comandaNumber.trim(), ...joinedComandaNumbers].filter(Boolean))];
    const comandaLabel = receiptComandaNumbers.length > 0
      ? receiptComandaNumbers.map((numero) => `#${numero}`).join(' + ')
      : undefined;
    const customerDocumentDigits = customerDocument.replace(/\D/g, '');
    const discountFactor = subtotal > 0 ? payableTotal / subtotal : 0;
    const receiptItems: ReceiptItem[] = cartItems.map((item, index) => ({
      codigo: item.productCode || item.barcode || String(index + 1).padStart(3, '0'),
      descricao: item.name,
      ncm: item.ncm,
      cfop: item.cfop,
      unidade: item.unit,
      quantidade: item.quantity,
      valorUnitario: item.unitPrice,
      valorTotal: Number((item.quantity * item.unitPrice).toFixed(2)),
      cstCsosn: item.taxSituationCode || item.cstIcms
    }));
    const chargedTaxes = cartItems.reduce((sum, item) => {
      const combinedRate = parseTaxRate(item.aliqIcms) + parseTaxRate(item.aliqPis) + parseTaxRate(item.aliqCofins);
      return sum + item.quantity * item.unitPrice * discountFactor * (combinedRate / 100);
    }, 0);
    const receiptPayments: ReceiptPayment[] = payments.map((payment) => ({
      tipo: mapPaymentType(payment.method),
      valor: payment.amount
    }));
    const fiscalSettings = loadDigitalCertificateSettings();
    const nonFiscalReceipt: NonFiscalReceipt = {
      tipo: 'NON_FISCAL',
      emitente: buildReceiptEmitter(),
      controleInterno: String(Date.now()).slice(-8).padStart(8, '0'),
      dataEmissao: now.toLocaleString('pt-BR'),
      consumidor: customerDocumentDigits
        ? { cpfCnpj: customerDocumentDigits, nome: 'CONSUMIDOR FINAL' }
        : undefined,
      comanda: comandaLabel,
      operador: user?.name ?? 'CAIXA 01',
      pdv: 'CAIXA PRINCIPAL',
      itens: receiptItems,
      pagamentos: receiptPayments,
      totalProdutos: Number(subtotal.toFixed(2)),
      descontoTotal: Number(discountAmount.toFixed(2)),
      acrescimoTotal: 0,
      totalDocumento: Number(payableTotal.toFixed(2)),
      troco: Number(change.toFixed(2))
    };
    const receipt = documentMode === 'NFCE'
      ? (() => {
          const mockNfce = convertNonFiscalToMockNfce(nonFiscalReceipt);
          const nfceNumber = (fiscalSettings?.nfceNextNumber || mockNfce.nfce.numero || '1')
            .replace(/\D/g, '')
            .padStart(9, '0');
          const nfceSerie = fiscalSettings?.nfceSerie?.trim() || mockNfce.nfce.serie;

          return {
            ...mockNfce,
            nfce: {
              ...mockNfce.nfce,
              serie: nfceSerie,
              numero: nfceNumber,
              ambiente: fiscalSettings?.nfceEnvironment || mockNfce.nfce.ambiente,
              cscId: fiscalSettings?.cscId?.trim() || mockNfce.nfce.cscId
            },
            consumidor: customerDocumentDigits
              ? { cpfCnpj: customerDocumentDigits, nome: 'CONSUMIDOR FINAL' }
              : undefined,
            tributosAproximados: {
              federal: 0,
              estadual: Number(chargedTaxes.toFixed(2)),
              municipal: 0
            }
          };
        })()
      : nonFiscalReceipt;
    const receiptText = buildReceiptText(receipt);

    opened.document.write(`
      <html>
        <head>
          <title>${documentMode === 'NFCE' ? 'DANFE NFC-e' : 'Comprovante não fiscal'}</title>
          <style>
            body {
              margin: 0;
              padding: 10px;
              background: #ffffff;
              color: #000000;
            }
            .receipt {
              width: 384px;
              max-width: 100%;
              margin: 0 auto;
              white-space: pre-wrap;
              font-family: "Courier New", Consolas, monospace;
              font-size: 11px;
              line-height: 1.25;
            }
            @media print {
              body { padding: 0; }
              .receipt { width: 80mm; }
            }
          </style>
        </head>
        <body>
          <pre class="receipt">${escapeHtml(receiptText)}</pre>
          <script>
            window.onload = function () {
              window.print();
              window.onafterprint = function () { window.close(); };
            };
          </script>
        </body>
      </html>
    `);
    opened.document.close();
  };
  // ── Cart mutations ─────────────────────────────────────────────────────────
  const addProduct = (product: CashierProduct) => {
    if (!ensureCashierOpen('lançar produtos')) {
      return;
    }

    if (product.isUnavailable) {
      return;
    }

    const activeNumber = comandaNumber.trim();
    setCartItems((prev) => {
      const existing = prev.find((item) => (
        (item.sourceComandaNumber?.trim() || activeNumber) === activeNumber
        && item.catalogProductId === product.id
      ));
      const step = product.unit === 'KG' ? 0.1 : 1;
      if (existing) {
        return prev.map((item) =>
          item.id === existing.id ? { ...item, quantity: Number((item.quantity + step).toFixed(3)) } : item
        );
      }
      const sourceItemId = crypto.randomUUID();
      return [...prev, {
        id: `comanda-${activeNumber || 'caixa'}-${sourceItemId}`,
        name: product.name,
        description: product.description,
        quantity: step,
        unitPrice: product.price,
        unit: product.unit as 'KG' | 'UN',
        productCode: product.productCode,
        barcode: product.barcode,
        ncm: product.ncm,
        cfop: product.cfop,
        taxSituationCode: product.taxSituationCode,
        cstIcms: product.cstIcms,
        fiscalType: product.fiscalType,
        aliqIcms: product.aliqIcms,
        aliqPis: product.aliqPis,
        aliqCofins: product.aliqCofins,
        imageUrl: product.imageUrl,
        sourceComandaNumber: activeNumber || undefined,
        sourceItemId,
        catalogProductId: product.id,
      }];
    });
  };

  const incrementItem = (id: string) => {
    setCartItems((prev) =>
      prev.map((i) => {
        if (i.id !== id) return i;
        const step = i.unit === 'KG' ? 0.1 : 1;
        return { ...i, quantity: Number((i.quantity + step).toFixed(3)) };
      })
    );
  };

  const requestRemoveItem = (id: string) => {
    const target = cartItems.find((item) => item.id === id);
    if (!target) {
      return;
    }

    const activeNumber = target.sourceComandaNumber?.trim() || comandaNumber.trim();
    setPendingAction({
      kind: 'REMOVE_ITEM',
      itemId: target.id,
      itemName: target.name,
      title: `Excluir produto ${target.name}?`,
      description: activeNumber
        ? `Deseja realmente excluir o produto "${target.name}" da comanda #${activeNumber}?`
        : `Deseja realmente excluir o produto "${target.name}" do carrinho?`
    });
  };

  const decrementItem = (id: string) => {
    const target = cartItems.find((item) => item.id === id);
    if (!target) {
      return;
    }

    const step = target.unit === 'KG' ? 0.1 : 1;
    if (target.quantity <= step) {
      requestRemoveItem(id);
      return;
    }

    setCartItems((prev) =>
      prev.map((item) => (
        item.id === id
          ? { ...item, quantity: Number((item.quantity - step).toFixed(3)) }
          : item
      ))
    );
  };

  const ensureComandaExistsInBackend = async (numero: string) => {
    const lookupResponse = await fetch(`${API_BASE}/api/v1/comandas/${encodeURIComponent(numero)}`);
    if (lookupResponse.ok) {
      return;
    }

    if (lookupResponse.status !== 404) {
      throw new Error('Falha ao consultar comanda no backend.');
    }

    const createResponse = await fetch(`${API_BASE}/api/v1/comandas`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ numero })
    });

    if (!createResponse.ok) {
      throw new Error('Falha ao criar comanda no backend antes do fechamento.');
    }
  };

  const closeComandaAtCashier = async (documentMode: PaymentDocumentMode, customerDocument = '') => {
    const numero = comandaNumber.trim();
    if (!numero) {
      showNotice(
        documentMode === 'ORCAMENTO'
          ? 'Venda avulsa fechada como orçamento não fiscal.'
          : 'Venda avulsa fechada como venda NFC-e.',
        'success'
      );
      return true;
    }

    const numeros = [...new Set([numero, ...joinedComandaNumbers].filter(Boolean))];

    try {
      await Promise.all(numeros.map(ensureComandaExistsInBackend));
    } catch {
      showNotice('Não foi possível preparar todas as comandas no backend. O pagamento não foi finalizado.', 'error');
      return false;
    }

    const closeResponse = await fetch(`${API_BASE}/api/v1/comandas/close-batch`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        numeros,
        documentMode,
        customerDocument: documentMode === 'NFCE' ? customerDocument.replace(/\D/g, '') : undefined,
        reason: numeros.length > 1 ? 'fechamento_comandas_unidas_caixa' : 'fechamento_caixa'
      })
    }).catch(() => null);

    if (!closeResponse?.ok) {
      const payload = closeResponse
        ? await closeResponse.json().catch(() => null) as { message?: string } | null
        : null;
      showNotice(
        payload?.message ?? 'Não foi possível fechar todas as comandas. A venda permanece na tela para uma nova tentativa.',
        'error'
      );
      return false;
    }

    for (const involvedNumber of numeros) {
      removeComandaCacheEntry(involvedNumber);
    }
    setOpenComandas((prev) => {
      const next = prev.filter((entry) => !numeros.includes(entry.numero));
      setOpenComandasCount(next.length);
      return next;
    });
    setClosedComandasCount((current) => current + numeros.length);
    await refreshComandaIndicators().catch(() => undefined);
    showNotice(
      documentMode === 'ORCAMENTO'
        ? `${numeros.length > 1 ? 'Comandas' : 'Comanda'} ${numeros.map((value) => `#${value}`).join(', ')} ${numeros.length > 1 ? 'fechadas' : 'fechada'} como orçamento não fiscal.`
        : `${numeros.length > 1 ? 'Comandas' : 'Comanda'} ${numeros.map((value) => `#${value}`).join(', ')} ${numeros.length > 1 ? 'fechadas' : 'fechada'} como venda NFC-e.`,
      'success'
    );
    return true;
  };

  const persistStandaloneCashierSale = async (documentMode: PaymentDocumentMode, payableTotal: number) => {
    if (comandaNumber.trim()) {
      return;
    }

    const closedAt = new Date();
    await ordersContainer.orderRepository.save({
      id: `venda-avulsa-${closedAt.getTime()}-${crypto.randomUUID()}`,
      table: documentMode === 'ORCAMENTO' ? 'Orçamento avulso' : 'Venda avulsa',
      status: 'ENTREGUE',
      items: cartItems.map((item) => ({
        id: item.id,
        productId: item.catalogProductId ?? item.productCode ?? item.id,
        productName: item.name,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        byWeight: item.unit === 'KG',
        weight: item.unit === 'KG' ? item.quantity : undefined
      })),
      total: Number(payableTotal.toFixed(2)),
      version: 1,
      createdAt: closedAt,
      updatedAt: closedAt,
      lastSyncedAt: closedAt,
      createdBy: user?.name ?? user?.role ?? 'CAIXA'
    });
  };

  const persistCashierPaymentMovements = async (
    payments: PaymentEntry[],
    documentMode: PaymentDocumentMode,
    atendimentoLabel: string
  ) => {
    const launchedAt = new Date();

    await Promise.all(
      payments
        .filter((payment) => payment.amount > 0)
        .map((payment, index) => {
          const methodLabel = payment.label || CASHIER_PAYMENT_SUMMARY_LABELS.find((item) => item.method === payment.method)?.label || payment.method;
          const normalizedMethod = methodLabel.toUpperCase();

          return financeContainer.createCashMovement.execute({
            id: `mov-venda-${launchedAt.getTime()}-${index}-${crypto.randomUUID()}`,
            movementCode: `V-${String(launchedAt.getTime()).slice(-8)}-${index + 1}`,
            movementType: 'ENTRADA',
            category: normalizedMethod,
            amount: Number(payment.amount.toFixed(2)),
            description: `${documentMode === 'NFCE' ? 'Venda NFC-e' : 'Orçamento'} ${atendimentoLabel} - ${methodLabel}`,
            launchedAt,
            paymentMethod: methodLabel
          });
        })
    );
  };

  const handlePaymentConfirm = async ({ payments, fiadoClientId, discountAmount, documentMode, customerDocument }: PaymentConfirmPayload) => {
    if (!ensureCashierOpen('finalizar pagamento')) {
      return;
    }

    const currentComandaNumber = [comandaNumber.trim(), ...joinedComandaNumbers]
      .filter(Boolean)
      .map((numero) => `#${numero}`)
      .join(' + ') || 'avulso';
    const payableTotal = Math.max(0, subtotal - discountAmount);
    const isFiadoFlow = Boolean(fiadoClientId) || payments.some((payment) => payment.method === 'FIADO');
    const finalDocumentMode: PaymentDocumentMode = isFiadoFlow ? 'ORCAMENTO' : documentMode;

    if (finalDocumentMode === 'NFCE') {
      const fiscalErrors = validateFiscalItemsForNfce(cartItems);
      if (fiscalErrors.length > 0) {
        const visibleErrors = fiscalErrors.slice(0, 3).join(' | ');
        const hiddenCount = fiscalErrors.length - 3;
        showNotice(
          `NFC-e bloqueada. Corrija o cadastro fiscal dos produtos: ${visibleErrors}${hiddenCount > 0 ? ` e mais ${hiddenCount} item(ns)` : ''}.`,
          'error'
        );
        return;
      }
    }

    const closed = await closeComandaAtCashier(finalDocumentMode, customerDocument);
    if (!closed) {
      return;
    }

    await persistStandaloneCashierSale(finalDocumentMode, payableTotal);
    await persistCashierPaymentMovements(payments, finalDocumentMode, currentComandaNumber);
    accumulateSaleInCashierSession(payments, payableTotal);
    window.dispatchEvent(new CustomEvent('pdv.dashboard-refresh'));

    if (isFiadoFlow) {
      const clientId = fiadoClientId;
      if (clientId) {
        const targetClient = clients.find((client) => client.id === clientId)
          ?? await clientsContainer.clientRepository.findById(clientId);

        if (targetClient) {
          const launchedAt = formatLaunchDateTime(new Date());
          const discountNote = discountAmount > 0 ? ` - Desconto R$ ${discountAmount.toFixed(2)}` : '';
          const entryDescription = `Fiado atendimento ${currentComandaNumber} - Total R$ ${payableTotal.toFixed(2)}${discountNote} - Orçamento não fiscal`;

          const updatedClient = {
            ...targetClient,
            consumptionHistory: [
              {
                id: `entry-${crypto.randomUUID()}`,
                description: entryDescription,
                launchedAt
              },
              ...targetClient.consumptionHistory
            ],
            version: targetClient.version + 1,
            updatedAt: new Date()
          };

          await clientsContainer.clientRepository.save(updatedClient);
          setClients((prev) => {
            const exists = prev.some((client) => client.id === updatedClient.id);
            if (!exists) {
              return [updatedClient, ...prev];
            }

            return prev.map((client) => (client.id === updatedClient.id ? updatedClient : client));
          });
        }
      }

      setCartItems([]);
      setComandaNumber('');
      setJoinedComandaNumbers([]);
      setQuery('');
      setView('pos');
      focusProductSearchInput();
      return;
    }

    printReceipt(payments, discountAmount, finalDocumentMode, customerDocument);
    setCartItems([]);
    setComandaNumber('');
    setJoinedComandaNumbers([]);
    setQuery('');
    setView('pos');
    focusProductSearchInput();
  };
  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="pdv-caixa-root flex flex-col h-full w-full overflow-hidden bg-[#f5f8fb]">

      <header className="min-h-[5.5rem] bg-white border-b border-slate-200 px-6 py-3 shrink-0 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-sky-500 to-cyan-500" />
            <div className="flex flex-col justify-center">
              <p className="text-3xl leading-tight font-extrabold text-slate-800">PDV <span className="text-sky-600">Touch</span></p>
              <p className="mt-0.5 text-xs leading-tight text-slate-500 tracking-wide">Sistema de Gestão</p>
            </div>
          </div>
          <div className="h-10 w-px bg-slate-200" />
          <div className="grid grid-cols-2 gap-4">
            <div className="relative">
              <button
                type="button"
                onClick={() => setIsOpenComandasPanelOpen((prev) => !prev)}
                className="text-left"
              >
                <p className="text-xs uppercase tracking-wide text-slate-500">Comandas abertas</p>
                <p className="text-4xl font-black text-sky-600 leading-none">{openComandasCount.toLocaleString('pt-BR')}</p>
              </button>

              {isOpenComandasPanelOpen && (
                <div className="absolute left-0 top-full z-20 mt-2 w-80 rounded-xl border border-slate-200 bg-white p-3 shadow-xl">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{isCancelSelectionMode ? 'Selecione a comanda para cancelar' : 'Comandas abertas no sistema'}</p>

                  {openComandas.length === 0 ? (
                    <p className="mt-3 text-sm text-slate-500">Nenhuma comanda aberta no momento.</p>
                  ) : (
                    <ul className="mt-3 max-h-72 space-y-2 overflow-y-auto pr-1">
                      {openComandas.map((entry) => (
                        <li key={`${entry.origem}-${entry.numero}`}>
                          <div className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2">
                            <button
                              type="button"
                              onClick={() => {
                                void loadComandaIntoCashier(entry.numero);
                                setIsOpenComandasPanelOpen(false);
                              }}
                              className="flex flex-1 items-center justify-between text-left hover:text-sky-700"
                            >
                              <span className="text-sm font-semibold text-slate-700">#{entry.numero}</span>
                              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">
                                {entry.origem === 'BALANCA' ? 'Balança' : 'Caixa'}
                              </span>
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                requestCancelComanda(entry.numero);
                                setIsCancelSelectionMode(false);
                              }}
                              className="min-h-[44px] rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-100"
                            >
                              Cancelar
                            </button>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>
            <div className="flex items-start gap-2">
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-500">Comandas fechadas</p>
                <p className="text-4xl font-black text-sky-600 leading-none">{closedComandasCount.toLocaleString('pt-BR')}</p>
              </div>
              <button
                type="button"
                onClick={leaveCurrentComandaOpen}
                disabled={!hasActiveComanda}
                aria-label="Manter comanda aberta"
                title="Manter comanda aberta (Ctrl+X)"
                className="
                  inline-flex h-11 w-11 items-center justify-center rounded-xl border border-sky-200
                  bg-sky-50 text-sky-700 shadow-sm transition-colors
                  hover:border-sky-300 hover:bg-sky-100
                  disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-50 disabled:text-slate-300
                "
              >
                <CornerUpLeft size={18} aria-hidden="true" />
              </button>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-6 text-slate-600">
          <div className={`rounded-xl border px-3 py-2 ${isCashierOpen ? 'border-emerald-200 bg-emerald-50' : 'border-orange-200 bg-orange-50'}`}>
            <p className="text-[11px] uppercase tracking-wide text-slate-500">Status do caixa</p>
            <p className={`text-base font-bold leading-tight ${isCashierOpen ? 'text-emerald-700' : 'text-orange-700'}`}>
              {isCashierOpen ? 'Aberto' : 'Fechado'}
            </p>
          </div>
          <div className="rounded-xl border border-sky-200 bg-sky-50 px-3 py-2">
            <p className="text-[11px] uppercase tracking-wide text-slate-500">Comanda ativa</p>
            <p className="text-base font-bold leading-tight text-sky-700">{hasActiveComanda ? `#${activeComandaLabel}` : activeComandaLabel}</p>
          </div>
          <div className="flex items-center gap-2">
            <UserRound size={20} className="text-sky-600" />
            <div>
              <p className="text-xs leading-tight text-slate-500">Operador</p>
              <p className="text-sm font-semibold leading-tight">{user?.name ?? 'Não autenticado'}</p>
            </div>
          </div>
          <div className="h-8 w-px bg-slate-200" />
          <div className="flex items-center gap-2">
            <Clock3 size={18} className="text-sky-600" />
            <div>
              <p className="text-sm leading-tight font-medium">{now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</p>
              <p className="text-xs leading-tight text-slate-500">{now.toLocaleDateString('pt-BR')}</p>
            </div>
          </div>
          <div className="h-8 w-px bg-slate-200" />
          <button type="button" onClick={signOut} className="inline-flex items-center gap-2 text-sky-600 font-semibold hover:text-sky-700">
            <LogOut size={18} />
            Sair
          </button>
        </div>
      </header>

      {(notice || pendingAction) && (
        <section className="shrink-0 border-b border-slate-200 bg-white px-5 py-2 space-y-2">
          {notice && (
            <div className={`flex items-center justify-between gap-3 rounded-lg border px-3 py-2 text-sm ${NOTICE_TONE_CLASSES[notice.tone]}`}>
              <span>{notice.message}</span>
              <button
                type="button"
                onClick={() => setNotice(null)}
                className="min-h-[44px] rounded-lg px-3 text-xs font-bold hover:bg-white/60"
              >
                Fechar
              </button>
            </div>
          )}

          {pendingAction && (
            <div className="flex items-center justify-between gap-3 rounded-lg border border-orange-200 bg-orange-50 px-3 py-2 text-sm text-orange-900">
              <div>
                <p className="font-bold">{pendingAction.title}</p>
                <p className="text-xs text-orange-800">{pendingAction.description}</p>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setPendingAction(null)}
                  className="min-h-[44px] rounded-lg border border-orange-200 bg-white px-3 text-xs font-bold text-orange-700 hover:bg-orange-100"
                >
                  Voltar
                </button>
                <button
                  type="button"
                  onClick={confirmPendingAction}
                  className="min-h-[44px] rounded-lg bg-red-600 px-3 text-xs font-bold text-white hover:bg-red-700"
                >
                  Confirmar
                </button>
              </div>
            </div>
          )}

        </section>
      )}

      <div className="flex flex-1 min-h-0 overflow-hidden">

      {/* ── LEFT 60%: busca + categorias + grid ────────────────────────────── */}
      <main className="w-[60%] relative bg-slate-50/80 flex flex-col overflow-hidden border-r border-slate-200">

        {!isCashierOpen ? (
          <section className="flex flex-1 items-center justify-center px-6 py-8">
            <div className="w-full max-w-xl rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-orange-50 text-orange-600">
                <LockKeyhole size={32} aria-hidden="true" />
              </div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-orange-600">Caixa fechado</p>
              <h2 className="mt-2 text-3xl font-extrabold text-slate-900">Abra o caixa para operar</h2>
              <p className="mx-auto mt-2 max-w-md text-sm text-slate-500">
                Nenhuma venda, comanda, pagamento ou lançamento operacional é liberado enquanto o caixa estiver fechado.
              </p>
              {cashierSession.closedAt && (
                <p className="mt-3 text-xs font-semibold text-slate-500">
                  Último fechamento: {new Date(cashierSession.closedAt).toLocaleString('pt-BR')}
                </p>
              )}
              <button
                type="button"
                onClick={handleOpenCashier}
                className="mt-6 inline-flex min-h-[56px] w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 px-5 text-base font-extrabold text-white shadow-sm transition-colors hover:bg-emerald-600"
              >
                <Power size={20} aria-hidden="true" />
                Abrir caixa
              </button>
            </div>
          </section>
        ) : view === 'payment' ? (
          <PaymentPanel
            total={subtotal}
            items={cartItems}
            initialDocumentMode={paymentDocumentMode}
            onConfirm={handlePaymentConfirm}
            onBack={() => setView('pos')}
          />
        ) : (
          <>
            {/* ── SmartInput ─────────────────────────────────────── */}
            <div className="px-5 pt-5 pb-3 shrink-0">
              <SmartInput
                value={query}
                onChange={setQuery}
                onSubmit={handleSmartInputSubmit}
                keepFocused
                placeholder={isJoinMode
                  ? `Juntar com a #${comandaNumber}: digite ou leia outra comanda e pressione Enter`
                  : comandaNumber.trim()
                    ? 'Digite para buscar produto e pressione Enter para adicionar'
                    : 'Digite produto, código ou comanda e pressione Enter'}
              />
            </div>

            {isCashierKeyboardVisible && (
              <CashierVirtualKeyboard
                onKeyPress={handleCashierVirtualKeyboardKeyPress}
                enterLabel={comandaNumber.trim() && !isJoinMode ? 'Adicionar' : 'Enter'}
                onClose={() => {
                  setIsCashierKeyboardVisible(false);
                  focusProductSearchInput();
                }}
              />
            )}

            {/* ── CategoryTabs ───────────────────────────────────── */}
            <div className="px-5 pb-3 shrink-0">
              <CategoryTabs
                categories={dynamicCategories}
                selected={activeCategory}
                onSelect={(c) => { setActiveCategory(c); setQuery(''); }}
              />
            </div>

            {/* ── ProductGrid — área com scroll ───────────────────── */}
            <div className="flex-1 overflow-y-auto px-4 pb-4">
              <ProductGrid
                products={filteredProducts}
                onAdd={addProduct}
                onToggleUnavailable={handleToggleUnavailable}
                onToggleHidden={handleToggleHidden}
              />
            </div>
          </>
        )}
      </main>

      {/* ── RIGHT 40%: carrinho + footer ───────────────────────────────────── */}
      <aside className="w-[40%] bg-white flex flex-col overflow-hidden">
        <CartPanel
          items={cartItems}
          comandaNumber={comandaNumber}
          joinedComandaNumbers={joinedComandaNumbers}
          onIncrement={incrementItem}
          onDecrement={decrementItem}
          onRemove={requestRemoveItem}
          onRefreshComanda={refreshCurrentComanda}
          isComandaSyncing={isComandaItemsSyncing}
          onReceive={() => openPayment('ORCAMENTO')}
          onCashClose={() => openCashCloseSpan('MENU', 'INICIO')}
        />
      </aside>

      </div>

      {isCashCloseSpanOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-4">
          <div className="max-h-[92vh] w-full max-w-6xl overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-slate-50 px-4 py-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Turno em andamento</p>
                <p className="text-sm text-slate-600">
                  {cashierSession.openedAt
                    ? `Aberto em ${new Date(cashierSession.openedAt).toLocaleString('pt-BR')}`
                    : 'Caixa aberto'}
                </p>
                <p className="mt-1 text-xs font-semibold text-slate-500">Pressione ESC para voltar ao Caixa.</p>
              </div>
              <div className="grid w-full max-w-3xl grid-cols-1 gap-3 text-right sm:grid-cols-[1.3fr_0.7fr]">
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2">
                  <p className="text-[11px] font-bold uppercase tracking-wide text-emerald-700">Venda total do turno</p>
                  <p className="text-xl font-extrabold text-emerald-800">
                    {formatCashierCurrency(cashierSession.totalSales)}
                  </p>
                </div>
                <div className="rounded-xl border border-sky-200 bg-sky-50 px-4 py-2">
                  <p className="text-[11px] font-bold uppercase tracking-wide text-sky-700">Atendimentos</p>
                  <p className="text-xl font-extrabold text-sky-800">{cashierSession.attendanceCount}</p>
                </div>
                <div className="grid grid-cols-2 gap-2 text-left sm:col-span-2 sm:grid-cols-3">
                  {CASHIER_PAYMENT_SUMMARY_LABELS.map(({ method, label }) => (
                    <div key={method} className="rounded-lg border border-slate-200 bg-white px-3 py-2">
                      <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">{label}</p>
                      <p className="text-sm font-extrabold text-slate-800">
                        {formatCashierCurrency(cashierSession.expectedTotals[method] ?? 0)}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <CashRegisterClose
              initialTab={cashCloseInitialTab}
              initialSection={cashCloseInitialSection}
              onGoToProductSearch={openProductSearch}
              onReprintReceipt={() => notifyFeaturePending('Reimprimir cupom')}
              onSendFiscalFiles={() => notifyFeaturePending('Enviar arquivos fiscais')}
              onConsultStock={() => notifyFeaturePending('Consultar estoque')}
              onCancelLastSale={handleCancelLastSale}
              onCancelCoupons={handleCancelCoupons}
              onClearComandaCache={handleClearComandaCache}
              loadExpectedTotals={loadCashCloseExpectedTotals}
              onBack={() => setIsCashCloseSpanOpen(false)}
              onClose={() => {
                void handleCashClose();
              }}
              items={cartItems}
            />
          </div>
        </div>
      )}

      <AboutSystemButton position="left" />

    </div>
  );
}
