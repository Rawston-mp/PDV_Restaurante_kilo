import { EllipsisVertical, EyeOff, PackageX, PlusCircle } from 'lucide-react';
import { useState } from 'react';
import { formatBRL } from '../../types';

export type CashierProduct = {
  id: string;
  name: string;
  description?: string;
  category: string;
  price: number;
  unit: 'KG' | 'UN';
  isUnavailable?: boolean;
  isHidden?: boolean;
  productCode?: string;
  barcode?: string;
  ncm?: string;
  cfop?: string;
  fiscalType?: string;
  taxSituationCode?: string;
  imageUrl?: string;
};

type ProductCardProps = {
  product: CashierProduct;
  onAdd: (product: CashierProduct) => void;
  onToggleUnavailable: (product: CashierProduct) => void;
  onToggleHidden: (product: CashierProduct) => void;
};

export function ProductCard({ product, onAdd, onToggleUnavailable, onToggleHidden }: ProductCardProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const isKg = product.unit === 'KG';
  const isDisabled = Boolean(product.isUnavailable);

  return (
    <div
      className={`
        group relative flex flex-col
        w-full rounded-2xl
        border border-slate-200 bg-white
        text-left
        hover:border-sky-300 hover:shadow-md
        transition-all duration-150
        overflow-hidden
        ${isDisabled ? 'opacity-70' : 'cursor-pointer active:scale-95'}
      `}
    >
      <button
        type="button"
        onClick={() => {
          if (!isDisabled) {
            onAdd(product);
          }
        }}
        aria-label={`Adicionar ${product.name}`}
        disabled={isDisabled}
        className="text-left"
      >
        <div className="relative h-32 bg-slate-100">
          {product.imageUrl ? (
            <img
              src={product.imageUrl}
              alt={product.name}
              loading="lazy"
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="h-full w-full bg-gradient-to-br from-slate-100 to-slate-200" />
          )}
          {isKg && (
            <span className="absolute top-2 right-2 text-[10px] font-bold px-2 py-0.5 rounded-full bg-white/90 text-amber-700 uppercase tracking-wide border border-amber-200">
              KG
            </span>
          )}
          {product.isUnavailable && (
            <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-rose-600/95 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white shadow-sm">
              <PackageX size={11} /> Indisponivel
            </span>
          )}
          {product.isHidden && (
            <span className="absolute left-2 bottom-2 inline-flex items-center gap-1 rounded-full bg-slate-900/85 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white shadow-sm">
              <EyeOff size={11} /> Oculto
            </span>
          )}
        </div>

        <div className="p-3.5">
          <strong className="text-lg font-semibold text-slate-800 leading-tight line-clamp-1">
            {product.name}
          </strong>
          {product.description ? (
            <p className="mt-1 text-xs text-slate-500 line-clamp-2">{product.description}</p>
          ) : null}
          <p className="mt-1 text-[11px] text-slate-500 line-clamp-1">
            ID {product.productCode ?? '--'}
          </p>
          <span className="mt-1 block text-2xl font-bold text-sky-600">
            {formatBRL(product.price)}
            {isKg && <span className="text-xs font-medium text-slate-400 ml-1">/kg</span>}
          </span>
        </div>
      </button>

      <div className="absolute right-2 top-2 z-20 flex items-start gap-2">
        <div className="relative">
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              setMenuOpen((prev) => !prev);
            }}
            className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 shadow-sm hover:bg-slate-50"
            aria-label={`Abrir ações de ${product.name}`}
          >
            <EllipsisVertical size={16} />
          </button>

          {menuOpen && (
            <div className="absolute right-0 top-10 z-30 w-48 rounded-xl border border-slate-200 bg-white p-1 shadow-xl">
              <button
                type="button"
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
                onClick={(event) => {
                  event.stopPropagation();
                  onToggleUnavailable(product);
                  setMenuOpen(false);
                }}
              >
                <PackageX size={16} className="text-rose-500" />
                {product.isUnavailable ? 'Tornar disponivel' : 'Tornar indisponivel'}
              </button>
              <button
                type="button"
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
                onClick={(event) => {
                  event.stopPropagation();
                  onToggleHidden(product);
                  setMenuOpen(false);
                }}
              >
                <EyeOff size={16} className="text-slate-500" />
                {product.isHidden ? 'Mostrar no caixa' : 'Ocultar no caixa'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
