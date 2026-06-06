import { useMemo, useState } from 'react';

export function useWeight() {
  const [pesoSensor, setPesoSensor] = useState(0);
  const [pesoManual, setPesoManual] = useState<number | null>(null);
  const [isComandaConectada] = useState(true);

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
    isComandaConectada,
    setPesoSensor,
    setPesoManual
  };
}
