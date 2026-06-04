import type { CreateSupplierInput } from '@/modules/suppliers/application/dto/CreateSupplierInput';
import type { Supplier } from '@/modules/suppliers/domain/entities/Supplier';
import type { SupplierRepository } from '@/modules/suppliers/domain/ports/SupplierRepository';

export class CreateSupplier {
  constructor(private readonly supplierRepository: SupplierRepository) {}

  async execute(input: CreateSupplierInput): Promise<Supplier> {
    const now = new Date();

    const supplier: Supplier = {
      id: input.id,
      supplierCode: input.supplierCode,
      cpfCnpj: input.cpfCnpj,
      stateRegistration: input.stateRegistration,
      legalName: input.legalName,
      tradeName: input.tradeName,
      cep: input.cep,
      address: input.address,
      number: input.number,
      neighborhood: input.neighborhood,
      state: input.state,
      city: input.city,
      complement: input.complement,
      serviceFee: input.serviceFee,
      phone: input.phone,
      mobile: input.mobile,
      email: input.email,
      version: 1,
      createdAt: now,
      updatedAt: now
    };

    await this.supplierRepository.save(supplier);
    return supplier;
  }
}
