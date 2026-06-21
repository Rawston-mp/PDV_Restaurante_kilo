type TotalDisplayProps = {
  subtotal: number;
  impostos: number;
  total: number;
};

const formatCurrency = (value: number) =>
  value.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  });

export function TotalDisplay({ subtotal, impostos, total }: TotalDisplayProps) {
  return (
    <section className="comanda-panel total-panel">
      <div className="total-panel-breakdown">
        <p><span>Subtotal</span><strong>{formatCurrency(subtotal)}</strong></p>
        {impostos > 0 && (
          <p><span>Acréscimos</span><strong>{formatCurrency(impostos)}</strong></p>
        )}
      </div>
      <p className="is-total">
        <span>Total da comanda</span>
        <strong>{formatCurrency(total)}</strong>
      </p>
    </section>
  );
}
