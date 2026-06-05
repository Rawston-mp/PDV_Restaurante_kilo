import { CreateEmployee } from '@/modules/employees/application/use-cases/CreateEmployee';
import { DexieEmployeeRepository } from '@/modules/employees/infrastructure/repositories/DexieEmployeeRepository';

const employeeRepository = new DexieEmployeeRepository();

export const employeesContainer = {
  employeeRepository,
  createEmployee: new CreateEmployee(employeeRepository)
};
