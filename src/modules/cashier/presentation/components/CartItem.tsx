import { Minus, Plus, Trash2 } from 'lucide-react';
import { formatBRL } from '../../types';

export type CashierCartItem = {
  id: string;
  name: string;
  description?: string;
  quantity: number;
  unitPrice: number;
  unit: 'KG' | 'UN';
  productCode?: string;
  barcode?: string;
  ncm?: string;
  cfop?: string;
  taxSituationCode?: string;
  fiscalType?: string;
  aliqIcms?: string;
  aliqPis?: string;
  aliqCofins?: string;
  imageUrl?: string;
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
    <li className="flex items-center gap-3 py-3 px-4 border-b border-slate-100">
      <div className="h-14 w-14 shrink-0 rounded-lg bg-slate-100 overflow-hidden border border-slate-200">
        {item.imageUrl ? (
          <img src={item.imageUrl} alt={item.name} className="h-full w-full object-cover" />
        ) : (
          <div className="h-full w-full bg-gradient-to-br from-slate-100 to-slate-200" />
        )}
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-base font-semibold text-slate-800 truncate">{item.name}</p>
        {item.description ? <p className="text-sm text-slate-500 mt-0.5 line-clamp-2">{item.description}</p> : null}
        <p className="text-sm text-slate-500 mt-0.5">{formatBRL(item.unitPrice)}</p>
        <p className="text-[11px] text-slate-500 mt-0.5 line-clamp-1">
          ID {item.productCode ?? '--'}
        </p>

        <div className="mt-1.5 inline-flex items-center rounded-lg border border-slate-200 overflow-hidden">
          <button
            type="button"
            onClick={() => onDecrement(item.id)}
            aria-label={`Diminuir ${item.name}`}
            className="h-12 w-12 text-slate-500 hover:bg-slate-100 transition-colors"
          >
            <Minus size={14} className="mx-auto" />
          </button>
          <span className="h-12 min-w-[48px] px-2 flex items-center justify-center text-sm font-semibold text-slate-700 border-x border-slate-200">
            {item.quantity.toLocaleString('pt-BR', {
              minimumFractionDigits: isKg ? 3 : 0,
              maximumFractionDigits: isKg ? 3 : 0,
            })}
          </span>
          <button
            type="button"
            onClick={() => onIncrement(item.id)}
            aria-label={`Aumentar ${item.name}`}
            className="h-12 w-12 text-sky-600 hover:bg-sky-50 transition-colors"
          >
            <Plus size={14} className="mx-auto" />
          </button>
        </div>
      </div>

      <div className="min-w-[100px] text-right">
        <p className="text-xl font-bold text-slate-800">{formatBRL(total)}</p>
        <button
          type="button"
          onClick={() => onRemove(item.id)}
          aria-label={`Remover ${item.name}`}
          className="mt-1 inline-flex h-12 w-12 items-center justify-center rounded text-slate-400 hover:bg-red-50 hover:text-red-600 transition-colors"
        >
          <Trash2 size={16} />
        </button>
      </div>
    </li>
  );
}
