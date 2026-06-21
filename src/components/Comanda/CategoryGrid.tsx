import { Maximize2, Minimize2 } from 'lucide-react';

import type { Categoria } from '@/types/comanda';

type CategoryGridProps = {
  categories: Categoria[];
  activeId: string;
  onSelect: (id: string) => void;
  disabledIds?: string[];
  expanded?: boolean;
  onToggleExpand?: () => void;
};

export function CategoryGrid({
  categories,
  activeId,
  onSelect,
  disabledIds = [],
  expanded = false,
  onToggleExpand,
}: CategoryGridProps) {
  return (
    <section className="comanda-panel">
      <div className="comanda-panel-heading">
        <p className="panel-label">Categorias</p>
        {onToggleExpand && (
          <button
            type="button"
            className="comanda-expand-button"
            onClick={onToggleExpand}
            aria-label={expanded ? 'Restaurar visualizacao' : 'Expandir visualizacao'}
            title={expanded ? 'Restaurar visualizacao' : 'Expandir visualizacao'}
          >
            {expanded ? <Minimize2 size={20} /> : <Maximize2 size={20} />}
          </button>
        )}
      </div>
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
