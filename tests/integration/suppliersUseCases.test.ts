import { describe, expect, it } from 'vitest';

import { CreateSupplier } from '@/modules/suppliers/application/use-cases/CreateSupplier';
import { InMemorySupplierRepository } from '@/modules/suppliers/infrastructure/repositories/InMemorySupplierRepository';

describe('Suppliers use cases', () => {
  it('cria fornecedor com dados basicos e endereco', async () => {
    const repository = new InMemorySupplierRepository();
    const createSupplier = new CreateSupplier(repository);

    const supplier = await createSupplier.execute({
      id: 'sup-1',
      supplierCode: '001',
      cpfCnpj: '12.345.678/0001-99',
      stateRegistration: '123456789',
      legalName: 'Fornecedor Teste LTDA',
      tradeName: 'Fornecedor Teste',
      cep: '01001-000',
      address: 'Rua A',
      number: '100',
      neighborhood: 'Centro',
      state: 'SP',
      city: 'Sao Paulo',
      complement: 'Sala 2',
      serviceFee: '0,00',
      phone: '(11) 3000-0000',
      mobile: '(11) 99999-0000',
      email: 'fornecedor@teste.com'
    });

    const loaded = await repository.findById(supplier.id);

    expect(loaded).not.toBeNull();
    expect(loaded?.supplierCode).toBe('001');
    expect(loaded?.cpfCnpj).toBe('12.345.678/0001-99');
    expect(loaded?.city).toBe('Sao Paulo');
    expect(loaded?.version).toBe(1);
  });

  it('atualiza e remove fornecedor no repositorio', async () => {
    const repository = new InMemorySupplierRepository();
    const now = new Date();

    await repository.save({
      id: 'sup-2',
      supplierCode: '002',
      cpfCnpj: '22.222.222/0001-22',
      stateRegistration: 'ISENTO',
      legalName: 'Fornecedor B LTDA',
      tradeName: 'Fornecedor B',
      cep: '13000-000',
      address: 'Avenida B',
      number: '200',
      neighborhood: 'Jardim',
      state: 'SP',
      city: 'Campinas',
      complement: '',
      serviceFee: '2,50',
      phone: '(19) 3333-2222',
      mobile: '',
      email: 'b@fornecedor.com',
      version: 1,
      createdAt: now,
      updatedAt: now
    });

    const existing = await repository.findById('sup-2');
    if (!existing) {
      throw new Error('Fornecedor esperado nao encontrado.');
    }

    await repository.save({
      ...existing,
      tradeName: 'Fornecedor B Atualizado',
      version: existing.version + 1,
      updatedAt: new Date()
    });

    const updated = await repository.findById('sup-2');
    expect(updated?.tradeName).toBe('Fornecedor B Atualizado');
    expect(updated?.version).toBe(2);

    await repository.delete('sup-2');
    expect(await repository.findById('sup-2')).toBeNull();
  });
});
