import { useEffect, useState } from 'react';

import type { Employee } from '@/modules/employees/domain/entities/Employee';
import { employeesContainer } from '@/modules/employees/infrastructure/container/employeesContainer';

export function useEmployeesQuery() {
  const [employees, setEmployees] = useState<Employee[]>([]);

  const reload = async () => {
    setEmployees(await employeesContainer.employeeRepository.list());
  };

  useEffect(() => {
    void reload();
  }, []);

  return { employees, setEmployees, reload };
}
