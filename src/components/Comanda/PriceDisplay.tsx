type PriceDisplayProps = {
  value: number | null;
};

export function PriceDisplay({ value }: PriceDisplayProps) {
  return (
    <section className="comanda-panel price-panel">
      <p className="panel-label">Preco selecionado</p>
      <p className={`panel-value panel-value-success ${value === null ? 'is-placeholder' : ''}`}>
        {value === null ? 'R$ --' : `R$ ${value.toFixed(2)}`}
      </p>
      <small>{value === null ? 'Selecione um produto para ver o preco.' : 'Valor por unidade ou quilograma.'}</small>
    </section>
  );
}
