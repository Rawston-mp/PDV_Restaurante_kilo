import type { CreateEmployeeInput } from '@/modules/employees/application/dto/CreateEmployeeInput';
import type { Employee } from '@/modules/employees/domain/entities/Employee';
import type { EmployeeRepository } from '@/modules/employees/domain/ports/EmployeeRepository';

export class CreateEmployee {
  constructor(private readonly employeeRepository: EmployeeRepository) {}

  async execute(input: CreateEmployeeInput): Promise<Employee> {
    const now = new Date();

    const employee: Employee = {
      id: input.id,
      employeeCode: input.employeeCode,
      fullName: input.fullName,
      cpf: input.cpf,
      role: input.role,
      birthDate: input.birthDate,
      gender: input.gender,
      admissionDate: input.admissionDate,
      dismissalDate: input.dismissalDate,
      notes: input.notes,
      cep: input.cep,
      address: input.address,
      number: input.number,
      neighborhood: input.neighborhood,
      state: input.state,
      city: input.city,
      complement: input.complement,
      phone: input.phone,
      mobile: input.mobile,
      email: input.email,
      active: input.active,
      version: 1,
      createdAt: now,
      updatedAt: now
    };

    await this.employeeRepository.save(employee);
    return employee;
  }
}
