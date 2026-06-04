import { useEffect, useRef, useState } from 'react';

import {
  loadComandaAtivaLocal,
  saveComandaAtivaLocal
} from '@/modules/orders/infrastructure/local/comandaPersistence';

type ComandaStatusResponse = {
  comandaAtiva: boolean;
};

const apiBaseUrl = import.meta.env.VITE_API_URL ?? 'http://localhost:3001';

async function requestStatus(path: string, method: 'GET' | 'POST') {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json'
    }
  });

  if (!response.ok) {
    throw new Error(`Falha ao processar comanda: ${response.status}`);
  }

  return (await response.json()) as ComandaStatusResponse;
}

export function useComandaStatus() {
  const [comandaAtiva, setComandaAtiva] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const userChangedStateRef = useRef(false);

  useEffect(() => {
    void (async () => {
      const local = await loadComandaAtivaLocal();
      if (local !== null) {
        setComandaAtiva(local);
      }

      try {
        const result = await requestStatus('/comandas/status', 'GET');
        if (!userChangedStateRef.current) {
          setComandaAtiva(result.comandaAtiva);
        }
        await saveComandaAtivaLocal(result.comandaAtiva);
      } catch {
        if (!userChangedStateRef.current) {
          setComandaAtiva(local ?? false);
        }
      }
    })();
  }, []);

  const abrirComanda = async () => {
    userChangedStateRef.current = true;
    setLoading(true);
    setError(null);
    try {
      const result = await requestStatus('/comandas/abrir', 'POST');
      setComandaAtiva(result.comandaAtiva);
      await saveComandaAtivaLocal(result.comandaAtiva);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao abrir comanda');
    } finally {
      setLoading(false);
    }
  };

  const fecharComanda = async () => {
    userChangedStateRef.current = true;
    setLoading(true);
    setError(null);
    try {
      const result = await requestStatus('/comandas/fechar', 'POST');
      setComandaAtiva(result.comandaAtiva);
      await saveComandaAtivaLocal(result.comandaAtiva);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao fechar comanda');
    } finally {
      setLoading(false);
    }
  };

  return {
    comandaAtiva,
    loading,
    error,
    abrirComanda,
    fecharComanda
  };
}
