// ─── CaixaPage — PDV Touch ────────────────────────────────────────────────────
// Layout 60/40 | Tailwind CSS | Lucide React
// Sem modais para fluxos básicos; PaymentPanel desliza sobre a zona esquerda.
// ─────────────────────────────────────────────────────────────────────────────

import '@/modules/cashier/caixa.css';
import { useEffect, useMemo, useState } from 'react';
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

const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:3001';
const CLOSED_COMANDA_STATUSES: HeaderComandaStatus[] = ['FECHADA_ORCAMENTO', 'FECHADA_VENDA', 'CANCELADA', 'ARQUIVADA'];

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

export function CashierPage() {
  const { user, signOut } = useAuth();
  const { products, setProducts } = useProductsQuery();
  const { clients, setClients } = useClientsQuery();
  const [view, setView]                     = useState<View>('pos');
  const [cashCloseInitialTab, setCashCloseInitialTab] = useState<CashCloseTab>('MENU');
  const [cashCloseInitialSection, setCashCloseInitialSection] = useState<CashCloseSection>('INICIO');
  const [query, setQuery]                   = useState('');
  const [activeCategory, setActiveCategory] = useState('Todos');
  const [comandaNumber]                     = useState('113942');
  const [cartItems, setCartItems]           = useState<CashierCartItem[]>([]);
  const [openComandasCount, setOpenComandasCount] = useState(0);
  const [closedComandasCount, setClosedComandasCount] = useState(0);

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

  useEffect(() => {
    let cancelled = false;

    const loadComandaIndicators = async () => {
      try {
        const response = await fetch(`${API_BASE}/api/v1/comandas`);
        if (!response.ok) {
          return;
        }

        const payload = (await response.json()) as { ok?: boolean; comandas?: HeaderComandaRecord[] };
        if (cancelled || !Array.isArray(payload.comandas)) {
          return;
        }

        const totalOpen = payload.comandas.filter((comanda) => !CLOSED_COMANDA_STATUSES.includes(comanda.status)).length;
        const totalClosed = payload.comandas.filter((comanda) => CLOSED_COMANDA_STATUSES.includes(comanda.status)).length;
        setOpenComandasCount(totalOpen);
        setClosedComandasCount(totalClosed);
      } catch {
        if (!cancelled) {
          setOpenComandasCount(0);
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
  }, []);

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
        handleCancelLastSale();
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
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-500">Comandas abertas</p>
              <p className="text-4xl font-black text-sky-600 leading-none">{openComandasCount.toLocaleString('pt-BR')}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-500">Comandas fechadas</p>
              <p className="text-4xl font-black text-sky-600 leading-none">{closedComandasCount.toLocaleString('pt-BR')}</p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-6 text-slate-600">
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
            onBack={() => setView('pos')}
            onClose={() => setView('pos')}
            items={cartItems}
          />
        ) : view === 'payment' ? (
          <PaymentPanel total={subtotal} items={cartItems} onConfirm={handlePaymentConfirm} onBack={() => setView('pos')} />
        ) : (
          <>
            {/* ── SmartInput ─────────────────────────────────────── */}
            <div className="px-5 pt-5 pb-3 shrink-0">
              <SmartInput value={query} onChange={setQuery} />
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
