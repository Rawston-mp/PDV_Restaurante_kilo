import { CreateCashMovement } from '@/modules/finance/application/use-cases/CreateCashMovement';
import { ApiBackedCashMovementRepository } from '@/modules/finance/infrastructure/repositories/ApiBackedCashMovementRepository';
import { DexieCashMovementRepository } from '@/modules/finance/infrastructure/repositories/DexieCashMovementRepository';
import { InMemoryCashMovementRepository } from '@/modules/finance/infrastructure/repositories/InMemoryCashMovementRepository';
import { hasIndexedDb } from '@/shared/infrastructure/runtime/hasIndexedDb';

const localCashMovementRepository = hasIndexedDb()
  ? new DexieCashMovementRepository()
  : new InMemoryCashMovementRepository();
const cashMovementRepository = new ApiBackedCashMovementRepository(localCashMovementRepository);

export const financeContainer = {
  cashMovementRepository,
  createCashMovement: new CreateCashMovement(cashMovementRepository)
};
