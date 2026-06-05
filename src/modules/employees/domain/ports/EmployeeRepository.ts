import type { Employee } from '@/modules/employees/domain/entities/Employee';

export interface EmployeeRepository {
  findById(id: string): Promise<Employee | null>;
  list(): Promise<Employee[]>;
  save(employee: Employee): Promise<void>;
  delete(id: string): Promise<void>;
}
