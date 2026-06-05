import type { CashMovement } from '@/modules/finance/domain/entities/CashMovement';
import type { CashMovementRepository } from '@/modules/finance/domain/ports/CashMovementRepository';

export class InMemoryCashMovementRepository implements CashMovementRepository {
  private readonly cashMovements = new Map<string, CashMovement>();

  async findById(id: string): Promise<CashMovement | null> {
    return this.cashMovements.get(id) ?? null;
  }

  async list(): Promise<CashMovement[]> {
    return Array.from(this.cashMovements.values());
  }

  async save(cashMovement: CashMovement): Promise<void> {
    this.cashMovements.set(cashMovement.id, cashMovement);
  }

  async delete(id: string): Promise<void> {
    this.cashMovements.delete(id);
  }
}