import type { Employee } from '@/modules/employees/domain/entities/Employee';
import type { EmployeeRepository } from '@/modules/employees/domain/ports/EmployeeRepository';
import { pdvDatabase } from '@/shared/infrastructure/db/PdvDatabase';

export class DexieEmployeeRepository implements EmployeeRepository {
  async findById(id: string): Promise<Employee | null> {
    const employee = await pdvDatabase.employees.get(id);
    return employee ?? null;
  }

  async list(): Promise<Employee[]> {
    return pdvDatabase.employees.toArray();
  }

  async save(employee: Employee): Promise<void> {
    await pdvDatabase.employees.put(employee);
  }

  async delete(id: string): Promise<void> {
    await pdvDatabase.employees.delete(id);
  }
}
