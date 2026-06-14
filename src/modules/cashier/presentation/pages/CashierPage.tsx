// ─── CaixaPage — PDV Touch ────────────────────────────────────────────────────
// Layout 60/40 | Tailwind CSS | Lucide React
// Sem modais para fluxos básicos; PaymentPanel desliza sobre a zona esquerda.
// ─────────────────────────────────────────────────────────────────────────────

import '@/modules/cashier/caixa.css';
import { useCallback, useEffect, useMemo, useState } from 'react';
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
import { type PaymentEntry } from '@/modules/cashier/types';
import { useClientsQuery } from '@/modules/clients/presentation/hooks/useClientsQuery';
import { clientsContainer } from '@/modules/clients/infrastructure/container/clientsContainer';
import type { ItemComanda } from '@/types/comanda';
import {
  clearComandaCache,
  listOpenComandaNumbers,
  readComandaItems,
  removeComandaCacheEntry,
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
};

type ActiveComandaEntry = {
  numero: string;
  origem: 'BALANCA' | 'CAIXA';
  status?: HeaderComandaStatus;
};

const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:3001';
const NON_OPEN_COMANDA_STATUSES: HeaderComandaStatus[] = ['FECHADA_ORCAMENTO', 'FECHADA_VENDA', 'CANCELADA', 'ARQUIVADA'];
const COUNTABLE_CLOSED_COMANDA_STATUSES: HeaderComandaStatus[] = ['FECHADA_ORCAMENTO', 'FECHADA_VENDA', 'CANCELADA'];

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

const mapComandaItemsToCashierCart = (items: ItemComanda[], catalog: CashierProduct[]): CashierCartItem[] => {
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
      imageUrl: matchedProduct?.imageUrl
    };
  });
};

const persistCashierItemsToComanda = (numero: string, items: CashierCartItem[]) => {
  if (!numero.trim()) {
    return;
  }

  upsertComandaItems(
    numero,
    items.map((item) => ({
      id: item.id,
      nome: item.name,
      precoUnitario: item.unitPrice,
      quantidade: item.quantity,
      categoriaId: 'CAIXA',
      subtotal: Number((item.quantity * item.unitPrice).toFixed(2)),
      porUnidade: item.unit === 'UN',
      peso: item.unit === 'KG' ? item.quantity : undefined
    }))
  );
};

