import { useEffect, useState } from 'react';

import type { Supplier } from '@/modules/suppliers/domain/entities/Supplier';
import { suppliersContainer } from '@/modules/suppliers/infrastructure/container/suppliersContainer';

export function useSuppliersQuery() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);

  const reload = async () => {
    setSuppliers(await suppliersContainer.supplierRepository.list());
  };

  useEffect(() => {
    void reload();
  }, []);

  return { suppliers, setSuppliers, reload };
}
