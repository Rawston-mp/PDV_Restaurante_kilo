import { describe, expect, it } from 'vitest';

import { CreateConvenio } from '@/modules/convenios/application/use-cases/CreateConvenio';
import { InMemoryConvenioRepository } from '@/modules/convenios/infrastructure/repositories/InMemoryConvenioRepository';

describe('Convenios use cases', () => {
  it('cria convênio com dados básicos', async () => {
    const repository = new InMemoryConvenioRepository();
    const createConvenio = new CreateConvenio(repository);

    const convenio = await createConvenio.execute({
      id: 'conv-1',
      convenioCode: '001',
      name: 'PIX Banco Z',
      paymentMethod: 'PIX',
      cashFlow: 'ENTRADA',
      bankName: 'Banco Z',
      accountName: 'Conta Principal',
      active: true,
      notes: 'Recebimentos via pix do dia.'
    });

    const loaded = await repository.findById(convenio.id);

    expect(loaded).not.toBeNull();
    expect(loaded?.convenioCode).toBe('001');
    expect(loaded?.paymentMethod).toBe('PIX');
    expect(loaded?.cashFlow).toBe('ENTRADA');
  });

  it('atualiza e remove convenio', async () => {
    const repository = new InMemoryConvenioRepository();
    const now = new Date();

    await repository.save({
      id: 'conv-2',
      convenioCode: '002',
      name: 'Dinheiro Caixa',
      paymentMethod: 'DINHEIRO',
      cashFlow: 'ENTRADA',
      bankName: '',
      accountName: 'Caixa',
      active: true,
      notes: '',
      version: 1,
      createdAt: now,
      updatedAt: now
    });

    const existing = await repository.findById('conv-2');
    if (!existing) {
      throw new Error('Convênio esperado não encontrado.');
    }

    await repository.save({
      ...existing,
      active: false,
      version: existing.version + 1,
      updatedAt: new Date()
    });

    const updated = await repository.findById('conv-2');
    expect(updated?.active).toBe(false);
    expect(updated?.version).toBe(2);

    await repository.delete('conv-2');
    expect(await repository.findById('conv-2')).toBeNull();
  });
});
