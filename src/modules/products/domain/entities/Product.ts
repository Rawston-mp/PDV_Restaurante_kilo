export type Product = {
  id: string;
  name: string;
  category: string;
  price: number;
  byWeight: boolean;
  stock: number;
  version: number;
  createdAt: Date;
  updatedAt: Date;
  lastSyncedAt?: Date;
};
