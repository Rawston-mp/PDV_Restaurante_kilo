import { EllipsisVertical, EyeOff, PackageX } from 'lucide-react';
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
  aliqIcms?: string;
  aliqPis?: string;
  aliqCofins?: string;
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
    <div className="group relative h-[188px] w-full overflow-visible">
      <button
        type="button"
        onClick={() => {
          if (!isDisabled) {
            onAdd(product);
          }
        }}
        aria-label={`Adicionar ${product.name}`}
        disabled={isDisabled}
        className={`
          flex h-full w-full flex-col overflow-hidden rounded-xl
          border border-slate-200 bg-white text-left
          transition-all duration-150
          hover:border-sky-300 hover:shadow-md
          ${isDisabled ? 'opacity-70' : 'cursor-pointer active:scale-95'}
        `}
      >
        <div className="relative h-[74px] shrink-0 border-b border-slate-100 bg-slate-50">
          {product.imageUrl ? (
            <img
              src={product.imageUrl}
              alt={product.name}
              loading="lazy"
              className="h-full w-full object-contain p-1"
            />
          ) : (
            <div className="h-full w-full bg-gradient-to-br from-slate-50 to-slate-100" />
          )}

          {isKg && (
            <span className="absolute left-2 bottom-2 rounded-full border border-amber-200 bg-white/95 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-700">
              KG
            </span>
          )}

          {product.isUnavailable && (
            <span className="absolute left-2 top-2 inline-flex max-w-[104px] items-center gap-1 rounded-full bg-rose-600/95 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white shadow-sm">
              <PackageX size={10} />
              <span className="truncate">Indisponível</span>
            </span>
          )}

          {product.isHidden && (
            <span className="absolute left-2 bottom-2 inline-flex max-w-[90px] items-center gap-1 rounded-full bg-slate-900/85 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white shadow-sm">
              <EyeOff size={10} />
              <span className="truncate">Oculto</span>
            </span>
          )}
        </div>

        <div className="flex min-h-0 flex-1 flex-col px-2.5 pb-2.5 pt-2">
          <strong className="line-clamp-2 min-h-[34px] text-[13px] font-bold leading-[17px] text-slate-800">
            {product.name}
          </strong>

          {product.description ? (
            <p className="mt-0.5 line-clamp-1 text-[10px] leading-tight text-slate-500">
              {product.description}
            </p>
          ) : null}

          <p className="mt-0.5 text-[10px] leading-tight text-slate-500">
            ID {product.productCode ?? '--'}
          </p>

          <span className="mt-auto block text-[19px] font-extrabold leading-none text-sky-600">
            {formatBRL(product.price)}
            {isKg && <span className="ml-1 text-[10px] font-medium text-slate-400">/kg</span>}
          </span>
        </div>
      </button>

      <div className="absolute right-2 top-2 z-40" onClick={(event) => event.stopPropagation()}>
        <button
          type="button"
          onClick={() => setMenuOpen((prev) => !prev)}
          className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-white/95 text-slate-500 shadow-sm hover:bg-white"
          aria-label={`Abrir ações de ${product.name}`}
        >
          <EllipsisVertical size={16} />
        </button>

        {menuOpen && (
          <div className="absolute right-0 top-9 z-50 w-[132px] overflow-hidden rounded-md border border-slate-200 bg-white shadow-lg">
            <button
              type="button"
              className="flex min-h-[42px] w-full items-center gap-1.5 px-2.5 text-left text-[11px] font-semibold text-slate-700 hover:bg-slate-50"
              onClick={() => {
                onToggleUnavailable(product);
                setMenuOpen(false);
              }}
            >
              <PackageX size={14} className="shrink-0 text-rose-500" />
              <span className="truncate">{product.isUnavailable ? 'Disponível' : 'Indisponível'}</span>
            </button>
            <button
              type="button"
              className="flex min-h-[42px] w-full items-center gap-1.5 border-t border-slate-100 px-2.5 text-left text-[11px] font-semibold text-slate-700 hover:bg-slate-50"
              onClick={() => {
                onToggleHidden(product);
                setMenuOpen(false);
              }}
            >
              <EyeOff size={14} className="shrink-0 text-slate-500" />
              <span className="truncate">{product.isHidden ? 'Mostrar' : 'Ocultar'}</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
