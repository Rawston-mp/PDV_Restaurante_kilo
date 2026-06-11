import { Minus, Plus, Trash2 } from 'lucide-react';
import { formatBRL } from '../../types';

export type CashierCartItem = {
  id: string;
  name: string;
  quantity: number;
  unitPrice: number;
  unit: 'KG' | 'UN';
};

type CartItemProps = {
  item: CashierCartItem;
  onIncrement: (id: string) => void;
  onDecrement: (id: string) => void;
  onRemove: (id: string) => void;
};

export function CartItem({ item, onIncrement, onDecrement, onRemove }: CartItemProps) {
  const total = item.quantity * item.unitPrice;
  const isKg = item.unit === 'KG';

  return (
    <li className="group flex items-center gap-3 py-2.5 px-3 rounded-lg hover:bg-slate-50 transition-colors">
      {/* Name + qty info */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-slate-800 truncate">{item.name}</p>
        <p className="text-xs text-slate-500 mt-0.5">
          {item.quantity.toLocaleString('pt-BR', {
            minimumFractionDigits: isKg ? 3 : 0,
            maximumFractionDigits: isKg ? 3 : 0,
          })}{' '}
          {isKg ? 'kg' : 'un'} × {formatBRL(item.unitPrice)}
        </p>
      </div>

      {/* Inline actions — visible on hover */}
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          type="button"
          onClick={() => onDecrement(item.id)}
          aria-label={`Diminuir ${item.name}`}
          className="p-2 rounded-lg text-slate-500 hover:bg-slate-200 hover:text-slate-700 active:scale-90 transition-all"
        >
          <Minus size={14} />
        </button>
        <button
          type="button"
          onClick={() => onIncrement(item.id)}
          aria-label={`Aumentar ${item.name}`}
          className="p-2 rounded-lg text-emerald-600 hover:bg-emerald-100 active:scale-90 transition-all"
        >
          <Plus size={14} />
        </button>
        <button
          type="button"
          onClick={() => onRemove(item.id)}
          aria-label={`Remover ${item.name}`}
          className="p-2 rounded-lg text-red-500 hover:bg-red-100 active:scale-90 transition-all"
        >
          <Trash2 size={14} />
        </button>
      </div>

      {/* Total */}
      <span className="text-sm font-bold text-slate-800 min-w-[72px] text-right">
        {formatBRL(total)}
      </span>
    </li>
  );
}
