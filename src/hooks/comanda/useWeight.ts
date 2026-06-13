import { useEffect, useMemo, useState } from 'react';

import { useWebSocket } from '@/hooks/useWebSocket';

type PesoPayload = {
  peso: number;
  origem?: string;
  timestamp?: string;
};

const isPesoPayload = (payload: unknown): payload is PesoPayload => {
  if (typeof payload !== 'object' || payload === null) {
    return false;
  }

  const maybePeso = (payload as { peso?: unknown }).peso;
  return typeof maybePeso === 'number' && Number.isFinite(maybePeso);
};

export function useWeight(enabled = true) {
  const [pesoSensor, setPesoSensor] = useState(0);
  const [pesoManual, setPesoManual] = useState<number | null>(null);
  const { isConnected, lastMessage } = useWebSocket<PesoPayload>({
    eventName: 'atualizar_peso',
    enabled,
    validatePayload: isPesoPayload
  });

  useEffect(() => {
    if (!lastMessage) {
      return;
    }

    if (lastMessage.peso > 0) {
      setPesoSensor(Number(lastMessage.peso.toFixed(3)));
    }
  }, [lastMessage]);

  const pesoAtual = useMemo(() => {
    if (pesoManual !== null && pesoManual > 0) {
      return pesoManual;
    }
    return pesoSensor;
  }, [pesoSensor, pesoManual]);

  return {
    pesoSensor,
    pesoManual,
    pesoAtual,
    isComandaConectada: isConnected,
    setPesoSensor,
    setPesoManual
  };
}
