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
  imageUrl?: string;
  sourceComanda?: string;
  source?: 'BALANCA' | 'CAIXA';
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
    <li className="flex min-w-0 items-center gap-2 border-b border-slate-100 px-3 py-2">
      <div className="h-11 w-11 shrink-0 overflow-hidden rounded-lg border border-slate-200 bg-slate-100">
        {item.imageUrl ? (
          <img src={item.imageUrl} alt={item.name} className="h-full w-full object-cover" />
        ) : (
          <div className="h-full w-full bg-gradient-to-br from-slate-100 to-slate-200" />
        )}
      </div>

      <div className="flex min-w-0 flex-1 items-center gap-2 overflow-hidden whitespace-nowrap">
        <p className="min-w-[72px] flex-1 truncate text-sm font-semibold text-slate-800" title={item.name}>
          {item.name}
        </p>
        {item.sourceComanda ? (
          <span className="shrink-0 text-[10px] font-semibold text-sky-600">
            Comanda #{item.sourceComanda} · {item.source === 'BALANCA' ? 'Balança' : 'Caixa'}
          </span>
        ) : null}
        <span className="shrink-0 text-xs text-slate-500">
          {isKg
            ? `${item.quantity.toLocaleString('pt-BR', { minimumFractionDigits: 3, maximumFractionDigits: 3 })} kg · ${formatBRL(item.unitPrice)} / kg`
            : `${item.quantity.toLocaleString('pt-BR', {
                minimumFractionDigits: 0,
                maximumFractionDigits: 0,
              })} un · ${formatBRL(item.unitPrice)} / un`}
        </span>
        <span className="shrink-0 text-[10px] text-slate-500">
          ID {item.productCode ?? '--'}
        </span>
      </div>

      {!isKg ? (
        <div className="inline-flex shrink-0 items-center overflow-hidden rounded-lg border border-slate-200">
          <button
            type="button"
            onClick={() => onDecrement(item.id)}
            aria-label={`Diminuir ${item.name}`}
            className="h-10 w-10 text-slate-500 transition-colors hover:bg-slate-100"
          >
            <Minus size={14} className="mx-auto" />
          </button>
          <span className="flex h-10 min-w-10 items-center justify-center border-x border-slate-200 px-2 text-sm font-semibold text-slate-700">
            {item.quantity.toLocaleString('pt-BR', {
              minimumFractionDigits: 0,
              maximumFractionDigits: 0,
            })}
          </span>
          <button
            type="button"
            onClick={() => onIncrement(item.id)}
            aria-label={`Aumentar ${item.name}`}
            className="h-10 w-10 text-sky-600 transition-colors hover:bg-sky-50"
          >
            <Plus size={14} className="mx-auto" />
          </button>
        </div>
      ) : null}

      <p className="min-w-[78px] shrink-0 text-right text-base font-bold text-slate-800">{formatBRL(total)}</p>
      <button
        type="button"
        onClick={() => onRemove(item.id)}
        aria-label={`Remover ${item.name}`}
        className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600"
      >
        <Trash2 size={16} />
      </button>
    </li>
  );
}
