import Dexie, { type Table } from 'dexie';

import type { Client } from '@/modules/clients/domain/entities/Client';
import type { Employee } from '@/modules/employees/domain/entities/Employee';
import type { Order } from '@/modules/orders/domain/entities/Order';
import type { Product } from '@/modules/products/domain/entities/Product';
import type { Supplier } from '@/modules/suppliers/domain/entities/Supplier';
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
  suppliers!: Table<Supplier, string>;
  employees!: Table<Employee, string>;
  clients!: Table<Client, string>;
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

    this.version(4).stores({
      orders: 'id, table, status, createdAt, updatedAt',
      products: 'id, productCode, name, byWeight, category, createdAt, updatedAt',
      comandaState: 'id, comandaAtiva, updatedAt',
      weightHistory: 'id, peso, origem, comandaAtiva, receivedAt',
      syncQueue: 'id, type, attempts, nextRetryAt, lastError'
    });

    this.version(5).stores({
      orders: 'id, table, status, createdAt, updatedAt',
      products: 'id, productCode, name, byWeight, category, createdAt, updatedAt',
      suppliers: 'id, supplierCode, cpfCnpj, legalName, tradeName, city, state, createdAt, updatedAt',
      comandaState: 'id, comandaAtiva, updatedAt',
      weightHistory: 'id, peso, origem, comandaAtiva, receivedAt',
      syncQueue: 'id, type, attempts, nextRetryAt, lastError'
    });

    this.version(6).stores({
      orders: 'id, table, status, createdAt, updatedAt',
      products: 'id, productCode, name, byWeight, category, createdAt, updatedAt',
      suppliers: 'id, supplierCode, cpfCnpj, legalName, tradeName, city, state, createdAt, updatedAt',
      employees: 'id, employeeCode, fullName, cpf, role, city, state, active, createdAt, updatedAt',
      comandaState: 'id, comandaAtiva, updatedAt',
      weightHistory: 'id, peso, origem, comandaAtiva, receivedAt',
      syncQueue: 'id, type, attempts, nextRetryAt, lastError'
    });

    this.version(7).stores({
      orders: 'id, table, status, createdAt, updatedAt',
      products: 'id, productCode, name, byWeight, category, createdAt, updatedAt',
      suppliers: 'id, supplierCode, cpfCnpj, legalName, tradeName, city, state, createdAt, updatedAt',
      employees: 'id, employeeCode, fullName, cpf, role, city, state, active, createdAt, updatedAt',
      clients: 'id, clientCode, fullName, cpf, active, createdAt, updatedAt',
      comandaState: 'id, comandaAtiva, updatedAt',
      weightHistory: 'id, peso, origem, comandaAtiva, receivedAt',
      syncQueue: 'id, type, attempts, nextRetryAt, lastError'
    });
  }
}

export const pdvDatabase = new PdvDatabase();
