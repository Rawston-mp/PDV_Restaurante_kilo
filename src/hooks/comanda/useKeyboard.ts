import { useState } from 'react';

export function useKeyboard(initial: 'NUMERICO' | 'VIRTUAL' = 'NUMERICO') {
  const [tecladoAtivo, setTecladoAtivo] = useState<'NUMERICO' | 'VIRTUAL'>(initial);

  const toggleToNumerico = () => setTecladoAtivo('NUMERICO');
  const toggleToVirtual = () => setTecladoAtivo('VIRTUAL');

  return {
    tecladoAtivo,
    toggleToNumerico,
    toggleToVirtual,
    setTecladoAtivo
  };
}
