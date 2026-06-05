import { describe, expect, it } from 'vitest';

import { CreateClient } from '@/modules/clients/application/use-cases/CreateClient';
import { InMemoryClientRepository } from '@/modules/clients/infrastructure/repositories/InMemoryClientRepository';

describe('Clients use cases', () => {
  it('cria cliente com historico de consumo', async () => {
    const repository = new InMemoryClientRepository();
    const createClient = new CreateClient(repository);

    const client = await createClient.execute({
      id: 'cli-1',
      clientCode: '001',
      fullName: 'Cliente Teste',
      cpf: '123.456.789-09',
      cep: '01001-000',
      address: 'Rua A',
      number: '100',
      neighborhood: 'Centro',
      state: 'SP',
      city: 'Sao Paulo',
      complement: 'Apto 12',
      phone: '(11) 3000-1111',
      mobile: '(11) 99999-1111',
      email: 'cliente@teste.com',
      active: true,
      consumptionHistory: [
        {
          id: 'entry-1',
          description: 'Fiado comanda 123',
          launchedAt: '2026-06-04 20:10'
        }
      ]
    });

    const loaded = await repository.findById(client.id);

    expect(loaded).not.toBeNull();
    expect(loaded?.clientCode).toBe('001');
    expect(loaded?.fullName).toBe('Cliente Teste');
    expect(loaded?.city).toBe('Sao Paulo');
    expect(loaded?.consumptionHistory).toHaveLength(1);
    expect(loaded?.consumptionHistory[0]?.description).toContain('Fiado');
  });

  it('atualiza e remove cliente', async () => {
    const repository = new InMemoryClientRepository();
    const now = new Date();

    await repository.save({
      id: 'cli-2',
      clientCode: '002',
      fullName: 'Cliente B',
      cpf: '222.333.444-55',
      cep: '13000-000',
      address: 'Avenida B',
      number: '200',
      neighborhood: 'Jardim',
      state: 'SP',
      city: 'Campinas',
      complement: '',
      phone: '(19) 3333-2222',
      mobile: '',
      email: 'cliente-b@teste.com',
      active: true,
      consumptionHistory: [],
      version: 1,
      createdAt: now,
      updatedAt: now
    });

    const existing = await repository.findById('cli-2');
    if (!existing) {
      throw new Error('Cliente esperado nao encontrado.');
    }

    await repository.save({
      ...existing,
      active: false,
      consumptionHistory: [
        {
          id: 'entry-2',
          description: 'Fiado jantar',
          launchedAt: '2026-06-04 21:45'
        }
      ],
      version: existing.version + 1,
      updatedAt: new Date()
    });

    const updated = await repository.findById('cli-2');
    expect(updated?.active).toBe(false);
    expect(updated?.consumptionHistory).toHaveLength(1);
    expect(updated?.version).toBe(2);

    await repository.delete('cli-2');
    expect(await repository.findById('cli-2')).toBeNull();
  });
});
