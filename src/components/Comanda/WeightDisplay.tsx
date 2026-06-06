type WeightDisplayProps = {
  value: number;
};

export function WeightDisplay({ value }: WeightDisplayProps) {
  return (
    <section className="comanda-panel weight-panel">
      <p className="panel-label">Peso atual</p>
      <p className="panel-value panel-value-warning">{value.toFixed(3)} kg</p>
    </section>
  );
}
