import { CreateProduct } from '@/modules/products/application/use-cases/CreateProduct';
import { SyncProducts } from '@/modules/products/application/use-cases/SyncProducts';
import { ProcessSyncQueue } from '@/modules/products/application/use-cases/ProcessSyncQueue';
import { AdjustStock } from '@/modules/stock/application/use-cases/AdjustStock';
import { SyncOrders } from '@/modules/orders/application/use-cases/SyncOrders';
import { InMemoryProductRepository } from '@/modules/products/infrastructure/repositories/InMemoryProductRepository';
import { DexieProductRepository } from '@/modules/products/infrastructure/repositories/DexieProductRepository';
import { InMemoryProductSyncGateway } from '@/modules/products/infrastructure/sync/InMemoryProductSyncGateway';
import { ordersContainer } from '@/modules/orders/infrastructure/container/ordersContainer';
import { getSyncTaskQueue } from '@/shared/sync/infrastructure/queue/syncTaskQueueSingleton';

const productRepository = new DexieProductRepository();
const productSyncGateway = new InMemoryProductSyncGateway();
const syncTaskQueue = getSyncTaskQueue();
const syncProducts = new SyncProducts(productRepository, productSyncGateway);
const syncOrders = ordersContainer.syncOrders;

export const productsContainer = {
  productRepository,
  productSyncGateway,
  syncTaskQueue,
  createProduct: new CreateProduct(productRepository),
  adjustStock: new AdjustStock(productRepository),
  syncProducts,
  syncOrders,
  processSyncQueue: new ProcessSyncQueue(syncTaskQueue, [syncProducts, syncOrders])
};
