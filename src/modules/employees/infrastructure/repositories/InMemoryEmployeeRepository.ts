import type { Employee } from '@/modules/employees/domain/entities/Employee';
import type { EmployeeRepository } from '@/modules/employees/domain/ports/EmployeeRepository';

export class InMemoryEmployeeRepository implements EmployeeRepository {
  private readonly employees = new Map<string, Employee>();

  async findById(id: string): Promise<Employee | null> {
    return this.employees.get(id) ?? null;
  }

  async list(): Promise<Employee[]> {
    return Array.from(this.employees.values());
  }

  async save(employee: Employee): Promise<void> {
    this.employees.set(employee.id, employee);
  }

  async delete(id: string): Promise<void> {
    this.employees.delete(id);
  }
}
