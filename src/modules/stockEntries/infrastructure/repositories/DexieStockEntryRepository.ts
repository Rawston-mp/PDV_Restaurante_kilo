import type { StockEntry } from '@/modules/stockEntries/domain/entities/StockEntry';
import type { StockEntryRepository } from '@/modules/stockEntries/domain/ports/StockEntryRepository';
import { pdvDatabase } from '@/shared/infrastructure/db/PdvDatabase';

export class DexieStockEntryRepository implements StockEntryRepository {
  async findById(id: string): Promise<StockEntry | null> {
    const stockEntry = await pdvDatabase.stockEntries.get(id);
    return stockEntry ?? null;
  }

  async list(): Promise<StockEntry[]> {
    return pdvDatabase.stockEntries.toArray();
  }

  async save(stockEntry: StockEntry): Promise<void> {
    await pdvDatabase.stockEntries.put(stockEntry);
  }

  async delete(id: string): Promise<void> {
    await pdvDatabase.stockEntries.delete(id);
  }
}
