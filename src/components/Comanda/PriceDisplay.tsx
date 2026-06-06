type PriceDisplayProps = {
  value: number;
};

export function PriceDisplay({ value }: PriceDisplayProps) {
  return (
    <section className="comanda-panel price-panel">
      <p className="panel-label">Preco de referencia</p>
      <p className="panel-value panel-value-success">R$ {value.toFixed(2)}</p>
    </section>
  );
}
