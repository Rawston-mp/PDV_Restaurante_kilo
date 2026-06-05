import type { CreateConvenioInput } from '@/modules/convenios/application/dto/CreateConvenioInput';
import type { Convenio } from '@/modules/convenios/domain/entities/Convenio';
import type { ConvenioRepository } from '@/modules/convenios/domain/ports/ConvenioRepository';

export class CreateConvenio {
  constructor(private readonly convenioRepository: ConvenioRepository) {}

  async execute(input: CreateConvenioInput): Promise<Convenio> {
    const now = new Date();

    const convenio: Convenio = {
      id: input.id,
      convenioCode: input.convenioCode,
      name: input.name,
      paymentMethod: input.paymentMethod,
      cashFlow: input.cashFlow,
      bankName: input.bankName,
      accountName: input.accountName,
      active: input.active,
      notes: input.notes,
      version: 1,
      createdAt: now,
      updatedAt: now
    };

    await this.convenioRepository.save(convenio);
    return convenio;
  }
}
