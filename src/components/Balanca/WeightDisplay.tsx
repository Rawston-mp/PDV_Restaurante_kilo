import { useEffect, useMemo, useState } from 'react';

import { useWebSocket } from '@/hooks/useWebSocket';

type ScaleEventPayload = {
  peso: number;
  timestamp?: string;
  origem?: string;
};

export interface WeightDisplayProps {
  weight?: number;
  unit?: 'kg' | 'g';
  isLoading?: boolean;
  error?: string | null;
  realtimeEnabled?: boolean;
  wsUrl?: string;
  criticalThreshold?: number;
}

const isScaleEvent = (payload: unknown): payload is ScaleEventPayload => {
  if (typeof payload !== 'object' || payload === null) {
    return false;
  }

  const maybe = payload as Partial<ScaleEventPayload>;
  return typeof maybe.peso === 'number' && Number.isFinite(maybe.peso) && maybe.peso >= 0;
};

export function WeightDisplay({
  weight,
  unit = 'kg',
  isLoading = false,
  error = null,
  realtimeEnabled = true,
  wsUrl,
  criticalThreshold = 1.5
}: WeightDisplayProps) {
  const [displayWeight, setDisplayWeight] = useState<number>(weight ?? 0);

  const { isConnected, lastMessage, error: socketError } = useWebSocket<ScaleEventPayload>({
    url: wsUrl,
    enabled: realtimeEnabled,
    eventName: 'atualizar_peso',
    validatePayload: isScaleEvent
  });

  useEffect(() => {
    if (typeof weight === 'number' && Number.isFinite(weight)) {
      setDisplayWeight(weight);
    }
  }, [weight]);

  useEffect(() => {
    if (lastMessage) {
      setDisplayWeight(lastMessage.peso);
    }
  }, [lastMessage]);

  const effectiveError = error ?? socketError;

  const visualState = useMemo(() => {
    if (effectiveError) {
      return 'error';
    }

    if (displayWeight >= criticalThreshold) {
      return 'critical';
    }

    return 'normal';
  }, [displayWeight, criticalThreshold, effectiveError]);

  const borderClass =
    visualState === 'error'
      ? 'is-error'
      : visualState === 'critical'
        ? 'is-critical'
        : 'is-normal';

  return (
    <section className="balanca-card weight-display-card">
      <header className="balanca-card-header">
        <h2>Peso da balanca</h2>
        <span
          className={[
            'balanca-status-pill',
            isConnected ? 'is-connected' : 'is-offline'
          ].join(' ')}
        >
          {isConnected ? 'Tempo real' : 'Offline'}
        </span>
      </header>

      <div className={['weight-display-main', borderClass].join(' ')}>
        {isLoading ? (
          <div className="weight-loading">--</div>
        ) : effectiveError ? (
          <div>
            <p className="balanca-error">Falha na leitura</p>
            <p className="balanca-error-detail">{effectiveError}</p>
          </div>
        ) : (
          <div>
            <p className="weight-value">{displayWeight.toFixed(3)}</p>
            <p className="weight-unit">{unit}</p>
          </div>
        )}
      </div>

      <footer className="balanca-footer-note">
        <p>
          {visualState === 'critical' ? 'Atencao: peso alto, confirme a leitura.' : 'Leitura estavel.'}
        </p>
        <p>Touch-safe 44px+</p>
      </footer>
    </section>
  );
}

export function WeightDisplayExample() {
  return (
    <div>
      <WeightDisplay realtimeEnabled criticalThreshold={1.2} />
    </div>
  );
}
