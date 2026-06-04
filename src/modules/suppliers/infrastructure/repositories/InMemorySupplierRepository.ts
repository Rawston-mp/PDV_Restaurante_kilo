import type { Supplier } from '@/modules/suppliers/domain/entities/Supplier';
import type { SupplierRepository } from '@/modules/suppliers/domain/ports/SupplierRepository';

export class InMemorySupplierRepository implements SupplierRepository {
  private readonly suppliers = new Map<string, Supplier>();

  async findById(id: string): Promise<Supplier | null> {
    return this.suppliers.get(id) ?? null;
  }

  async list(): Promise<Supplier[]> {
    return Array.from(this.suppliers.values());
  }

  async save(supplier: Supplier): Promise<void> {
    this.suppliers.set(supplier.id, supplier);
  }

  async delete(id: string): Promise<void> {
    this.suppliers.delete(id);
  }
}