const extractComandaNumber = (raw: string) => {
  const input = raw.trim();
  if (!input) {
    return null;
  }

  const explicitTagMatch = input.match(/^(?:comanda|cmd|mesa|balanca)\s*[:#-]?\s*(\d{1,12})$/i);
  if (explicitTagMatch) {
    return explicitTagMatch[1];
  }

  const digitsOnly = input.match(/^\d{1,12}$/);
  if (digitsOnly) {
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
  const [comandaNumber, setComandaNumber]   = useState('113942');
  const [cartItems, setCartItems]           = useState<CashierCartItem[]>([]);
  const [openComandasCount, setOpenComandasCount] = useState(0);
  const [closedComandasCount, setClosedComandasCount] = useState(0);
  const [openComandas, setOpenComandas] = useState<ActiveComandaEntry[]>([]);
  const [isOpenComandasPanelOpen, setIsOpenComandasPanelOpen] = useState(false);
  const hasActiveComanda = Boolean(comandaNumber.trim()) && openComandas.some((entry) => entry.numero === comandaNumber.trim());
  const activeComandaLabel = hasActiveComanda ? comandaNumber.trim() : 'Sem comanda';

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

  const cancelComanda = async (numero: string, confirmMessage?: string) => {
    const trimmed = numero.trim();
    if (!trimmed) {
      return;
    }

    const confirmed = window.confirm(confirmMessage ?? `Deseja cancelar comanda #${trimmed}?`);
    if (!confirmed) {
      return;
    }

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
      // Se backend indisponível, aplica cancelamento local para não travar operação
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
      setQuery('');
      focusProductSearchInput();
    }
  };

  const handleShortcutCancelComanda = () => {
    const activeNumber = comandaNumber.trim();
    if (activeNumber) {
      void cancelComanda(activeNumber, `Deseja cancelar a comanda ativa #${activeNumber}?`);
      return;
    }

    if (openComandas.length === 0) {
      window.alert('Nao ha comandas abertas para cancelar.');
      return;
    }

    const available = openComandas.map((entry) => entry.numero).join(', ');
    const suggested = comandaNumber.trim() || openComandas[0]?.numero || '';
    const selected = window.prompt(
      `Deseja cancelar qual comanda?\nDisponiveis: ${available}`,
      suggested
    );

    if (!selected) {
      return;
    }

    const parsed = extractComandaNumber(selected);
    if (!parsed) {
      window.alert('Numero de comanda invalido para cancelamento.');
      return;
    }

    if (!openComandas.some((entry) => entry.numero === parsed)) {
      window.alert(`Comanda #${parsed} nao esta na lista de comandas abertas.`);
      return;
    }

    void cancelComanda(parsed);
  };

  const handleSmartInputSubmit = (rawValue: string) => {
    const comandaFromInput = extractComandaNumber(rawValue);
    if (!comandaFromInput) {
      return;
    }

    setComandaNumber(comandaFromInput);
    setCartItems(mapComandaItemsToCashierCart(readComandaItems(comandaFromInput), catalogProducts));
    setOpenComandas((prev) => {
      if (prev.some((entry) => entry.numero === comandaFromInput)) {
        return prev;
      }

      const next = sortComandasByNumero([
        ...prev,
        {
          numero: comandaFromInput,
          origem: 'CAIXA'
        }
      ]);
      setOpenComandasCount(next.length);

      return next;
    });
    setQuery('');
    focusProductSearchInput();
  };

  const refreshCurrentComanda = () => {
    const currentNumber = comandaNumber.trim();
    if (!currentNumber) {
      return;
    }

    setCartItems(mapComandaItemsToCashierCart(readComandaItems(currentNumber), catalogProducts));
    focusProductSearchInput();
  };

  const notifyFeaturePending = (featureLabel: string) => {
    window.alert(`${featureLabel} em breve.`);
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
    const confirmed = window.confirm('Deseja limpar o cache local de comandas do caixa?');
    if (!confirmed) {
      return;
    }

    clearComandaCache();
    setOpenComandas([]);
    setOpenComandasCount(0);
    setCartItems([]);
    setComandaNumber('');
    setQuery('');
    setIsOpenComandasPanelOpen(false);
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

      if (event.altKey && event.key.toLowerCase() === 'c') {
        event.preventDefault();
        handleCancelCoupons();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

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
    persistCashierItemsToComanda(comandaNumber, cartItems);
  }, [cartItems, comandaNumber]);

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

  const printReceipt = (payments: PaymentEntry[]) => {
    const opened = window.open('', '_blank', 'width=420,height=720');
    if (!opened) {
      return;
    }

    const now = new Date();
    const totalPaid = payments.reduce((sum, payment) => sum + payment.amount, 0);
    const change = Math.max(0, totalPaid - subtotal);
    const receiptItems = cartItems.map((item) => ({
      ...item,
      total: item.quantity * item.unitPrice
    }));

    opened.document.write(`
      <html>
        <head>
          <title>Comprovante de venda</title>
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
              <p>Comprovante de venda</p>
              <p>${escapeHtml(now.toLocaleString('pt-BR'))}</p>
            </div>

            <div class="section">
              <div class="section-title">Identificação</div>
              <div class="row"><span>Atendimento</span><strong>${escapeHtml(comandaNumber)}</strong></div>
              <div class="row"><span>Operador</span><strong>${escapeHtml(user?.name ?? 'Nao autenticado')}</strong></div>
            </div>

            <div class="section">
              <div class="section-title">Itens</div>
              ${receiptItems
                .map(
                  (item) => `
                    <div class="item">
                      <div class="item-name">${escapeHtml(item.name)}</div>
                      <div class="item-meta">${formatQuantity(item.quantity, item.unit)} ${item.unit === 'KG' ? 'kg' : 'un'} · ${escapeHtml(item.total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }))}</div>
                      <div class="item-fiscal">ID ${escapeHtml(item.productCode ?? '--')} · NCM ${escapeHtml(item.ncm ?? '--')} · CFOP ${escapeHtml(item.cfop ?? '--')}</div>
                      <div class="item-fiscal">${escapeHtml(item.fiscalType ?? 'Fiscal nao informado')} · CST ${escapeHtml(item.taxSituationCode ?? '--')} · EAN ${escapeHtml(item.barcode ?? '--')}</div>
                    </div>
                  `
                )
                .join('')}
            </div>

            <div class="section">
              <div class="section-title">Resumo fiscal</div>
              ${cartItems
                .map(
                  (item) => `
                    <div class="row">
                      <span>${escapeHtml(item.name)}</span>
                      <strong>${escapeHtml(item.productCode ?? '--')} · ${escapeHtml(item.taxSituationCode ?? '--')}</strong>
                    </div>
                  `
                )
                .join('')}
            </div>

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
              <div class="row totals"><span>Total</span><strong>${escapeHtml(subtotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }))}</strong></div>
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
      const existing = prev.find((i) => i.id === product.id);
      const step = product.unit === 'KG' ? 0.1 : 1;
      if (existing) {
        return prev.map((i) =>
          i.id === product.id ? { ...i, quantity: Number((i.quantity + step).toFixed(3)) } : i
        );
      }
      return [...prev, {
        id: product.id,
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

  const decrementItem = (id: string) => {
    setCartItems((prev) =>
      prev
        .map((i) => {
          if (i.id !== id) return i;
          const step = i.unit === 'KG' ? 0.1 : 1;
          return { ...i, quantity: Number(Math.max(0, i.quantity - step).toFixed(3)) };
        })
        .filter((i) => i.quantity > 0)
    );
  };

  const removeItem = (id: string) => {
    setCartItems((prev) => prev.filter((i) => i.id !== id));
  };

  const handlePaymentConfirm = async ({ payments, fiadoClientId }: PaymentConfirmPayload) => {
    const isFiadoFlow = Boolean(fiadoClientId) || payments.some((payment) => payment.method === 'FIADO');

    if (isFiadoFlow) {
      const clientId = fiadoClientId;
      if (clientId) {
        const targetClient = clients.find((client) => client.id === clientId)
          ?? await clientsContainer.clientRepository.findById(clientId);

        if (targetClient) {
          const launchedAt = formatLaunchDateTime(new Date());
          const entryDescription = `Fiado atendimento ${comandaNumber} - Total R$ ${subtotal.toFixed(2)} - Sem valor fiscal (definir Fiscal ou Orcamento no pagamento)`;

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
      setView('pos');
      return;
    }

    // Fluxo padrão: pagamento à vista com comprovante fiscal
    printReceipt(payments);
    setCartItems([]);
    setView('pos');
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
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Comandas abertas no sistema</p>

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
                                void cancelComanda(entry.numero);
                              }}
                              className="rounded-md border border-red-200 bg-red-50 px-2 py-1 text-[11px] font-semibold text-red-700 hover:bg-red-100"
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
          <div className="rounded-xl border border-sky-200 bg-sky-50 px-3 py-2">
            <p className="text-[11px] uppercase tracking-wide text-slate-500">Comanda ativa</p>
            <p className="text-base font-bold leading-tight text-sky-700">{hasActiveComanda ? `#${activeComandaLabel}` : activeComandaLabel}</p>
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
            onBack={() => setView('pos')}
            onClose={() => {
              void handleCashClose();
            }}
            items={cartItems}
          />
        ) : view === 'payment' ? (
          <PaymentPanel total={subtotal} items={cartItems} onConfirm={handlePaymentConfirm} onBack={() => setView('pos')} />
        ) : (
          <>
            {/* ── SmartInput ─────────────────────────────────────── */}
            <div className="px-5 pt-5 pb-3 shrink-0">
              <SmartInput
                value={query}
                onChange={setQuery}
                onSubmit={handleSmartInputSubmit}
                keepFocused
                placeholder="Digite ou leia a comanda (numero/codigo) e pressione Enter"
              />
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
            onIncrement={incrementItem}
            onDecrement={decrementItem}
            onRemove={removeItem}
            onRefreshComanda={refreshCurrentComanda}
            onReceive={() => setView('payment')}
            onCashClose={() => {
              setCashCloseInitialTab('MENU');
              setCashCloseInitialSection('INICIO');
              setView('cashclose');
            }}
          />
        </aside>
      )}

      </div>

    </div>
  );
}
