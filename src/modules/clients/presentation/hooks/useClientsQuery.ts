import { useEffect, useState } from 'react';

import type { Client } from '@/modules/clients/domain/entities/Client';
import { clientsContainer } from '@/modules/clients/infrastructure/container/clientsContainer';

export function useClientsQuery() {
  const [clients, setClients] = useState<Client[]>([]);

  const reload = async () => {
    try {
      setClients(await clientsContainer.clientRepository.list());
    } catch {
      // Test and non-browser environments may not have IndexedDB.
      setClients([]);
    }
  };

  useEffect(() => {
    void reload();
  }, []);

  return { clients, setClients, reload };
}
