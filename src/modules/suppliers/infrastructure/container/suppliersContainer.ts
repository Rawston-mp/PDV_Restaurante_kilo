import { CreateSupplier } from '@/modules/suppliers/application/use-cases/CreateSupplier';
import { DexieSupplierRepository } from '@/modules/suppliers/infrastructure/repositories/DexieSupplierRepository';
import { ApiBackedCatalogRepository } from '@/shared/infrastructure/api/catalogApiRepository';

const supplierRepository = new ApiBackedCatalogRepository('suppliers', new DexieSupplierRepository());

export const suppliersContainer = {
  supplierRepository,
  createSupplier: new CreateSupplier(supplierRepository)
};
