import { CreateProduct } from '@/modules/products/application/use-cases/CreateProduct';
import { SyncProducts } from '@/modules/products/application/use-cases/SyncProducts';
import { ProcessSyncQueue } from '@/modules/products/application/use-cases/ProcessSyncQueue';
import { AdjustStock } from '@/modules/stock/application/use-cases/AdjustStock';
import { SyncOrders } from '@/modules/orders/application/use-cases/SyncOrders';
import { DexieProductRepository } from '@/modules/products/infrastructure/repositories/DexieProductRepository';
import { ApiBackedProductRepository } from '@/modules/products/infrastructure/repositories/ApiBackedProductRepository';
import { ApiProductSyncGateway } from '@/modules/products/infrastructure/sync/ApiProductSyncGateway';
import { ordersContainer } from '@/modules/orders/infrastructure/container/ordersContainer';
import { getSyncTaskQueue } from '@/shared/sync/infrastructure/queue/syncTaskQueueSingleton';

const localProductRepository = new DexieProductRepository();
const productRepository = new ApiBackedProductRepository(localProductRepository);
const productSyncGateway = new ApiProductSyncGateway();
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
