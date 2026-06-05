export type CashMovementType = 'ENTRADA' | 'SAIDA';

export type CashMovement = {
  id: string;
  movementCode: string;
  movementType: CashMovementType;
  category: string;
  amount: number;
  description: string;
  launchedAt: Date;
  convenioId?: string;
  convenioName?: string;
  paymentMethod?: string;
  version: number;
  createdAt: Date;
  updatedAt: Date;
};