// ─── CaixaPage — PDV Touch ────────────────────────────────────────────────────
// Layout 60/40 | Tailwind CSS | Lucide React
// Sem modais para fluxos básicos; PaymentPanel desliza sobre a zona esquerda.
// ─────────────────────────────────────────────────────────────────────────────

import '@/modules/cashier/caixa.css';
import { useMemo, useState } from 'react';
import { type CashierCartItem } from '@/modules/cashier/presentation/components/CartItem';
import { type CashierProduct } from '@/modules/cashier/presentation/components/ProductCard';
import { SmartInput } from '@/modules/cashier/presentation/components/SmartInput';
import { CategoryTabs } from '@/modules/cashier/presentation/components/CategoryTabs';
import { ProductGrid } from '@/modules/cashier/presentation/components/ProductGrid';
import { CartPanel } from '@/modules/cashier/presentation/components/CartPanel';
import { PaymentPanel } from '@/modules/cashier/presentation/components/PaymentPanel';
import { CashRegisterClose } from '@/modules/cashier/presentation/components/CashRegisterClose';
import { CATEGORIES, MOCK_PRODUCTS, type PaymentEntry } from '@/modules/cashier/types';

// ─────────────────────────────────────────────────────────────────────────────
// CashierPage — tela de caixa unificada
// ─────────────────────────────────────────────────────────────────────────────

type View = 'pos' | 'payment' | 'cashclose';

// Adapt MOCK_PRODUCTS (type from types.ts) to CashierProduct (used by ProductCard)
const products: CashierProduct[] = MOCK_PRODUCTS.map((p) => ({
  id: p.id,
  name: p.name,
  category: p.category,
  price: p.price,
  unit: p.unit as 'KG' | 'UN',
}));

export function CashierPage() {
  const [view, setView]                     = useState<View>('pos');
  const [query, setQuery]                   = useState('');
  const [activeCategory, setActiveCategory] = useState('Todos');
  const [comandaNumber]                     = useState('113942');
  const [cartItems, setCartItems]           = useState<CashierCartItem[]>([]);

  // ── Filtered products ──────────────────────────────────────────────────────
  const filteredProducts = useMemo(() => {
    const q = query.trim().toLowerCase();
    return products.filter((p) => {
      const matchesCat   = activeCategory === 'Todos' || p.category === activeCategory;
      const matchesQuery = !q || p.name.toLowerCase().includes(q) || p.category.toLowerCase().includes(q);
      return matchesCat && matchesQuery;
    });
  }, [activeCategory, query]);

  const subtotal = cartItems.reduce((s, i) => s + i.quantity * i.unitPrice, 0);

  // ── Cart mutations ─────────────────────────────────────────────────────────
  const addProduct = (product: CashierProduct) => {
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
        quantity: step,
        unitPrice: product.price,
        unit: product.unit as 'KG' | 'UN',
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

  const handlePaymentConfirm = (_payments: PaymentEntry[]) => {
    // In production: persist sale, emit to backend, print receipt
    setCartItems([]);
    setView('pos');
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="pdv-caixa-root flex h-screen overflow-hidden bg-slate-50">

      {/* ── LEFT ZONE 60% ─────────────────────────────────────────────────── */}
      <div className="w-[60%] flex flex-col h-full overflow-hidden">

        {view === 'cashclose' ? (
          /* Fechamento de caixa ocupa toda a zona esquerda */
          <CashRegisterClose
            onBack={() => setView('pos')}
            onClose={() => {
              // In production: confirm close, send to backend
              setView('pos');
            }}
          />
        ) : view === 'payment' ? (
          /* Painel de pagamento substitui a grade de produtos */
          <PaymentPanel
            total={subtotal}
            onConfirm={handlePaymentConfirm}
            onBack={() => setView('pos')}
          />
        ) : (
          /* POS normal: busca + categorias + grid */
          <div className="flex flex-col h-full overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 bg-white">
              <div>
                <p className="text-xs text-slate-500 font-medium uppercase tracking-wide">PDV Touch</p>
                <h1 className="text-base font-bold text-slate-800">Atendimento 1.267</h1>
              </div>
              <span className="text-xs font-semibold bg-slate-100 text-slate-600 px-3 py-1 rounded-full">
                Comanda #{comandaNumber}
              </span>
            </div>

            {/* SmartInput */}
            <div className="px-4 pt-3 pb-2">
              <SmartInput value={query} onChange={setQuery} />
            </div>

            {/* CategoryTabs */}
            <div className="px-4 pb-2">
              <CategoryTabs
                categories={CATEGORIES}
                selected={activeCategory}
                onSelect={(c) => { setActiveCategory(c); setQuery(''); }}
              />
            </div>

            {/* ProductGrid — scrollable */}
            <div className="flex-1 overflow-y-auto px-2 pb-2">
              <ProductGrid products={filteredProducts} onAdd={addProduct} />
            </div>
          </div>
        )}
      </div>

      {/* ── RIGHT ZONE 40% ────────────────────────────────────────────────── */}
      <div className="w-[40%] h-full overflow-hidden">
        <CartPanel
          items={cartItems}
          comandaNumber={comandaNumber}
          onIncrement={incrementItem}
          onDecrement={decrementItem}
          onRemove={removeItem}
          onReceive={() => setView('payment')}
          onCashClose={() => setView('cashclose')}
        />
      </div>

    </div>
  );
}
