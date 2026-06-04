import type { Supplier } from '@/modules/suppliers/domain/entities/Supplier';
import type { SupplierRepository } from '@/modules/suppliers/domain/ports/SupplierRepository';
import { pdvDatabase } from '@/shared/infrastructure/db/PdvDatabase';

export class DexieSupplierRepository implements SupplierRepository {
  async findById(id: string): Promise<Supplier | null> {
    const supplier = await pdvDatabase.suppliers.get(id);
    return supplier ?? null;
  }

  async list(): Promise<Supplier[]> {
    return pdvDatabase.suppliers.toArray();
  }

  async save(supplier: Supplier): Promise<void> {
    await pdvDatabase.suppliers.put(supplier);
  }

  async delete(id: string): Promise<void> {
    await pdvDatabase.suppliers.delete(id);
  }
}
