import { useMemo } from 'react';

export type ProductCategory = string;

export interface ProductCard {
  id: string;
  name: string;
  category: ProductCategory;
  pricePerKg: number;
  unitLabel?: 'kg' | 'un';
  isPopular?: boolean;
  disabled?: boolean;
}

export interface ProductGridProps {
  products: ProductCard[];
  onSelectProduct: (product: ProductCard) => void;
  activeCategory: ProductCategory;
  onCategoryChange: (category: ProductCategory) => void;
  selectedProductId?: string;
  categories?: ProductCategory[];
  isLoading?: boolean;
  error?: string | null;
}

const categoryPalette = ['is-blue', 'is-gold', 'is-emerald', 'is-sky', 'is-orange', 'is-violet'];

export function ProductGrid({
  products,
  onSelectProduct,
  activeCategory,
  onCategoryChange,
  selectedProductId,
  categories,
  isLoading = false,
  error = null
}: ProductGridProps) {
  const availableCategories = useMemo(() => {
    if (categories && categories.length > 0) {
      return categories;
    }

    const map = new Set(products.map((product) => product.category));
    return Array.from(map);
  }, [categories, products]);

  const groupedProducts = useMemo(() => {
    return products.filter((product) => product.category === activeCategory);
  }, [products, activeCategory]);

  return (
    <section className="balanca-card product-grid-card">
      <header className="balanca-card-header">
        <h2>Selecao rapida</h2>
        <p>Toque unico para incluir</p>
      </header>

      <div className="balanca-category-grid">
        {availableCategories.map((category, index) => (
          <button
            key={category}
            type="button"
            className={[
              'balanca-category-pill',
              categoryPalette[index % categoryPalette.length],
              activeCategory === category ? 'is-active' : ''
            ].join(' ')}
            onClick={() => onCategoryChange(category)}
          >
            {category}
          </button>
        ))}
      </div>

      <div className="balanca-products-wrapper">
        {isLoading ? (
          <p className="balanca-muted">Carregando itens...</p>
        ) : error ? (
          <p className="balanca-error">{error}</p>
        ) : groupedProducts.length === 0 ? (
          <p className="balanca-muted">Sem itens para esta categoria.</p>
        ) : (
          <div className="balanca-products-grid">
            {groupedProducts.map((product) => {
              const isSelected = selectedProductId === product.id;

              return (
                <button
                  key={product.id}
                  type="button"
                  disabled={product.disabled}
                  onClick={() => onSelectProduct(product)}
                  className={[
                    'balanca-product-button',
                    product.disabled
                      ? 'is-disabled'
                      : isSelected
                        ? 'is-selected'
                        : ''
                  ].join(' ')}
                >
                  <div className="balanca-product-head">
                    <p>{product.name}</p>
                    {product.isPopular && (
                      <span className="balanca-popular-badge">
                        Mais vendido
                      </span>
                    )}
                  </div>
                  <p className="balanca-product-price">R$ {product.pricePerKg.toFixed(2)} / {product.unitLabel ?? 'kg'}</p>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}

export function ProductGridExample() {
  const products: ProductCard[] = [
    { id: 'p1', name: 'Suco Detox', category: 'SUCOS', pricePerKg: 32.9, isPopular: true },
    { id: 'p2', name: 'Pudim', category: 'SOBREMESAS', pricePerKg: 58.9 },
    { id: 'p3', name: 'Arroz Integral', category: 'ACOMPANHAMENTOS', pricePerKg: 18.5 },
    { id: 'p4', name: 'Mix de Folhas', category: 'SALADAS', pricePerKg: 22.4 }
  ];

  return (
    <div>
      <ProductGrid
        products={products}
        activeCategory="SUCOS"
        categories={['SUCOS', 'SOBREMESAS', 'ACOMPANHAMENTOS', 'SALADAS']}
        onCategoryChange={() => undefined}
        onSelectProduct={() => undefined}
      />
    </div>
  );
}
