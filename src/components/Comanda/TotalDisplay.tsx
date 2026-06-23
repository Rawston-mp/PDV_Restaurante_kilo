type TotalDisplayProps = {
  total: number;
};

const formatCurrency = (value: number) =>
  value.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  });

export function TotalDisplay({ total }: TotalDisplayProps) {
  return (
    <section className="comanda-panel total-panel">
      <p className="is-total">
        <span>Total da comanda</span>
        <strong>{formatCurrency(total)}</strong>
      </p>
    </section>
  );
}
