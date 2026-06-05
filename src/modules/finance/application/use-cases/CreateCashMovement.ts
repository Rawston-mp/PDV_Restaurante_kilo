import type { CreateCashMovementInput } from '@/modules/finance/application/dto/CreateCashMovementInput';
import type { CashMovement } from '@/modules/finance/domain/entities/CashMovement';
import type { CashMovementRepository } from '@/modules/finance/domain/ports/CashMovementRepository';

export class CreateCashMovement {
  constructor(private readonly cashMovementRepository: CashMovementRepository) {}

  async execute(input: CreateCashMovementInput): Promise<CashMovement> {
    const now = new Date();

    const cashMovement: CashMovement = {
      id: input.id,
      movementCode: input.movementCode,
      movementType: input.movementType,
      category: input.category,
      amount: input.amount,
      description: input.description,
      launchedAt: input.launchedAt,
      convenioId: input.convenioId,
      convenioName: input.convenioName,
      paymentMethod: input.paymentMethod,
      version: 1,
      createdAt: now,
      updatedAt: now
    };

    await this.cashMovementRepository.save(cashMovement);
    return cashMovement;
  }
}