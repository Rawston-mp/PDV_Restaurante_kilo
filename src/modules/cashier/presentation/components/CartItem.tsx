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
  cstIcms?: string;
  fiscalType?: string;
  aliqIcms?: string;
  aliqPis?: string;
  aliqCofins?: string;
  imageUrl?: string;
  sourceComandaNumber?: string;
  sourceItemId?: string;
  catalogProductId?: string;
};

type CartItemProps = {
  item: CashierCartItem;
  showSource?: boolean;
  onIncrement: (id: string) => void;
  onDecrement: (id: string) => void;
  onRemove: (id: string) => void;
};

export function CartItem({ item, showSource = false, onIncrement, onDecrement, onRemove }: CartItemProps) {
  const total = item.quantity * item.unitPrice;
  const isKg = item.unit === 'KG';
  const formattedQuantity = item.quantity.toLocaleString('pt-BR', {
    minimumFractionDigits: isKg ? 3 : 0,
    maximumFractionDigits: isKg ? 3 : 0,
  });

  return (
    <li className="grid min-h-16 grid-cols-[minmax(0,1fr)_auto] items-center gap-2 border-b border-slate-200 px-3 py-2">
      <div className="flex-1 min-w-0">
        <p className="truncate text-sm font-bold text-slate-900">{item.name}</p>
        <p className="mt-0.5 truncate text-xs font-medium text-sky-700">
          {showSource && item.sourceComandaNumber ? `Comanda #${item.sourceComandaNumber} · ` : ''}
          {formattedQuantity} {isKg ? 'kg' : 'un'} · {formatBRL(item.unitPrice)} / {isKg ? 'kg' : 'un'}
        </p>
      </div>

      <div className="flex shrink-0 items-center gap-1.5">
        <p className="min-w-[72px] text-right text-base font-black text-slate-900">{formatBRL(total)}</p>
        <div className="inline-flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => onDecrement(item.id)}
            aria-label={`Diminuir ${item.name}`}
            title="Diminuir quantidade"
            className="inline-flex h-12 w-12 items-center justify-center rounded-md border border-slate-300 text-slate-600 transition-colors hover:border-sky-300 hover:bg-sky-50 hover:text-sky-700"
          >
            <Minus size={17} />
          </button>
          <button
            type="button"
            onClick={() => onIncrement(item.id)}
            aria-label={`Aumentar ${item.name}`}
            title="Aumentar quantidade"
            className="inline-flex h-12 w-12 items-center justify-center rounded-md border border-sky-300 text-sky-700 transition-colors hover:bg-sky-50"
          >
            <Plus size={17} />
          </button>
          <button
            type="button"
            onClick={() => onRemove(item.id)}
            aria-label={`Remover ${item.name}`}
            title="Remover item"
            className="inline-flex h-12 w-12 items-center justify-center rounded-md border border-red-300 bg-red-50 text-red-700 transition-colors hover:bg-red-100"
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>
    </li>
  );
}
