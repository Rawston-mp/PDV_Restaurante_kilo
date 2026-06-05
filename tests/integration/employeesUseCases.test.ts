import { describe, expect, it } from 'vitest';

import { CreateEmployee } from '@/modules/employees/application/use-cases/CreateEmployee';
import { InMemoryEmployeeRepository } from '@/modules/employees/infrastructure/repositories/InMemoryEmployeeRepository';

describe('Employees use cases', () => {
  it('cria funcionario com dados basicos e endereco', async () => {
    const repository = new InMemoryEmployeeRepository();
    const createEmployee = new CreateEmployee(repository);

    const employee = await createEmployee.execute({
      id: 'emp-1',
      employeeCode: '001',
      fullName: 'Funcionario Teste',
      cpf: '123.456.789-09',
      role: 'ATENDENTE',
      birthDate: '1995-04-17',
      gender: 'MASCULINO',
      admissionDate: '2026-01-15',
      dismissalDate: '',
      notes: 'Funcionario de teste para validacao.',
      cep: '01001-000',
      address: 'Rua A',
      number: '10',
      neighborhood: 'Centro',
      state: 'SP',
      city: 'Sao Paulo',
      complement: 'Sala 3',
      phone: '(11) 3000-1111',
      mobile: '(11) 99999-1111',
      email: 'func@teste.com',
      active: true
    });

    const loaded = await repository.findById(employee.id);

    expect(loaded).not.toBeNull();
    expect(loaded?.employeeCode).toBe('001');
    expect(loaded?.fullName).toBe('Funcionario Teste');
    expect(loaded?.role).toBe('ATENDENTE');
    expect(loaded?.birthDate).toBe('1995-04-17');
    expect(loaded?.gender).toBe('MASCULINO');
    expect(loaded?.admissionDate).toBe('2026-01-15');
    expect(loaded?.dismissalDate).toBe('');
    expect(loaded?.active).toBe(true);
  });

  it('atualiza e remove funcionario no repositorio', async () => {
    const repository = new InMemoryEmployeeRepository();
    const now = new Date();

    await repository.save({
      id: 'emp-2',
      employeeCode: '002',
      fullName: 'Funcionario B',
      cpf: '222.333.444-55',
      role: 'CAIXA',
      birthDate: '1992-09-12',
      gender: 'FEMININO',
      admissionDate: '2025-08-01',
      dismissalDate: '',
      notes: 'Sem observacoes.',
      cep: '13000-000',
      address: 'Avenida B',
      number: '200',
      neighborhood: 'Jardim',
      state: 'SP',
      city: 'Campinas',
      complement: '',
      phone: '(19) 3333-2222',
      mobile: '',
      email: 'b@funcionario.com',
      active: true,
      version: 1,
      createdAt: now,
      updatedAt: now
    });

    const existing = await repository.findById('emp-2');
    if (!existing) {
      throw new Error('Funcionario esperado nao encontrado.');
    }

    await repository.save({
      ...existing,
      role: 'GERENTE',
      active: false,
      version: existing.version + 1,
      updatedAt: new Date()
    });

    const updated = await repository.findById('emp-2');
    expect(updated?.role).toBe('GERENTE');
    expect(updated?.active).toBe(false);
    expect(updated?.version).toBe(2);

    await repository.delete('emp-2');
    expect(await repository.findById('emp-2')).toBeNull();
  });
});
