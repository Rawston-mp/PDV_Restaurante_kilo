import type { CashMovement } from '@/modules/finance/domain/entities/CashMovement';
import type { CashMovementRepository } from '@/modules/finance/domain/ports/CashMovementRepository';
import { pdvDatabase } from '@/shared/infrastructure/db/PdvDatabase';

export class DexieCashMovementRepository implements CashMovementRepository {
  async findById(id: string): Promise<CashMovement | null> {
    const cashMovement = await pdvDatabase.cashMovements.get(id);
    return cashMovement ?? null;
  }

  async list(): Promise<CashMovement[]> {
    return pdvDatabase.cashMovements.toArray();
  }

  async save(cashMovement: CashMovement): Promise<void> {
    await pdvDatabase.cashMovements.put(cashMovement);
  }

  async delete(id: string): Promise<void> {
    await pdvDatabase.cashMovements.delete(id);
  }
}