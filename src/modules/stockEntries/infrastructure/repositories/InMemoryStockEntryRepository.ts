import type { StockEntry } from '@/modules/stockEntries/domain/entities/StockEntry';
import type { StockEntryRepository } from '@/modules/stockEntries/domain/ports/StockEntryRepository';

export class InMemoryStockEntryRepository implements StockEntryRepository {
  private readonly stockEntries = new Map<string, StockEntry>();

  async findById(id: string): Promise<StockEntry | null> {
    return this.stockEntries.get(id) ?? null;
  }

  async list(): Promise<StockEntry[]> {
    return Array.from(this.stockEntries.values());
  }

  async save(stockEntry: StockEntry): Promise<void> {
    this.stockEntries.set(stockEntry.id, stockEntry);
  }

  async delete(id: string): Promise<void> {
    this.stockEntries.delete(id);
  }
}
