import type { Categoria } from '@/types/comanda';

type CategoryGridProps = {
  categories: Categoria[];
  activeId: string;
  onSelect: (id: string) => void;
  disabledIds?: string[];
};

export function CategoryGrid({ categories, activeId, onSelect, disabledIds = [] }: CategoryGridProps) {
  return (
    <section className="comanda-panel">
      <p className="panel-label">Categorias</p>
      <div className="comanda-categories">
        {categories.map((category) => {
          const isDisabled = disabledIds.includes(category.id);

          return (
            <button
              key={category.id}
              type="button"
              className={activeId === category.id ? 'is-active' : ''}
              onClick={() => onSelect(category.id)}
              disabled={isDisabled}
              style={{ borderColor: category.cor }}
            >
              {category.nome}
            </button>
          );
        })}
      </div>
    </section>
  );
}
