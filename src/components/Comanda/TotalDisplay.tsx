type TotalDisplayProps = {
  subtotal: number;
  impostos: number;
  total: number;
};

export function TotalDisplay({ subtotal, impostos, total }: TotalDisplayProps) {
  return (
    <section className="comanda-panel total-panel">
      <p><span>Subtotal</span><strong>R$ {subtotal.toFixed(2)}</strong></p>
      <p><span>Impostos</span><strong>R$ {impostos.toFixed(2)}</strong></p>
      <p className="is-total"><span>Total</span><strong>R$ {total.toFixed(2)}</strong></p>
    </section>
  );
}
