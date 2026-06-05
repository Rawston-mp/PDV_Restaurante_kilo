import { CreateStockEntry } from '@/modules/stockEntries/application/use-cases/CreateStockEntry';
import { DexieStockEntryRepository } from '@/modules/stockEntries/infrastructure/repositories/DexieStockEntryRepository';
import { productsContainer } from '@/modules/products/infrastructure/container/productsContainer';

const stockEntryRepository = new DexieStockEntryRepository();

export const stockEntriesContainer = {
  stockEntryRepository,
  createStockEntry: new CreateStockEntry(stockEntryRepository, productsContainer.productRepository)
};
