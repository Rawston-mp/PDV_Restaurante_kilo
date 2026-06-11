import { ShoppingCart } from 'lucide-react';
import { CartItem, type CashierCartItem } from './CartItem';
import { formatBRL } from '../../types';

type CartPanelProps = {
  items: CashierCartItem[];
  comandaNumber: string;
  onIncrement: (id: string) => void;
  onDecrement: (id: string) => void;
  onRemove: (id: string) => void;
  onReceive: () => void;
  onCashClose: () => void;
};

export function CartPanel({
  items,
  comandaNumber,
  onIncrement,
  onDecrement,
  onRemove,
  onReceive,
  onCashClose,
}: CartPanelProps) {
  const subtotal = items.reduce((acc, i) => acc + i.quantity * i.unitPrice, 0);
  const totalItems = items.reduce((acc, i) => acc + (i.unit === 'KG' ? 1 : i.quantity), 0);

  return (
    <div className="flex flex-col h-full bg-white border-l border-slate-200">

      {/* ── Header ─────────────────────────────────────────────── */}
      <header className="flex items-center justify-between px-4 py-3 border-b border-slate-100 bg-slate-50">
        <div className="flex items-center gap-2">
          <ShoppingCart size={18} className="text-slate-500" />
          <span className="text-sm font-semibold text-slate-700">
            Atendimento {comandaNumber ? `#${comandaNumber}` : '— sem comanda'}
          </span>
        </div>
        {items.length > 0 && (
          <span className="text-xs font-medium bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">
            {totalItems} {totalItems === 1 ? 'item' : 'itens'}
          </span>
        )}
      </header>

      {/* ── Cart List ──────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto">
        {items.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-slate-300 gap-3 py-16">
            <ShoppingCart size={40} strokeWidth={1} />
            <p className="text-sm">Carrinho vazio</p>
          </div>
        ) : (
          <ul className="divide-y divide-slate-100 px-1">
            {items.map((item) => (
              <CartItem
                key={item.id}
                item={item}
                onIncrement={onIncrement}
                onDecrement={onDecrement}
                onRemove={onRemove}
              />
            ))}
          </ul>
        )}
      </div>

      {/* ── Footer ─────────────────────────────────────────────── */}
      <footer className="border-t border-slate-200 px-4 pt-3 pb-4 space-y-2">
        {/* Subtotal line */}
        <div className="flex justify-between text-sm text-slate-500">
          <span>Subtotal</span>
          <span>{formatBRL(subtotal)}</span>
        </div>

        {/* Big total */}
        <div className="flex justify-between items-baseline">
          <span className="text-base font-semibold text-slate-700">Total</span>
          <span className="text-3xl font-extrabold text-orange-500 tracking-tight">
            {formatBRL(subtotal)}
          </span>
        </div>

        {/* Receive button */}
        <button
          type="button"
          disabled={items.length === 0}
          onClick={onReceive}
          className="
            w-full h-14 rounded-xl
            bg-emerald-500 hover:bg-emerald-600
            disabled:opacity-40 disabled:cursor-not-allowed
            text-white text-lg font-bold
            transition-colors duration-150
            active:scale-95
          "
        >
          Receber Pagamento
        </button>

        {/* Cash close link */}
        <button
          type="button"
          onClick={onCashClose}
          className="w-full text-center text-xs text-slate-400 hover:text-slate-600 py-1 transition-colors"
        >
          Fechar Caixa
        </button>
      </footer>
    </div>
  );
}
