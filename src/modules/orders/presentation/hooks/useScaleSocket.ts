import { useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';

import { saveWeightHistoryLocal } from '@/modules/orders/infrastructure/local/comandaPersistence';
import { applyWeightFilter } from '@/modules/orders/presentation/utils/weightFilter';

type PesoSensorPayload = {
  peso: number;
  origem?: string;
  timestamp?: string;
};

export function useScaleSocket(enabled = true, comandaAtiva = false) {
  const [weight, setWeight] = useState<number | null>(null);
  const [connected, setConnected] = useState(false);
  const stableWeightRef = useRef<number | null>(null);
  const filterHistoryRef = useRef<number[]>([]);
  const pendingWeightRef = useRef<number | null>(null);
  const debounceTimerRef = useRef<number | null>(null);

  useEffect(() => {
    stableWeightRef.current = weight;
  }, [weight]);

  useEffect(() => {
    if (!enabled) {
      setConnected(false);
      filterHistoryRef.current = [];
      return;
    }

    const socket = io(import.meta.env.VITE_WS_URL ?? 'http://localhost:3001', {
      transports: ['websocket']
    });

    socket.on('connect', () => {
      setConnected(true);
    });

    socket.on('disconnect', () => {
      setConnected(false);
    });

    socket.on('atualizar_peso', (payload: PesoSensorPayload) => {
      if (Number.isFinite(payload.peso) && payload.peso > 0) {
        const filtered = applyWeightFilter(
          payload.peso,
          {
            history: filterHistoryRef.current,
            stableWeight: stableWeightRef.current
          },
          {
            windowSize: 4,
            stabilityTolerance: 0.03,
            maxJump: 1.2
          }
        );

        filterHistoryRef.current = filtered.history;

        if (filtered.stableWeight !== null) {
          pendingWeightRef.current = filtered.stableWeight;

          if (debounceTimerRef.current === null) {
            debounceTimerRef.current = window.setTimeout(() => {
              if (pendingWeightRef.current !== null) {
                const stableWeight = pendingWeightRef.current;
                setWeight(stableWeight);
                void saveWeightHistoryLocal({
                  id: `wh-${crypto.randomUUID()}`,
                  peso: stableWeight,
                  origem: payload.origem,
                  comandaAtiva,
                  receivedAt: new Date(payload.timestamp ?? Date.now())
                });
              }

              pendingWeightRef.current = null;
              debounceTimerRef.current = null;
            }, 150);
          }
        }
      }
    });

    return () => {
      if (debounceTimerRef.current !== null) {
        clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }
      socket.disconnect();
    };
  }, [enabled, comandaAtiva]);

  return {
    weight,
    connected
  };
}
