import { CreateCashMovement } from '@/modules/finance/application/use-cases/CreateCashMovement';
import { DexieCashMovementRepository } from '@/modules/finance/infrastructure/repositories/DexieCashMovementRepository';

const cashMovementRepository = new DexieCashMovementRepository();

export const financeContainer = {
  cashMovementRepository,
  createCashMovement: new CreateCashMovement(cashMovementRepository)
};