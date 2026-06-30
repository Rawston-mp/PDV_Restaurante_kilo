import { ShoppingCart } from 'lucide-react';
import { CartItem, type CashierCartItem } from './CartItem';
import { formatBRL } from '../../types';

type CartPanelProps = {
  items: CashierCartItem[];
  comandaNumber: string;
  joinedComandaNumbers?: string[];
  onIncrement: (id: string) => void;
  onDecrement: (id: string) => void;
  onRemove: (id: string) => void;
  onRefreshComanda: () => void;
  isComandaSyncing?: boolean;
  onReceive: () => void;
  onCashClose: () => void;
};

export function CartPanel({
  items,
  comandaNumber,
  joinedComandaNumbers = [],
  onIncrement,
  onDecrement,
  onRemove,
  onRefreshComanda,
  isComandaSyncing = false,
  onReceive,
  onCashClose,
}: CartPanelProps) {
  const subtotal = items.reduce((acc, i) => acc + i.quantity * i.unitPrice, 0);
  const totalItems = items.reduce((acc, i) => acc + (i.unit === 'KG' ? 1 : i.quantity), 0);
  const checkoutNumbers = [comandaNumber.trim(), ...joinedComandaNumbers.map((numero) => numero.trim())].filter(Boolean);
  const attendanceLabel = checkoutNumbers.length > 1
    ? `Comandas ${checkoutNumbers.map((numero) => `#${numero}`).join(' + ')}`
    : checkoutNumbers.length === 1
      ? `Atendimento #${checkoutNumbers[0]}`
      : 'Venda avulsa';

  return (
    <div className="flex flex-col h-full bg-white">

      {/* ── Header ─────────────────────────────────────────────── */}
      <header className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3">
        <div className="flex items-center gap-2">
          <ShoppingCart size={21} className="text-sky-600" />
          <span className="text-xl font-bold text-slate-800">
            Carrinho
          </span>
        </div>
        <span className="rounded-full bg-sky-100 px-2.5 py-1 text-xs font-semibold text-sky-700">
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
                showSource={checkoutNumbers.length > 1}
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
        <div className="mb-1 text-sm text-slate-500">
          {attendanceLabel}
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

        {checkoutNumbers.length > 0 && (
          <button
            type="button"
            onClick={onRefreshComanda}
            disabled={isComandaSyncing}
            className="
              w-full h-11 rounded-xl
              border border-slate-300 bg-slate-50 hover:bg-slate-100
              disabled:cursor-wait disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400
              text-slate-700 text-sm font-semibold
              transition-colors duration-150
            "
          >
            {isComandaSyncing ? 'Salvando comanda...' : 'Atualizar comanda'}
          </button>
        )}

        <button
          type="button"
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
          Receber <span className="ml-2 text-sm font-black opacity-70">F9</span>
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
