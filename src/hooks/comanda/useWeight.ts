import { useMemo, useState } from 'react';

export function useWeight() {
  const [pesoBalanca, setPesoBalanca] = useState(0);
  const [pesoManual, setPesoManual] = useState<number | null>(null);
  const [isBalancaConectada] = useState(true);

  const pesoAtual = useMemo(() => {
    if (pesoManual !== null && pesoManual > 0) {
      return pesoManual;
    }
    return pesoBalanca;
  }, [pesoBalanca, pesoManual]);

  return {
    pesoBalanca,
    pesoManual,
    pesoAtual,
    isBalancaConectada,
    setPesoBalanca,
    setPesoManual
  };
}
