import { CreateSupplier } from '@/modules/suppliers/application/use-cases/CreateSupplier';
import { DexieSupplierRepository } from '@/modules/suppliers/infrastructure/repositories/DexieSupplierRepository';

const supplierRepository = new DexieSupplierRepository();

export const suppliersContainer = {
  supplierRepository,
  createSupplier: new CreateSupplier(supplierRepository)
};
