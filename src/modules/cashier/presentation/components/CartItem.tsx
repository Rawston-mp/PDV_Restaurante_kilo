import { Check, Minus, Pencil, Plus, Trash2, X } from 'lucide-react';
import { useState } from 'react';
import { formatBRL } from '../../types';

export type CashierCartItem = {
  id: string;
  name: string;
  description?: string;
  quantity: number;
  unitPrice: number;
  unit: 'KG' | 'UN';
  category?: string;
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
  createdInCashier?: boolean;
};

type CartItemProps = {
  item: CashierCartItem;
  showSource?: boolean;
  onIncrement: (id: string) => void;
  onDecrement: (id: string) => void;
  onRemove: (id: string) => void;
  onEditValue?: (id: string, value: string) => boolean;
};

export function CartItem({ item, showSource = false, onIncrement, onDecrement, onRemove, onEditValue }: CartItemProps) {
  const [isEditingValue, setIsEditingValue] = useState(false);
  const [editableValue, setEditableValue] = useState('');
  const total = item.quantity * item.unitPrice;
  const isKg = item.unit === 'KG';
  const canEditValue = isKg && Boolean(item.createdInCashier) && Boolean(onEditValue);
  const formattedQuantity = item.quantity.toLocaleString('pt-BR', {
    minimumFractionDigits: isKg ? 3 : 0,
    maximumFractionDigits: isKg ? 3 : 0,
  });
  const formattedTotalInput = total.toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  const openValueEditor = () => {
    if (!canEditValue) {
      return;
    }

    setEditableValue(formattedTotalInput);
    setIsEditingValue(true);
  };

  const cancelValueEditor = () => {
    setEditableValue('');
    setIsEditingValue(false);
  };

  const confirmValueEditor = () => {
    const wasUpdated = onEditValue?.(item.id, editableValue);
    if (wasUpdated) {
      setIsEditingValue(false);
    }
  };

  return (
    <li
      className={`grid min-h-16 grid-cols-[minmax(0,1fr)_auto] items-center gap-2 border-b border-slate-200 px-3 py-2 ${canEditValue ? 'hover:bg-sky-50' : ''}`}
      title={canEditValue ? 'Clique para editar o valor lançado no caixa' : undefined}
    >
      <div className="flex-1 min-w-0">
        <p className="truncate text-sm font-bold text-slate-900">{item.name}</p>
        <p className="mt-0.5 truncate text-xs font-medium text-sky-700">
          {showSource && item.sourceComandaNumber ? `Comanda #${item.sourceComandaNumber} · ` : ''}
          {formattedQuantity} {isKg ? 'kg' : 'un'} · {formatBRL(item.unitPrice)} / {isKg ? 'kg' : 'un'}
        </p>
      </div>

      <div className="flex shrink-0 items-center gap-1.5">
        {isEditingValue ? (
          <form
            className="flex items-center gap-1.5 rounded-xl border border-sky-200 bg-white p-1.5 shadow-lg shadow-slate-200"
            onSubmit={(event) => {
              event.preventDefault();
              event.stopPropagation();
              confirmValueEditor();
            }}
            onMouseDown={(event) => event.stopPropagation()}
            onClick={(event) => event.stopPropagation()}
          >
            <span className="pl-2 text-xs font-black text-slate-500">R$</span>
            <input
              autoFocus
              value={editableValue}
              onChange={(event) => setEditableValue(event.target.value.replace(/[^\d,.]/g, ''))}
              onKeyDown={(event) => {
                if (event.key === 'Escape') {
                  event.preventDefault();
                  cancelValueEditor();
                }
              }}
              inputMode="decimal"
              aria-label={`Valor de ${item.name}`}
              className="h-10 w-24 rounded-lg border border-slate-200 bg-slate-50 px-2 text-right text-sm font-black text-slate-900 outline-none focus:border-sky-400 focus:bg-white"
            />
            <button
              type="submit"
              onClick={(event) => event.stopPropagation()}
              aria-label={`Confirmar valor de ${item.name}`}
              title="Confirmar valor"
              className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500 text-white transition-colors hover:bg-emerald-600"
            >
              <Check size={16} />
            </button>
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                cancelValueEditor();
              }}
              aria-label={`Cancelar edição de ${item.name}`}
              title="Cancelar edição"
              className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 text-slate-500 transition-colors hover:bg-slate-100"
            >
              <X size={16} />
            </button>
          </form>
        ) : (
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              openValueEditor();
            }}
            disabled={!canEditValue}
            aria-label={canEditValue ? `Editar valor de ${item.name}` : undefined}
            title={canEditValue ? 'Editar valor do lançamento' : undefined}
            className={`flex min-w-[72px] items-center justify-end gap-1 rounded-lg px-2 py-1 text-right text-base font-black ${
              canEditValue
                ? 'text-slate-900 transition-colors hover:bg-sky-50 hover:text-sky-700'
                : 'cursor-default text-slate-900'
            }`}
          >
            {formatBRL(total)}
            {canEditValue && <Pencil size={13} className="text-sky-500" />}
          </button>
        )}
        <div className="inline-flex items-center gap-1.5">
          {!isKg && (
            <>
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
            </>
          )}
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onRemove(item.id);
            }}
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
