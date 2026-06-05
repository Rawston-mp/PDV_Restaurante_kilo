import type { CreateClientInput } from '@/modules/clients/application/dto/CreateClientInput';
import type { Client } from '@/modules/clients/domain/entities/Client';
import type { ClientRepository } from '@/modules/clients/domain/ports/ClientRepository';

export class CreateClient {
  constructor(private readonly clientRepository: ClientRepository) {}

  async execute(input: CreateClientInput): Promise<Client> {
    const now = new Date();

    const client: Client = {
      id: input.id,
      clientCode: input.clientCode,
      fullName: input.fullName,
      cpf: input.cpf,
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
      consumptionHistory: input.consumptionHistory,
      version: 1,
      createdAt: now,
      updatedAt: now
    };

    await this.clientRepository.save(client);
    return client;
  }
}
