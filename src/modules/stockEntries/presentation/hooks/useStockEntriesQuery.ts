import { useEffect, useState } from 'react';

import type { StockEntry } from '@/modules/stockEntries/domain/entities/StockEntry';
import { stockEntriesContainer } from '@/modules/stockEntries/infrastructure/container/stockEntriesContainer';

export function useStockEntriesQuery() {
  const [stockEntries, setStockEntries] = useState<StockEntry[]>([]);

  const reload = async () => {
    try {
      setStockEntries(await stockEntriesContainer.stockEntryRepository.list());
    } catch {
      setStockEntries([]);
    }
  };

  useEffect(() => {
    void reload();
  }, []);

  return { stockEntries, setStockEntries, reload };
}
