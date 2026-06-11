import { formatBRL } from '../../types';

export type CashierProduct = {
  id: string;
  name: string;
  category: string;
  price: number;
  unit: 'KG' | 'UN';
};

type ProductCardProps = {
  product: CashierProduct;
  onAdd: (product: CashierProduct) => void;
};

export function ProductCard({ product, onAdd }: ProductCardProps) {
  const isKg = product.unit === 'KG';
  return (
    <button
      type="button"
      onClick={() => onAdd(product)}
      aria-label={`Adicionar ${product.name}`}
      className="
        group relative flex flex-col justify-between
        w-full min-h-[80px] p-3 rounded-xl
        border border-slate-200 bg-white
        text-left cursor-pointer
        hover:border-emerald-300 hover:shadow-md hover:bg-emerald-50
        active:scale-95
        transition-all duration-150
      "
    >
      {/* KG badge */}
      {isKg && (
        <span className="absolute top-2 right-2 text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 uppercase tracking-wide">
          KG
        </span>
      )}
      <strong className="text-sm font-semibold text-slate-800 leading-tight pr-6">
        {product.name}
      </strong>
      <span className="mt-1 text-base font-bold text-emerald-600">
        {formatBRL(product.price)}
        {isKg && <span className="text-xs font-normal text-slate-400">/kg</span>}
      </span>
    </button>
  );
}
