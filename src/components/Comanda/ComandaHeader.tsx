type ComandaHeaderProps = {
  status: string;
  title: string;
  isOfflineMode?: boolean;
};

export function ComandaHeader({ status, title, isOfflineMode = false }: ComandaHeaderProps) {
  return (
    <header className="comanda-header">
      <div>
        <h2>{title}</h2>
        <p>Painel operacional de comanda</p>
      </div>
      <div className="flex items-center gap-2">
        {isOfflineMode && (
          <span className="rounded-full border border-amber-300 bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-800">
            MODO LOCAL
          </span>
        )}
        <span className="comanda-status">{status}</span>
      </div>
    </header>
  );
}
