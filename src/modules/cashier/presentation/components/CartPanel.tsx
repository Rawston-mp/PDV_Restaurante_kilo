import { ShoppingCart } from 'lucide-react';
import { CartItem, type CashierCartItem } from './CartItem';
import { formatBRL } from '../../types';

type CartPanelProps = {
  items: CashierCartItem[];
  comandaNumber: string;
  activeLabel?: string;
  hasActiveComanda?: boolean;
  onIncrement: (id: string) => void;
  onDecrement: (id: string) => void;
  onRemove: (id: string) => void;
  onRefreshComanda: () => void;
  onLeaveComandaOpen?: () => void;
  isComandaSyncing?: boolean;
  onReceive: () => void;
  onCashClose: () => void;
};

export function CartPanel({
  items,
  comandaNumber,
  activeLabel,
  hasActiveComanda = false,
  onIncrement,
  onDecrement,
  onRemove,
  onRefreshComanda,
  onLeaveComandaOpen,
  isComandaSyncing = false,
  onReceive,
  onCashClose,
}: CartPanelProps) {
  const subtotal = items.reduce((acc, i) => acc + i.quantity * i.unitPrice, 0);
  const totalItems = items.reduce((acc, i) => acc + (i.unit === 'KG' ? 1 : i.quantity), 0);
  const attendanceLabel = hasActiveComanda
    ? activeLabel ?? (comandaNumber.trim() ? `#${comandaNumber.trim()}` : 'Sem comanda')
    : 'Venda avulsa';

  return (
    <div className="flex flex-col h-full bg-white">

      {/* ── Header ─────────────────────────────────────────────── */}
      <header className="flex items-center justify-between px-5 py-5 border-b border-slate-200 bg-white">
        <div className="flex items-center gap-2">
          <ShoppingCart size={24} className="text-sky-600" />
          <span className="text-2xl font-bold text-slate-800">
            Carrinho
          </span>
        </div>
        <span className="text-xs font-semibold bg-sky-100 text-sky-700 px-3 py-1 rounded-full">
          {totalItems} {totalItems === 1 ? 'item' : 'itens'}
        </span>
      </header>

      {/* ── Cart List ──────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto">
        {items.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-slate-300 gap-3 py-16">
            <ShoppingCart size={40} strokeWidth={1} />
            <p className="text-sm">Carrinho vazio</p>
          </div>
        ) : (
          <ul>
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
      <footer className="border-t border-slate-200 px-5 pt-4 pb-5 space-y-2.5">
        <div className="text-sm text-slate-500 mb-1">
          {attendanceLabel === 'Venda avulsa' ? (
            <>
              Atendimento <span>{attendanceLabel}</span>
            </>
          ) : (
            `Atendimento ${attendanceLabel}`
          )}
        </div>
        <div className="flex justify-between text-xl text-slate-500">
          <span>Subtotal</span>
          <span>{formatBRL(subtotal)}</span>
        </div>

        <div className="flex justify-between items-baseline">
          <span className="text-4xl font-semibold text-slate-700">Total</span>
          <span className="text-5xl font-black text-sky-600 tracking-tight">
            {formatBRL(subtotal)}
          </span>
        </div>

        {hasActiveComanda ? (
          <>
            <button
              type="button"
              onClick={onRefreshComanda}
              disabled={isComandaSyncing}
              className="
                w-full h-11 rounded-xl
                border border-slate-300 bg-slate-50 hover:bg-slate-100
                disabled:cursor-not-allowed disabled:opacity-60
                text-slate-700 text-sm font-semibold
                transition-colors duration-150
              "
            >
              {isComandaSyncing ? 'Salvando comanda...' : 'Atualizar comanda'}
            </button>

            {onLeaveComandaOpen ? (
              <button
                type="button"
                onClick={onLeaveComandaOpen}
                className="w-full h-11 rounded-xl border border-orange-200 bg-orange-50 text-sm font-semibold text-orange-700 hover:bg-orange-100 transition-colors"
              >
                Manter comanda aberta
              </button>
            ) : null}
          </>
        ) : null}

        <button
          type="button"
          aria-label="Receber"
          disabled={items.length === 0}
          onClick={onReceive}
          className="
            mt-2 w-full h-14 rounded-2xl
            border border-sky-400
            bg-gradient-to-r from-sky-50 to-cyan-100 hover:from-sky-100 hover:to-cyan-200
            disabled:bg-slate-100 disabled:border-slate-300 disabled:text-slate-400 disabled:cursor-not-allowed
            text-sky-800 text-xl font-bold
            transition-colors duration-150
            active:scale-95
          "
        >
          Receber <span className="ml-2 rounded-md bg-white/70 px-2 py-0.5 text-xs font-black text-sky-700">F9</span>
        </button>

        <button
          type="button"
          onClick={onCashClose}
          className="w-full text-center text-sm text-slate-400 hover:text-slate-600 py-1 transition-colors"
        >
          Mais opções
        </button>
      </footer>
    </div>
  );
}
