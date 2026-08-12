// ─── CaixaPage — PDV Touch ────────────────────────────────────────────────────
// Layout 60/40 | Tailwind CSS | Lucide React
// Sem modais para fluxos básicos; PaymentPanel desliza sobre a zona esquerda.
// ─────────────────────────────────────────────────────────────────────────────

import '@/modules/cashier/caixa.css';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Clock3, LogOut, UserRound } from 'lucide-react';
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
import { useClientsQuery } from '@/modules/clients/presentation/hooks/useClientsQuery';
import { clientsContainer } from '@/modules/clients/infrastructure/container/clientsContainer';
import type { ItemComanda } from '@/types/comanda';
import {
  fetchComandaItemsFromBackend,
  saveComandaItemsToBackend
} from '@/shared/infrastructure/api/comandaApi';
import {
  clearComandaCache,
  listOpenComandaNumbers,
  readComandaItems,
  removeComandaCacheEntry,
  COMANDA_CANCELLED_STORAGE_KEY,
  upsertComandaItems
} from '@/shared/infrastructure/storage/comandaCache';

// ─────────────────────────────────────────────────────────────────────────────
// CashierPage — tela de caixa unificada
// ─────────────────────────────────────────────────────────────────────────────

type View = 'pos' | 'payment' | 'cashclose';
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
  updated_at?: string;
};

type ActiveComandaEntry = {
  numero: string;
  origem: 'BALANCA' | 'CAIXA';
  status?: HeaderComandaStatus;
};

type CashierSession = {
  isOpen: boolean;
  sequence: number;
  openedAt: string;
  openedBy: string;
};

type CashierNotice = {
  tone: 'info' | 'success' | 'warning' | 'error';
  message: string;
};

type CancelledComandaEntry = {
  cancelledAt: string;
  reason: string;
};

type PendingCashierAction =
  | {
      kind: 'CANCEL_COMANDA';
      numero: string;
      title: string;
      description: string;
    }
  | {
      kind: 'REMOVE_ITEM';
      itemId: string;
      title: string;
      description: string;
    }
  | {
      kind: 'CLEAR_COMANDA_CACHE';
      title: string;
      description: string;
    };

const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:3001';
const CASHIER_SESSION_STORAGE_KEY = 'pdv.cashier.active-session';
const NON_OPEN_COMANDA_STATUSES: HeaderComandaStatus[] = ['FECHADA_ORCAMENTO', 'FECHADA_VENDA', 'CANCELADA', 'ARQUIVADA'];
const COUNTABLE_CLOSED_COMANDA_STATUSES: HeaderComandaStatus[] = ['FECHADA_ORCAMENTO', 'FECHADA_VENDA', 'CANCELADA'];
const NOTICE_TONE_CLASSES: Record<CashierNotice['tone'], string> = {
  info: 'border-sky-200 bg-sky-50 text-sky-800',
  success: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  warning: 'border-orange-200 bg-orange-50 text-orange-800',
  error: 'border-red-200 bg-red-50 text-red-800'
};

