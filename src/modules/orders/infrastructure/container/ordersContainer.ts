import { CreateOrder } from '@/modules/orders/application/use-cases/CreateOrder';
import { AddItemToOrder } from '@/modules/orders/application/use-cases/AddItemToOrder';
import { AdvanceOrderStatus } from '@/modules/orders/application/use-cases/AdvanceOrderStatus';
import { SyncOrders } from '@/modules/orders/application/use-cases/SyncOrders';
import { InMemoryOrderRepository } from '@/modules/orders/infrastructure/repositories/InMemoryOrderRepository';
import { DexieOrderRepository } from '@/modules/orders/infrastructure/repositories/DexieOrderRepository';
import { InMemoryOrderSyncGateway } from '@/modules/orders/infrastructure/sync/InMemoryOrderSyncGateway';
import { getSyncTaskQueue } from '@/shared/sync/infrastructure/queue/syncTaskQueueSingleton';
import { hasIndexedDb } from '@/shared/infrastructure/runtime/hasIndexedDb';

const orderRepository = hasIndexedDb()
  ? new DexieOrderRepository()
  : new InMemoryOrderRepository();
const orderSyncGateway = new InMemoryOrderSyncGateway();

export const ordersContainer = {
  orderRepository,
  orderSyncGateway,
  createOrder: new CreateOrder(orderRepository),
  addItemToOrder: new AddItemToOrder(orderRepository),
  advanceOrderStatus: new AdvanceOrderStatus(orderRepository),
  syncOrders: new SyncOrders(orderRepository, orderSyncGateway),
  enqueueSyncOrders: async () => getSyncTaskQueue().enqueue('SYNC_ORDERS')
};
