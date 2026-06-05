import type { CashMovement } from '@/modules/finance/domain/entities/CashMovement';

export interface CashMovementRepository {
  findById(id: string): Promise<CashMovement | null>;
  list(): Promise<CashMovement[]>;
  save(cashMovement: CashMovement): Promise<void>;
  delete(id: string): Promise<void>;
}