const readCashierSession = (): CashierSession | null => {
  try {
    const raw = window.localStorage.getItem(CASHIER_SESSION_STORAGE_KEY);
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as Partial<CashierSession>;
    if (parsed.isOpen !== true || !parsed.openedAt) {
      return null;
    }

    return {
      isOpen: true,
      sequence: Number(parsed.sequence ?? 1),
      openedAt: String(parsed.openedAt),
      openedBy: String(parsed.openedBy ?? 'Operador')
    };
  } catch {
    return null;
  }
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

const formatLaunchDateTime = (date: Date) =>
  date.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

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

const mergeOpenComandas = (backendComandas: HeaderComandaRecord[]) => {
  const entries = new Map<string, ActiveComandaEntry>();

  for (const comanda of backendComandas) {
    if (NON_OPEN_COMANDA_STATUSES.includes(comanda.status)) {
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

const mapComandaItemsToCashierCart = (items: ItemComanda[], catalog: CashierProduct[], sourceComanda?: string): CashierCartItem[] => {
  return items.map((item) => {
    const matchedProduct = catalog.find((product) => normalizeSearchText(product.name) === normalizeSearchText(item.nome));

    return {
      id: item.id,
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
      fiscalType: matchedProduct?.fiscalType,
      imageUrl: matchedProduct?.imageUrl,
      sourceComanda,
      source: sourceComanda ? 'BALANCA' : undefined
    };
  });
};

const mapCashierCartToComandaItems = (items: CashierCartItem[]): ItemComanda[] =>
  items.map((item) => ({
    id: item.id,
    nome: item.name,
    precoUnitario: item.unitPrice,
    quantidade: item.quantity,
    categoriaId: 'CAIXA',
    subtotal: Number((item.quantity * item.unitPrice).toFixed(2)),
    porUnidade: item.unit === 'UN',
    peso: item.unit === 'KG' ? item.quantity : undefined
  }));

const persistCashierItemsToComanda = (numero: string, items: CashierCartItem[]) => {
  if (!numero.trim()) {
    return;
  }

  const scopedItems = items.filter((item) => !item.sourceComanda || item.sourceComanda === numero);
  upsertComandaItems(numero, mapCashierCartToComandaItems(scopedItems));
};

const normalizeComandaNumber = (numero: string) => {
  const trimmed = numero.trim();
  if (!/^\d{1,12}$/.test(trimmed)) {
    return trimmed;
  }

  return String(Number(trimmed));
};

const getBackendUpdatedAt = (record: HeaderComandaRecord) =>
  record.updatedAt ?? record.updated_at ?? null;

const isBackendNewerThanCancel = (record: HeaderComandaRecord, cancel: CancelledComandaEntry) => {
  const backendUpdatedAt = getBackendUpdatedAt(record);
  if (!backendUpdatedAt) {
    return false;
  }

  return new Date(backendUpdatedAt).getTime() > new Date(cancel.cancelledAt).getTime();
};

const getActiveComandaNumbers = (numero: string, joined: string[]) => {
  const numbers = [numero, ...joined]
    .map((item) => normalizeComandaNumber(item))
    .filter(Boolean);

  return [...new Set(numbers)];
};

const readCancelledComandas = (): Record<string, CancelledComandaEntry> => {
  try {
    const raw = window.localStorage.getItem(COMANDA_CANCELLED_STORAGE_KEY);
    if (!raw) {
      return {};
    }

    const parsed = JSON.parse(raw) as Record<string, CancelledComandaEntry>;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
};

const writeCancelledComandas = (items: Record<string, CancelledComandaEntry>) => {
  const entries = Object.entries(items);
  if (entries.length === 0) {
    window.localStorage.removeItem(COMANDA_CANCELLED_STORAGE_KEY);
    return;
  }

  window.localStorage.setItem(COMANDA_CANCELLED_STORAGE_KEY, JSON.stringify(Object.fromEntries(entries)));
};

const extractComandaNumber = (raw: string) => {
  const input = raw.trim();
  if (!input) {
    return null;
  }

  const explicitTagMatch = input.match(/^(?:comanda|cmd|mesa|balanca)\s*[:#-]?\s*(\d{1,12})$/i);
  if (explicitTagMatch) {
    return normalizeComandaNumber(explicitTagMatch[1]);
  }

  const digitsOnly = input.match(/^\d{1,12}$/);
  if (digitsOnly) {
    return normalizeComandaNumber(digitsOnly[0]);
  }

  return null;
};

export function CashierPage() {
  const { user, signOut } = useAuth();
  const { products, setProducts } = useProductsQuery();
  const { clients, setClients } = useClientsQuery();
  const [cashierSession, setCashierSession] = useState<CashierSession | null>(() => readCashierSession());
  const [view, setView]                     = useState<View>('pos');
  const [cashCloseInitialTab, setCashCloseInitialTab] = useState<CashCloseTab>('MENU');
  const [cashCloseInitialSection, setCashCloseInitialSection] = useState<CashCloseSection>('INICIO');
  const [query, setQuery]                   = useState('');
  const [activeCategory, setActiveCategory] = useState('Todos');
  const [comandaNumber, setComandaNumber]   = useState('');
  const [cartItems, setCartItems]           = useState<CashierCartItem[]>([]);
  const [openComandasCount, setOpenComandasCount] = useState(0);
  const [closedComandasCount, setClosedComandasCount] = useState(0);
  const [openComandas, setOpenComandas] = useState<ActiveComandaEntry[]>([]);
  const [isOpenComandasPanelOpen, setIsOpenComandasPanelOpen] = useState(false);
  const [notice, setNotice] = useState<CashierNotice | null>(null);
  const [pendingAction, setPendingAction] = useState<PendingCashierAction | null>(null);
  const [isCancelSelectionMode, setIsCancelSelectionMode] = useState(false);
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);
  const [isJoinMode, setIsJoinMode] = useState(false);
  const [joinedComandas, setJoinedComandas] = useState<string[]>([]);
  const [paymentInitialDocumentMode, setPaymentInitialDocumentMode] = useState<PaymentDocumentMode>('ORCAMENTO');
  const [isComandaSyncing, setIsComandaSyncing] = useState(false);
  const isLoadingComandaRef = useRef(false);
  const skipNextComandaSyncRef = useRef(false);
  const isCashierOpen = cashierSession?.isOpen === true;
  const activeComandas = useMemo(() => getActiveComandaNumbers(comandaNumber, joinedComandas), [comandaNumber, joinedComandas]);
  const hasActiveComanda = activeComandas.length > 0;
  const activeComandaLabel = activeComandas.length > 1
    ? `Comandas #${activeComandas.join(' + #')}`
    : activeComandas.length === 1
      ? `#${activeComandas[0]}`
      : 'Sem comanda';
  const smartInputPlaceholder = isJoinMode && activeComandas.length > 0
    ? `Juntar com a #${activeComandas[0]}: digite ou leia outra comanda e pressione Enter`
    : isKeyboardVisible
      ? 'Digite para buscar produto e pressione Enter para adicionar'
      : 'Digite produto, código ou comanda e pressione Enter';

  const showNotice = (message: string, tone: CashierNotice['tone'] = 'info') => {
    setNotice({ message, tone });
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

  const cancelComanda = async (numero: string) => {
    const trimmed = normalizeComandaNumber(numero);
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

    if (!backendCancelled) {
      const cancelled = readCancelledComandas();
      cancelled[trimmed] = { cancelledAt: new Date().toISOString(), reason: 'cancelada_localmente_no_caixa' };
      writeCancelledComandas(cancelled);
    }

    removeComandaCacheEntry(trimmed);
    setCartItems((currentItems) => (comandaNumber.trim() === trimmed ? [] : currentItems));
    setOpenComandas((prev) => {
      const next = prev.filter((entry) => entry.numero !== trimmed);
      setOpenComandasCount(next.length);
      return next;
    });

    if (comandaNumber.trim() === trimmed) {
      setComandaNumber('');
      setJoinedComandas([]);
      setIsJoinMode(false);
      setQuery('');
      setView('pos');
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
      description: 'Essa acao remove a comanda da operacao do caixa e registra o cancelamento quando o backend estiver disponivel.'
    });
  };

  const clearComandaCacheNow = () => {
    clearComandaCache();
    setOpenComandas([]);
    setOpenComandasCount(0);
    setCartItems([]);
    setComandaNumber('');
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
      setCartItems((prev) => prev.filter((item) => item.id !== action.itemId));
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
      showNotice('Nao ha comandas abertas para cancelar.', 'warning');
      return;
    }

    setIsCancelSelectionMode(true);
    setIsOpenComandasPanelOpen(true);
    showNotice('Selecione uma comanda aberta na lista e confirme o cancelamento.', 'info');
  };
  const loadComandaIntoCashier = async (numero: string) => {
    const trimmed = normalizeComandaNumber(numero);
    if (!trimmed) {
      return;
    }

    const cancelled = readCancelledComandas();
    const localCancel = cancelled[trimmed];
    if (localCancel) {
      try {
        const response = await fetch(API_BASE + '/api/v1/comandas/' + encodeURIComponent(trimmed));
        const payload = (await response.json().catch(() => null)) as { comanda?: HeaderComandaRecord } | HeaderComandaRecord | null;
        const backendComanda = payload && 'comanda' in payload ? payload.comanda : payload;
        if (response.ok && backendComanda && isBackendNewerThanCancel(backendComanda as HeaderComandaRecord, localCancel)) {
          delete cancelled[trimmed];
          writeCancelledComandas(cancelled);
        } else {
          showNotice('Comanda #' + trimmed + ' está cancelada localmente e não pode ser aberta no caixa.', 'warning');
          setQuery('');
          focusProductSearchInput();
          return;
        }
      } catch {
        showNotice('Comanda #' + trimmed + ' está cancelada localmente e não pode ser aberta no caixa.', 'warning');
        setQuery('');
        focusProductSearchInput();
        return;
      }
    }

    isLoadingComandaRef.current = true;
    skipNextComandaSyncRef.current = true;
    try {
      const backendItems = await fetchComandaItemsFromBackend(trimmed);
      setCartItems(mapComandaItemsToCashierCart(backendItems, catalogProducts, trimmed));
      upsertComandaItems(trimmed, backendItems);
    } catch {
      setCartItems(mapComandaItemsToCashierCart(readComandaItems(trimmed), catalogProducts, trimmed));
      showNotice('Comanda #' + trimmed + ' carregada do cache local. Backend indisponivel para itens.', 'warning');
    }

    setComandaNumber(trimmed);
    setJoinedComandas([trimmed]);
    setOpenComandas((prev) => {
      if (prev.some((entry) => entry.numero === trimmed)) {
        return prev;
      }

      const next = sortComandasByNumero([
        ...prev,
        { numero: trimmed, origem: 'CAIXA' }
      ]);
      setOpenComandasCount(next.length);
      return next;
    });
    setQuery('');
    focusProductSearchInput();
    window.setTimeout(() => {
      isLoadingComandaRef.current = false;
      skipNextComandaSyncRef.current = false;
    }, 0);
  };

  const handleSmartInputSubmit = (rawValue: string) => {
    const comandaFromInput = extractComandaNumber(rawValue);
    if (isJoinMode) {
      if (comandaFromInput) {
        const currentActive = getActiveComandaNumbers(comandaNumber, joinedComandas);
        if (currentActive.includes(comandaFromInput)) {
          showNotice('Comanda #' + comandaFromInput + ' já está na junção.', 'warning');
          setQuery('');
          return;
        }

        isLoadingComandaRef.current = true;
        skipNextComandaSyncRef.current = true;
        void (async () => {
          try {
            const backendItems = await fetchComandaItemsFromBackend(comandaFromInput);
            setCartItems((prev) => [
              ...prev.filter((item) => item.sourceComanda !== comandaFromInput),
              ...mapComandaItemsToCashierCart(backendItems, catalogProducts, comandaFromInput)
            ]);
            upsertComandaItems(comandaFromInput, backendItems);
          } catch {
            setCartItems((prev) => [
              ...prev.filter((item) => item.sourceComanda !== comandaFromInput),
              ...mapComandaItemsToCashierCart(readComandaItems(comandaFromInput), catalogProducts, comandaFromInput)
            ]);
            showNotice('Comanda #' + comandaFromInput + ' carregada do cache local. Backend indisponivel para itens.', 'warning');
          } finally {
            setJoinedComandas((prev) => [...new Set([...currentActive, ...prev, comandaFromInput])]);
            setOpenComandas((prev) => {
              if (prev.some((entry) => entry.numero === comandaFromInput)) {
                return prev;
              }
              const next = sortComandasByNumero([...prev, { numero: comandaFromInput, origem: 'CAIXA' }]);
              setOpenComandasCount(next.length);
              return next;
            });
            setQuery('');
            focusProductSearchInput();
            window.setTimeout(() => {
              isLoadingComandaRef.current = false;
              skipNextComandaSyncRef.current = false;
            }, 0);
          }
        })();
      }
      return;
    }

    if (comandaFromInput) {
      void loadComandaIntoCashier(comandaFromInput);
      return;
    }

    const q = normalizeSearchText(rawValue.trim());
    if (!q) {
      return;
    }

    const product = filteredProducts.find((candidate) => {
      const haystack = normalizeSearchText([candidate.name, candidate.productCode ?? '', candidate.barcode ?? ''].join(' '));
      return haystack.includes(q);
    });

    if (product) {
      addProduct(product);
      setQuery('');
    }
  };

  const refreshCurrentComanda = () => {
    const currentNumbers = getActiveComandaNumbers(comandaNumber, joinedComandas);
    if (currentNumbers.length === 0) {
      return;
    }

    if (isComandaSyncing) {
      return;
    }

    if (currentNumbers.length === 1) {
      void loadComandaIntoCashier(currentNumbers[0]);
      return;
    }

    setIsJoinMode(true);
    currentNumbers.forEach((numero) => handleSmartInputSubmit(numero));
  };

  const handleLeaveComandaOpen = async () => {
    const currentNumbers = getActiveComandaNumbers(comandaNumber, joinedComandas);
    if (currentNumbers.length === 0) {
      showNotice('Nenhuma comanda aberta para manter em atendimento.', 'warning');
      return;
    }

    await Promise.all(
      currentNumbers.map(async (numero) => {
        const scopedItems = cartItems.filter((item) => !item.sourceComanda || item.sourceComanda === numero);
        const comandaItems = mapCashierCartToComandaItems(scopedItems);
        upsertComandaItems(numero, comandaItems);

        try {
          await saveComandaItemsToBackend(numero, comandaItems, 'caixa_leave_open');
        } catch {
          // Cache local preserva a comanda quando o backend estiver temporariamente indisponivel.
        }
      })
    );

    setCartItems([]);
    setComandaNumber('');
    setJoinedComandas([]);
    setIsJoinMode(false);
    setQuery('');
    setView('pos');
    focusProductSearchInput();
    showNotice(
      currentNumbers.length === 1
        ? `Comanda #${currentNumbers[0]} mantida aberta para continuar o atendimento.`
        : `Comandas #${currentNumbers.join(', #')} mantidas abertas para continuar o atendimento.`,
      'success'
    );
  };

  const openPaymentWithMode = (documentMode: PaymentDocumentMode) => {
    if (cartItems.length === 0) {
      return;
    }

    setPaymentInitialDocumentMode(documentMode);
    setView('payment');
  };

  const handleVirtualKeyboardKey = (key: string) => {
    if (key === 'Backspace') {
      setQuery((prev) => prev.slice(0, -1));
      focusProductSearchInput();
      return;
    }

    if (key === 'Clear') {
      setQuery('');
      focusProductSearchInput();
      return;
    }

    if (key === 'Enter') {
      handleSmartInputSubmit(query);
      focusProductSearchInput();
      return;
    }

    setQuery((prev) => `${prev}${key}`);
    focusProductSearchInput();
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
      description: 'Essa acao remove os snapshots locais do caixa. Use apenas quando a fila local estiver inconsistente.'
    });
  };

  const handleOpenCashier = () => {
    const session: CashierSession = {
      isOpen: true,
      sequence: Number(cashierSession?.sequence ?? 0) + 1,
      openedAt: new Date().toISOString(),
      openedBy: user?.name ?? 'Operador'
    };

    window.localStorage.setItem(CASHIER_SESSION_STORAGE_KEY, JSON.stringify(session));
    setCashierSession(session);
    setView('pos');
    showNotice('Caixa aberto. As operações de venda estão liberadas.', 'success');
    focusProductSearchInput();
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
    const totalClosed = payload.comandas.filter((comanda) => COUNTABLE_CLOSED_COMANDA_STATUSES.includes(comanda.status)).length;

    for (const closedComanda of payload.comandas.filter((comanda) => NON_OPEN_COMANDA_STATUSES.includes(comanda.status))) {
      removeComandaCacheEntry(closedComanda.numero);
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
    try {
      const response = await fetch(`${API_BASE}/api/v1/caixa/expected-totals`);
      if (response.ok) {
        const payload = (await response.json()) as { expectedTotals?: Record<string, number> };
        if (payload.expectedTotals) {
          return payload.expectedTotals;
        }
      }
    } catch {
      // Endpoint ainda nao existe no MVP; fechamento cego continua sem mockar valores.
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

  const handleCashClose = async () => {
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

    await refreshComandaIndicators().catch(() => {
      setClosedComandasCount(0);
    });
    window.localStorage.removeItem(CASHIER_SESSION_STORAGE_KEY);
    setCashierSession(null);
    setCartItems([]);
    setComandaNumber('');
    setView('pos');
  };

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'F11') {
        // F11 abre fullscreen no navegador; aqui priorizamos atalho operacional do caixa.
        event.preventDefault();
        setCashCloseInitialTab('FECHAMENTO');
        setCashCloseInitialSection('INICIO');
        setView('cashclose');
        return;
      }

      if (event.key === 'F4') {
        event.preventDefault();
        setCashCloseInitialTab('ADMINISTRATIVO');
        setCashCloseInitialSection('RECEBIMENTO_FIADO');
        setView('cashclose');
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

      if (event.key === 'F9') {
        event.preventDefault();
        openPaymentWithMode('ORCAMENTO');
        return;
      }

      if (event.key === 'F2') {
        event.preventDefault();
        openPaymentWithMode('ORCAMENTO');
        return;
      }

      if (event.key === 'F3') {
        event.preventDefault();
        openPaymentWithMode('NFCE');
        return;
      }

      if (event.key === 'Escape') {
        if (isKeyboardVisible) {
          event.preventDefault();
          setIsKeyboardVisible(false);
          focusProductSearchInput();
        }
        return;
      }

      if (event.ctrlKey && event.key.toLowerCase() === 'c') {
        event.preventDefault();
        setIsKeyboardVisible(true);
        setView('pos');
        focusProductSearchInput();
        return;
      }

      if (event.ctrlKey && event.key.toLowerCase() === 'u') {
        event.preventDefault();
        if (!hasActiveComanda) {
          showNotice('Abra uma comanda antes de juntar para pagamento.', 'warning');
          return;
        }
        setIsJoinMode(true);
        setQuery('');
        setView('pos');
        focusProductSearchInput();
        return;
      }

      if (event.ctrlKey && event.key.toLowerCase() === 'x') {
        event.preventDefault();
        void handleLeaveComandaOpen();
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
    const currentNumbers = getActiveComandaNumbers(comandaNumber, joinedComandas);
    if (currentNumbers.length === 0) {
      return;
    }

    for (const numero of currentNumbers) {
      persistCashierItemsToComanda(numero, cartItems);
    }

    if (isLoadingComandaRef.current || skipNextComandaSyncRef.current) {
      skipNextComandaSyncRef.current = false;
      return;
    }

    setIsComandaSyncing(true);
    void Promise.all(
      currentNumbers.map((numero) => {
        const scopedItems = cartItems.filter((item) => !item.sourceComanda || item.sourceComanda === numero);
        return saveComandaItemsToBackend(numero, mapCashierCartToComandaItems(scopedItems), 'caixa_items_sync');
      })
    )
      .catch(() => {
        // O cache local continua como contingencia para queda temporaria.
      })
      .finally(() => {
        setIsComandaSyncing(false);
      });
  }, [cartItems, comandaNumber, joinedComandas]);

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
  }, [cartItems.length, comandaNumber, openComandas]);

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

  const printReceipt = (payments: PaymentEntry[], discountAmount = 0, documentMode: PaymentDocumentMode = 'NFCE') => {
    const opened = window.open('', '_blank', 'width=420,height=720');
    if (!opened) {
      return;
    }

    const now = new Date();
    const payableTotal = Math.max(0, subtotal - discountAmount);
    const totalPaid = payments.reduce((sum, payment) => sum + payment.amount, 0);
    const change = Math.max(0, totalPaid - payableTotal);
    const isFiscalDocument = documentMode === 'NFCE';
    const receiptItems = cartItems.map((item) => ({
      ...item,
      total: item.quantity * item.unitPrice
    }));

    const receiptItemsHtml = receiptItems
      .map((item) => {
        const hasTaxCode = Boolean(item.taxSituationCode && item.taxSituationCode !== '--');
        const taxDescription = isFiscalDocument && hasTaxCode ? `Imposto cobrado · CST ${item.taxSituationCode}` : '';

        return `
          <div class="item">
            <div class="item-name">${escapeHtml(item.name)}</div>
            <div class="item-meta">${formatQuantity(item.quantity, item.unit)} ${item.unit === 'KG' ? 'kg' : 'un'} · ${escapeHtml(item.total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }))}</div>
            ${taxDescription ? `<div class="item-fiscal">${escapeHtml(taxDescription)}</div>` : ''}
          </div>
        `;
      })
      .join('');

    const taxSummaryItems = receiptItems
      .filter((item) => Boolean(item.taxSituationCode && item.taxSituationCode !== '--'))
      .map(
        (item) => `
          <div class="row">
            <span>${escapeHtml(item.name)}</span>
            <strong>${escapeHtml(`Imposto cobrado · CST ${item.taxSituationCode}`)}</strong>
          </div>
        `
      )
      .join('');

    const taxSectionHtml =
      isFiscalDocument && taxSummaryItems
        ? `
            <div class="section">
              <div class="section-title">Resumo de imposto</div>
              ${taxSummaryItems}
            </div>
          `
        : '';

    opened.document.write(`
      <html>
        <head>
          <title>${documentMode === 'NFCE' ? 'Comprovante de venda NFC-e' : 'Orçamento nao fiscal'}</title>
          <style>
            body {
              font-family: Arial, sans-serif;
              margin: 0;
              padding: 16px;
              color: #111827;
            }
            .receipt {
              max-width: 360px;
              margin: 0 auto;
            }
            .header {
              text-align: center;
              margin-bottom: 16px;
            }
            .header h1 {
              font-size: 18px;
              margin: 0;
            }
            .header p {
              margin: 4px 0 0;
              font-size: 12px;
              color: #6b7280;
            }
            .section {
              margin-top: 12px;
              padding-top: 12px;
              border-top: 1px dashed #d1d5db;
            }
            .section-title {
              font-size: 12px;
              font-weight: 700;
              text-transform: uppercase;
              color: #374151;
              margin-bottom: 8px;
            }
            .row {
              display: flex;
              justify-content: space-between;
              gap: 12px;
              font-size: 12px;
              margin-bottom: 4px;
            }
            .row strong {
              text-align: right;
            }
            .item {
              margin-bottom: 10px;
            }
            .item-name {
              font-size: 13px;
              font-weight: 700;
              margin-bottom: 2px;
            }
            .item-meta,
            .item-fiscal {
              font-size: 11px;
              color: #6b7280;
              margin-bottom: 2px;
            }
            .totals {
              font-size: 13px;
              font-weight: 700;
            }
            @media print {
              body {
                padding: 0;
              }
            }
          </style>
        </head>
        <body>
          <div class="receipt">
            <div class="header">
              <h1>PDV Touch</h1>
              <p>${documentMode === 'NFCE' ? 'Comprovante de venda NFC-e' : 'Orçamento nao fiscal'}</p>
              <p>${escapeHtml(now.toLocaleString('pt-BR'))}</p>
            </div>

            <div class="section">
              <div class="section-title">Identificação</div>
              <div class="row"><span>Atendimento</span><strong>${escapeHtml(comandaNumber)}</strong></div>
              <div class="row"><span>Operador</span><strong>${escapeHtml(user?.name ?? 'Nao autenticado')}</strong></div>
            </div>

            <div class="section">
              <div class="section-title">Itens</div>
              ${receiptItemsHtml}
            </div>

            ${taxSectionHtml}

            <div class="section">
              <div class="section-title">Pagamentos</div>
              ${payments
                .map(
                  (payment) => `
                    <div class="row">
                      <span>${escapeHtml(payment.label)}</span>
                      <strong>${escapeHtml(payment.amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }))}</strong>
                    </div>
                  `
                )
                .join('')}
              <div class="row totals"><span>Subtotal</span><strong>${escapeHtml(subtotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }))}</strong></div>
              ${discountAmount > 0 ? `<div class="row totals"><span>Desconto</span><strong>-${escapeHtml(discountAmount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }))}</strong></div>` : ''}
              <div class="row totals"><span>Total</span><strong>${escapeHtml(payableTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }))}</strong></div>
              <div class="row totals"><span>Pago</span><strong>${escapeHtml(totalPaid.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }))}</strong></div>
              <div class="row totals"><span>Troco</span><strong>${escapeHtml(change.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }))}</strong></div>
            </div>
          </div>
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
    if (product.isUnavailable) {
      return;
    }

    setCartItems((prev) => {
      const sourceComanda = hasActiveComanda && activeComandas.length > 0 ? activeComandas[0] : undefined;
      const source = sourceComanda ? 'CAIXA' : undefined;
      const step = product.unit === 'KG' ? 0.1 : 1;
      const existing = product.unit === 'KG'
        ? undefined
        : prev.find((i) => i.id === product.id && (i.sourceComanda ?? '') === (sourceComanda ?? ''));

      if (existing) {
        return prev.map((i) =>
          i.id === product.id && (i.sourceComanda ?? '') === (sourceComanda ?? '')
            ? { ...i, quantity: Number((i.quantity + step).toFixed(3)) }
            : i
        );
      }

      return [...prev, {
        id: product.unit === 'KG' ? `${product.id}-caixa-${crypto.randomUUID()}` : product.id,
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
        fiscalType: product.fiscalType,
        imageUrl: product.imageUrl,
        sourceComanda,
        source,
      }];
    });
  };

  const incrementItem = (id: string) => {
    setCartItems((prev) =>
      prev.map((i) => {
        if (i.id !== id) return i;
        if (i.unit === 'KG') return i;
        const step = 1;
        return { ...i, quantity: Number((i.quantity + step).toFixed(3)) };
      })
    );
  };

  const decrementItem = (id: string) => {
    setCartItems((prev) =>
      prev
        .map((i) => {
          if (i.id !== id) return i;
          if (i.unit === 'KG') return i;
          const step = 1;
          return { ...i, quantity: Number(Math.max(0, i.quantity - step).toFixed(3)) };
        })
        .filter((i) => i.quantity > 0)
    );
  };

  const removeItem = (id: string) => {
    const item = cartItems.find((currentItem) => currentItem.id === id);
    if (!item) {
      return;
    }

    setPendingAction({
      kind: 'REMOVE_ITEM',
      itemId: id,
      title: `Excluir ${item.name}`,
      description: `Deseja realmente excluir ${item.name} do carrinho?`
    });
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

  const updateComandaStatus = async (numero: string, status: HeaderComandaStatus, reason: string) => {
    const response = await fetch(`${API_BASE}/api/v1/comandas/${encodeURIComponent(numero)}/status`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ status, reason })
    });

    if (!response.ok) {
      const payload = await response.json().catch(() => null) as { message?: string } | null;
      throw new Error(payload?.message ?? `Falha ao mudar comanda para ${status}.`);
    }
  };

  const closeComandaAtCashier = async (documentMode: PaymentDocumentMode) => {
    const currentNumbers = getActiveComandaNumbers(comandaNumber, joinedComandas);
    if (currentNumbers.length === 0) {
      showNotice('Informe ou selecione uma comanda antes de fechar o pagamento.', 'error');
      return false;
    }

    try {
      await Promise.all(currentNumbers.map((numero) => ensureComandaExistsInBackend(numero)));
    } catch {
      showNotice('Nao foi possivel preparar a comanda no backend. O pagamento nao foi finalizado.', 'error');
      return false;
    }

    try {
      const response = await fetch(`${API_BASE}/api/v1/comandas/close-batch`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          numeros: currentNumbers,
          documentMode
        })
      });

      if (!response.ok) {
        throw new Error('Falha ao fechar comandas.');
      }

      for (const numero of currentNumbers) {
        removeComandaCacheEntry(numero);
      }
      setOpenComandas((prev) => {
        const next = prev.filter((entry) => !currentNumbers.includes(entry.numero));
        setOpenComandasCount(next.length);
        return next;
      });
      setClosedComandasCount((current) => current + currentNumbers.length);
      await refreshComandaIndicators().catch(() => undefined);
      showNotice(
        documentMode === 'ORCAMENTO'
          ? `Comanda${currentNumbers.length > 1 ? 's' : ''} #${currentNumbers.join(', #')} fechada${currentNumbers.length > 1 ? 's' : ''} como orçamento nao fiscal.`
          : `Comanda${currentNumbers.length > 1 ? 's' : ''} #${currentNumbers.join(', #')} fechada${currentNumbers.length > 1 ? 's' : ''} como venda NFC-e.`,
        'success'
      );
      return true;
    } catch {
      showNotice('Nao foi possivel fechar as comandas no backend. A venda permanece na tela para nova tentativa.', 'error');
      return false;
    }
  };

  const handlePaymentConfirm = async ({ payments, fiadoClientId, discountAmount, documentMode }: PaymentConfirmPayload) => {
    const currentComandaNumber = comandaNumber.trim();
    const payableTotal = Math.max(0, subtotal - discountAmount);
    const isFiadoFlow = Boolean(fiadoClientId) || payments.some((payment) => payment.method === 'FIADO');
    const finalDocumentMode: PaymentDocumentMode = isFiadoFlow ? 'ORCAMENTO' : documentMode;

    if (hasActiveComanda) {
      const closed = await closeComandaAtCashier(finalDocumentMode);
      if (!closed) {
        return;
      }
    }

    if (isFiadoFlow) {
      const clientId = fiadoClientId;
      if (clientId) {
        const targetClient = clients.find((client) => client.id === clientId)
          ?? await clientsContainer.clientRepository.findById(clientId);

        if (targetClient) {
          const launchedAt = formatLaunchDateTime(new Date());
          const discountNote = discountAmount > 0 ? ` - Desconto R$ ${discountAmount.toFixed(2)}` : '';
          const entryDescription = `Fiado atendimento ${currentComandaNumber} - Total R$ ${payableTotal.toFixed(2)}${discountNote} - Orcamento nao fiscal`;

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
      setQuery('');
      setView('pos');
      focusProductSearchInput();
      return;
    }

    printReceipt(payments, discountAmount, documentMode);
    setCartItems([]);
    setComandaNumber('');
    setJoinedComandas([]);
    setIsJoinMode(false);
    setQuery('');
    setView('pos');
    if (!hasActiveComanda) {
      showNotice(
        finalDocumentMode === 'ORCAMENTO'
          ? 'Venda avulsa fechada como orçamento não fiscal.'
          : 'Venda avulsa fechada como venda NFC-e.',
        'success'
      );
    }
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
                                handleSmartInputSubmit(entry.numero);
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
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-500">Comandas fechadas</p>
              <p className="text-4xl font-black text-sky-600 leading-none">{closedComandasCount.toLocaleString('pt-BR')}</p>
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
            <p className="text-base font-bold leading-tight text-sky-700">{activeComandaLabel}</p>
          </div>
          <div className="flex items-center gap-2">
            <UserRound size={20} className="text-sky-600" />
            <div>
              <p className="text-xs leading-tight text-slate-500">Operador</p>
              <p className="text-sm font-semibold leading-tight">{user?.name ?? 'Nao autenticado'}</p>
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

      {!isCashierOpen ? (
        <main className="flex flex-1 items-center justify-center bg-slate-50/80 px-6 py-8">
          <section className="w-full max-w-xl rounded-2xl border border-orange-200 bg-white p-8 text-center shadow-lg">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-orange-600">Caixa</p>
            <h1 className="mt-2 text-3xl font-black text-slate-900">Caixa fechado</h1>
            <p className="mt-3 text-sm text-slate-500">
              Abra uma sessão de caixa para liberar vendas, comandas, recebimentos e fechamento do turno.
            </p>
            <button
              type="button"
              onClick={handleOpenCashier}
              className="mt-6 min-h-[52px] w-full rounded-xl bg-emerald-600 px-5 text-sm font-bold text-white shadow-sm hover:bg-emerald-700"
            >
              Abrir caixa
            </button>
          </section>
        </main>
      ) : (
      <div className="flex flex-1 min-h-0 overflow-hidden">

      {/* ── LEFT 60%: busca + categorias + grid ────────────────────────────── */}
      <main className={`${view === 'cashclose' ? 'w-full' : 'w-[60%]'} bg-slate-50/80 flex flex-col overflow-hidden ${view === 'cashclose' ? '' : 'border-r border-slate-200'}`}>

        {view === 'cashclose' ? (
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
            onBack={() => setView('pos')}
            onClose={() => {
              void handleCashClose();
            }}
            items={cartItems}
          />
        ) : view === 'payment' ? (
          <PaymentPanel
            total={subtotal}
            items={cartItems}
            initialDocumentMode={paymentInitialDocumentMode}
            onConfirm={handlePaymentConfirm}
            onBack={() => setView('pos')}
          />
        ) : (
          <>
            {/* ── SmartInput ─────────────────────────────────────── */}
            <div className="relative px-5 pt-5 pb-3 shrink-0">
              <SmartInput
                value={query}
                onChange={setQuery}
                onSubmit={handleSmartInputSubmit}
                keepFocused
                placeholder={smartInputPlaceholder}
              />
              {isKeyboardVisible ? (
                <CashierVirtualKeyboard
                  onKeyPress={handleVirtualKeyboardKey}
                  onClose={() => {
                    setIsKeyboardVisible(false);
                    focusProductSearchInput();
                  }}
                  enterLabel={isKeyboardVisible && query.trim() ? 'Adicionar' : 'Enter'}
                  products={filteredProducts}
                  onAddProduct={(product) => {
                    addProduct(product);
                    setQuery('');
                    focusProductSearchInput();
                  }}
                />
              ) : null}
            </div>

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
      {view !== 'cashclose' && (
        <aside className="w-[40%] bg-white flex flex-col overflow-hidden">
          <CartPanel
            items={cartItems}
            comandaNumber={comandaNumber}
            activeLabel={activeComandaLabel}
            hasActiveComanda={hasActiveComanda}
            onIncrement={incrementItem}
            onDecrement={decrementItem}
            onRemove={removeItem}
            onRefreshComanda={refreshCurrentComanda}
            onLeaveComandaOpen={handleLeaveComandaOpen}
            isComandaSyncing={isComandaSyncing}
            onReceive={() => openPaymentWithMode('ORCAMENTO')}
            onCashClose={() => {
              setCashCloseInitialTab('MENU');
              setCashCloseInitialSection('INICIO');
              setView('cashclose');
            }}
          />
        </aside>
      )}

      </div>
      )}

    </div>
  );
}

