import Dexie, { type Table } from 'dexie';

import type { Order } from '@/modules/orders/domain/entities/Order';
import type { Product } from '@/modules/products/domain/entities/Product';
import type { SyncTaskType } from '@/shared/sync/domain/entities/SyncQueueTask';

type ComandaStateRow = {
  id: 'main';
  comandaAtiva: boolean;
  updatedAt: Date;
};

type WeightHistoryRow = {
  id: string;
  peso: number;
  origem?: string;
  comandaAtiva: boolean;
  receivedAt: Date;
};

type SyncQueueRow = {
  id: string;
  type: SyncTaskType;
  attempts: number;
  nextRetryAt: Date;
  lastError?: string;
};

export class PdvDatabase extends Dexie {
  orders!: Table<Order, string>;
  products!: Table<Product, string>;
  comandaState!: Table<ComandaStateRow, 'main'>;
  weightHistory!: Table<WeightHistoryRow, string>;
  syncQueue!: Table<SyncQueueRow, string>;

  constructor() {
    super('PdvTouchDatabase');

    this.version(1).stores({
      orders: 'id, table, status, createdAt, updatedAt',
      products: 'id, name, byWeight, category, createdAt, updatedAt'
    });

    this.version(2).stores({
      orders: 'id, table, status, createdAt, updatedAt',
      products: 'id, name, byWeight, category, createdAt, updatedAt',
      comandaState: 'id, comandaAtiva, updatedAt',
      weightHistory: 'id, peso, origem, comandaAtiva, receivedAt'
    });

    this.version(3).stores({
      orders: 'id, table, status, createdAt, updatedAt',
      products: 'id, name, byWeight, category, createdAt, updatedAt',
      comandaState: 'id, comandaAtiva, updatedAt',
      weightHistory: 'id, peso, origem, comandaAtiva, receivedAt',
      syncQueue: 'id, type, attempts, nextRetryAt, lastError'
    });
  }
}

export const pdvDatabase = new PdvDatabase();
