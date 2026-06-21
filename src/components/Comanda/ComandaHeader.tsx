import { CloudOff, LoaderCircle, RefreshCw, Scale, Wifi } from 'lucide-react';

export type ComandaStatusTone = 'neutral' | 'success' | 'warning' | 'danger' | 'syncing';

type ComandaHeaderProps = {
  status: string;
  title: string;
  subtitle: string;
  tone?: ComandaStatusTone;
  pendingSyncCount?: number;
  onRetry?: () => void;
};

const statusIcon = {
  neutral: Scale,
  success: Wifi,
  warning: CloudOff,
  danger: CloudOff,
  syncing: LoaderCircle
} as const;

export function ComandaHeader({
  status,
  title,
  subtitle,
  tone = 'neutral',
  pendingSyncCount = 0,
  onRetry
}: ComandaHeaderProps) {
  const StatusIcon = statusIcon[tone];

  return (
    <header className="comanda-header">
      <div className="comanda-header-title">
        <span className="comanda-header-icon" aria-hidden="true">
          <Scale size={22} />
        </span>
        <div>
          <h2>{title}</h2>
          <p>{subtitle}</p>
        </div>
      </div>

      <div className="comanda-header-status">
        <span className={'comanda-status is-' + tone}>
          <StatusIcon size={15} className={tone === 'syncing' ? 'is-spinning' : ''} />
          {status}
        </span>

        {pendingSyncCount > 0 && (
          <span className="comanda-sync-pending">
            {pendingSyncCount} {pendingSyncCount === 1 ? 'alteracao pendente' : 'alteracoes pendentes'}
          </span>
        )}

        {onRetry && (tone === 'warning' || tone === 'danger') && (
          <button type="button" className="comanda-retry-button" onClick={onRetry}>
            <RefreshCw size={15} />
            Tentar novamente
          </button>
        )}
      </div>
    </header>
  );
}
