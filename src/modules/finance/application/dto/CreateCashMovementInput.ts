export type CreateCashMovementInput = {
  id: string;
  movementCode: string;
  movementType: 'ENTRADA' | 'SAIDA';
  category: string;
  amount: number;
  description: string;
  launchedAt: Date;
  convenioId?: string;
  convenioName?: string;
  paymentMethod?: string;
};