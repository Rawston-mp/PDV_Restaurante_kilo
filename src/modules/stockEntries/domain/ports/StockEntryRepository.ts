import type { StockEntry } from '@/modules/stockEntries/domain/entities/StockEntry';

export interface StockEntryRepository {
  findById(id: string): Promise<StockEntry | null>;
  list(): Promise<StockEntry[]>;
  save(stockEntry: StockEntry): Promise<void>;
  delete(id: string): Promise<void>;
}
