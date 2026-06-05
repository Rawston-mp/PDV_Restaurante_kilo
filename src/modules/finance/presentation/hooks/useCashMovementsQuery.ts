import { useEffect, useState } from 'react';

import type { CashMovement } from '@/modules/finance/domain/entities/CashMovement';
import { financeContainer } from '@/modules/finance/infrastructure/container/financeContainer';

export function useCashMovementsQuery() {
  const [cashMovements, setCashMovements] = useState<CashMovement[]>([]);

  const reload = async () => {
    try {
      setCashMovements(await financeContainer.cashMovementRepository.list());
    } catch {
      setCashMovements([]);
    }
  };

  useEffect(() => {
    void reload();
  }, []);

  return { cashMovements, setCashMovements, reload };
}