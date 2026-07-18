import { CreateCashMovement } from '@/modules/finance/application/use-cases/CreateCashMovement';
import { DexieCashMovementRepository } from '@/modules/finance/infrastructure/repositories/DexieCashMovementRepository';
import { InMemoryCashMovementRepository } from '@/modules/finance/infrastructure/repositories/InMemoryCashMovementRepository';
import { hasIndexedDb } from '@/shared/infrastructure/runtime/hasIndexedDb';

const cashMovementRepository = hasIndexedDb()
  ? new DexieCashMovementRepository()
  : new InMemoryCashMovementRepository();

export const financeContainer = {
  cashMovementRepository,
  createCashMovement: new CreateCashMovement(cashMovementRepository)
};
