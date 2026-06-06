type ComandaHeaderProps = {
  status: string;
  title: string;
};

export function ComandaHeader({ status, title }: ComandaHeaderProps) {
  return (
    <header className="comanda-header">
      <div>
        <h2>{title}</h2>
        <p>Painel operacional de comanda</p>
      </div>
      <span className="comanda-status">{status}</span>
    </header>
  );
}
