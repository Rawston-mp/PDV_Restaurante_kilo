import { CreateEmployee } from '@/modules/employees/application/use-cases/CreateEmployee';
import { DexieEmployeeRepository } from '@/modules/employees/infrastructure/repositories/DexieEmployeeRepository';
import { ApiBackedCatalogRepository } from '@/shared/infrastructure/api/catalogApiRepository';

const employeeRepository = new ApiBackedCatalogRepository('employees', new DexieEmployeeRepository());

export const employeesContainer = {
  employeeRepository,
  createEmployee: new CreateEmployee(employeeRepository)
};
