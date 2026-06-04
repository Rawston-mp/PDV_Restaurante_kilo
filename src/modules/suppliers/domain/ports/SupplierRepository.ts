import type { Supplier } from '@/modules/suppliers/domain/entities/Supplier';

export interface SupplierRepository {
  findById(id: string): Promise<Supplier | null>;
  list(): Promise<Supplier[]>;
  save(supplier: Supplier): Promise<void>;
  delete(id: string): Promise<void>;
}
