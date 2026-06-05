import { describe, expect, it } from 'vitest';

import { CreateCashMovement } from '@/modules/finance/application/use-cases/CreateCashMovement';
import { InMemoryCashMovementRepository } from '@/modules/finance/infrastructure/repositories/InMemoryCashMovementRepository';

describe('Cash movements use cases', () => {
  it('cria lancamento de entrada', async () => {
    const repository = new InMemoryCashMovementRepository();
    const createCashMovement = new CreateCashMovement(repository);

    const movement = await createCashMovement.execute({
      id: 'mov-1',
      movementCode: '001',
      movementType: 'ENTRADA',
      category: 'PIX',
      amount: 120.5,
      description: 'Venda pix do turno da tarde',
      launchedAt: new Date('2026-06-04T12:00:00.000Z'),
      convenioName: 'PIX Banco Z',
      paymentMethod: 'PIX'
    });

    const loaded = await repository.findById(movement.id);

    expect(loaded).not.toBeNull();
    expect(loaded?.movementType).toBe('ENTRADA');
    expect(loaded?.amount).toBe(120.5);
  });

  it('atualiza e remove lancamento', async () => {
    const repository = new InMemoryCashMovementRepository();
    const now = new Date();

    await repository.save({
      id: 'mov-2',
      movementCode: '002',
      movementType: 'SAIDA',
      category: 'GASTO',
      amount: 40,
      description: 'Troco e insumos',
      launchedAt: now,
      version: 1,
      createdAt: now,
      updatedAt: now
    });

    const existing = await repository.findById('mov-2');
    if (!existing) {
      throw new Error('Movimento esperado nao encontrado.');
    }

    await repository.save({
      ...existing,
      amount: 55,
      version: existing.version + 1,
      updatedAt: new Date()
    });

    const updated = await repository.findById('mov-2');
    expect(updated?.amount).toBe(55);
    expect(updated?.version).toBe(2);

    await repository.delete('mov-2');
    expect(await repository.findById('mov-2')).toBeNull();
  });
});