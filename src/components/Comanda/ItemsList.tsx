import { Minus, Plus, Trash2 } from 'lucide-react';

import type { ItemComanda } from '@/types/comanda';

type ItemsListProps = {
  items: ItemComanda[];
  onDelete: (id: string) => void;
  onAdjust: (id: string, delta: number) => void;
  canDelete?: boolean;
};

const formatCurrency = (value: number) =>
  value.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  });

export function ItemsList({ items, onDelete, onAdjust, canDelete = true }: ItemsListProps) {
  return (
    <section className="comanda-panel comanda-items-panel">
      <div className="comanda-items-header">
        <p className="panel-label">Itens lancados</p>
        <span>{items.length} {items.length === 1 ? 'item' : 'itens'}</span>
      </div>
      {items.length === 0 ? (
        <p className="comanda-empty">Nenhum item adicionado nesta comanda.</p>
      ) : (
        <div className="comanda-items">
          {items.map((item) => (
            <article key={item.id} className="comanda-item-row">
              <div className="comanda-item-description">
                <strong>{item.nome}</strong>
                <small>
                  {item.porUnidade ? `${item.quantidade.toFixed(0)} un` : `${item.quantidade.toFixed(3)} kg`}
                  <span aria-hidden="true"> · </span>
                  {formatCurrency(item.precoUnitario)} {item.porUnidade ? '/ un' : '/ kg'}
                </small>
              </div>
              <strong className="comanda-item-subtotal">{formatCurrency(item.subtotal)}</strong>
              <div className="comanda-item-actions">
                <button type="button" onClick={() => onAdjust(item.id, -1)} aria-label={`Diminuir ${item.nome}`}>
                  <Minus size={18} />
                </button>
                <button type="button" onClick={() => onAdjust(item.id, 1)} aria-label={`Aumentar ${item.nome}`}>
                  <Plus size={18} />
                </button>
                <button
                  type="button"
                  className="is-danger"
                  onClick={() => onDelete(item.id)}
                  aria-label={`Excluir ${item.nome}`}
                  disabled={!canDelete}
                  title={canDelete ? 'Excluir item' : 'Somente caixa, gerente ou administrador pode excluir'}
                >
                  <Trash2 size={18} />
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
