export type OrderStatus = 'PENDENTE' | 'EM_PREPARO' | 'PRONTO' | 'ENTREGUE';

export type OrderItem = {
  id: string;
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  byWeight: boolean;
  weight?: number;
};

export type Order = {
  id: string;
  table: string;
  status: OrderStatus;
  items: OrderItem[];
  total: number;
  version: number;
  createdAt: Date;
  updatedAt: Date;
  lastSyncedAt?: Date;
  createdBy: string;
};
