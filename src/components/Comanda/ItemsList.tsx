import type { ItemComanda } from '@/types/comanda';

type ItemsListProps = {
  items: ItemComanda[];
  onDelete: (id: string) => void;
  onAdjust: (id: string, delta: number) => void;
};

export function ItemsList({ items, onDelete, onAdjust }: ItemsListProps) {
  return (
    <section className="comanda-panel comanda-items-panel">
      <p className="panel-label">Itens lancados</p>
      {items.length === 0 ? (
        <p className="comanda-empty">Nenhum item adicionado.</p>
      ) : (
        <div className="comanda-items">
          {items.map((item) => (
            <article key={item.id} className="comanda-item-row">
              <div>
                <strong>{item.nome}</strong>
                <small>
                  {item.porUnidade ? `${item.quantidade.toFixed(0)} un` : `${item.quantidade.toFixed(3)} kg`} | R$ {item.subtotal.toFixed(2)}
                </small>
              </div>
              <div className="comanda-item-actions">
                <button type="button" onClick={() => onAdjust(item.id, -1)}>-</button>
                <button type="button" onClick={() => onAdjust(item.id, 1)}>+</button>
                <button type="button" className="is-danger" onClick={() => onDelete(item.id)}>Excluir</button>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
