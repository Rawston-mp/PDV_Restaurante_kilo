import { useEffect, useMemo, useState } from 'react';

import { useWebSocket } from '@/hooks/useWebSocket';

type PriceEventPayload = {
  precoPorKg: number;
  timestamp?: string;
};

export interface PriceDisplayProps {
  weight: number;
  unitPrice?: number;
  unitLabel?: 'kg' | 'un';
  currency?: 'BRL';
  isLoading?: boolean;
  error?: string | null;
  realtimeEnabled?: boolean;
  wsUrl?: string;
  urgencyThreshold?: number;
}

const isPriceEvent = (payload: unknown): payload is PriceEventPayload => {
  if (typeof payload !== 'object' || payload === null) {
    return false;
  }

  const maybe = payload as Partial<PriceEventPayload>;
  return typeof maybe.precoPorKg === 'number' && Number.isFinite(maybe.precoPorKg) && maybe.precoPorKg >= 0;
};

export function PriceDisplay({
  weight,
  unitPrice = 69.9,
  unitLabel = 'kg',
  currency = 'BRL',
  isLoading = false,
  error = null,
  realtimeEnabled = true,
  wsUrl,
  urgencyThreshold = 120
}: PriceDisplayProps) {
  const [displayUnitPrice, setDisplayUnitPrice] = useState(unitPrice);

  const { isConnected, lastMessage, error: socketError } = useWebSocket<PriceEventPayload>({
    url: wsUrl,
    enabled: realtimeEnabled,
    eventName: 'atualizar_preco',
    validatePayload: isPriceEvent
  });

  useEffect(() => {
    setDisplayUnitPrice(unitPrice);
  }, [unitPrice]);

  useEffect(() => {
    if (lastMessage) {
      setDisplayUnitPrice(lastMessage.precoPorKg);
    }
  }, [lastMessage]);

  const effectiveError = error ?? socketError;
  const total = useMemo(() => Number((weight * displayUnitPrice).toFixed(2)), [weight, displayUnitPrice]);

  const formatter = useMemo(
    () =>
      new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency
      }),
    [currency]
  );

  const urgencyLabel = total >= urgencyThreshold ? 'Valor alto: confirmar antes de incluir.' : 'Valor dentro da faixa esperada.';

  return (
    <section className="balanca-card price-display-card">
      <header className="balanca-card-header">
        <h2>Preco dinamico</h2>
        <span
          className={[
            'balanca-status-pill',
            isConnected ? 'is-connected' : 'is-offline'
          ].join(' ')}
        >
          {isConnected ? 'Sync de preco' : 'Sem sync'}
        </span>
      </header>

      <div className="price-display-main">
        {isLoading ? (
          <div className="price-loading">--</div>
        ) : effectiveError ? (
          <div>
            <p className="balanca-error">Erro ao calcular preco</p>
            <p className="balanca-error-detail">{effectiveError}</p>
          </div>
        ) : (
          <>
            <p className="balanca-muted">Total atual</p>
            <p className="price-value">{formatter.format(total)}</p>
            <p className="price-unit">{formatter.format(displayUnitPrice)} / {unitLabel}</p>
          </>
        )}
      </div>

      <footer className="balanca-footer-note">
        <p>{urgencyLabel}</p>
        <p>Venda orientada a margem</p>
      </footer>
    </section>
  );
}

export function PriceDisplayExample() {
  return (
    <div>
      <PriceDisplay weight={0.465} unitPrice={72.5} />
    </div>
  );
}
