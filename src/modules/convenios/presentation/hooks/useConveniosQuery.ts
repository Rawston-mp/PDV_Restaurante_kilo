import { useEffect, useState } from 'react';

import type { Convenio } from '@/modules/convenios/domain/entities/Convenio';
import { conveniosContainer } from '@/modules/convenios/infrastructure/container/conveniosContainer';

export function useConveniosQuery() {
  const [convenios, setConvenios] = useState<Convenio[]>([]);

  const reload = async () => {
    try {
      setConvenios(await conveniosContainer.convenioRepository.list());
    } catch {
      setConvenios([]);
    }
  };

  useEffect(() => {
    void reload();
  }, []);

  return { convenios, setConvenios, reload };
}
