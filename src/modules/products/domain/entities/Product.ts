export type Product = {
  id: string;
  productCode: string;
  name: string;
  category: string;
  costValue?: number;
  marginProfit?: number;
  price: number;
  byWeight: boolean;
  stock: number;
  version: number;
  createdAt: Date;
  updatedAt: Date;
  lastSyncedAt?: Date;
};
