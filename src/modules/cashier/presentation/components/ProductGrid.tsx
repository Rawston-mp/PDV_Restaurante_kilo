import { PackageOpen } from 'lucide-react';
import { ProductCard, type CashierProduct } from './ProductCard';

type ProductGridProps = {
  products: CashierProduct[];
  onAdd: (product: CashierProduct) => void;
  loading?: boolean;
};

export function ProductGrid({ products, onAdd, loading }: ProductGridProps) {
  if (loading) {
    return (
      <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 gap-2 p-2">
        {Array.from({ length: 15 }).map((_, i) => (
          <div
            key={i}
            className="h-20 rounded-xl bg-slate-100 animate-pulse"
          />
        ))}
      </div>
    );
  }

  if (products.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-48 text-slate-400 gap-3">
        <PackageOpen size={36} strokeWidth={1.2} />
        <p className="text-sm">Nenhum produto encontrado</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 gap-2 p-0 content-start">
      {products.map((product) => (
        <ProductCard key={product.id} product={product} onAdd={onAdd} />
      ))}
    </div>
  );
}
