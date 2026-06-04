import type { ProductRepository } from '@/modules/products/domain/ports/ProductRepository';
import type { AdjustStockInput } from '@/modules/stock/application/dto/AdjustStockInput';
import { calculateNewStock } from '@/modules/stock/domain/services/stockRules';

export class AdjustStock {
  constructor(private readonly productRepository: ProductRepository) {}

  async execute(input: AdjustStockInput) {
    const product = await this.productRepository.findById(input.productId);

    if (!product) {
      throw new Error('Produto nao encontrado');
    }

    const updatedProduct = {
      ...product,
      stock: calculateNewStock(product.stock, input.delta),
      version: product.version + 1,
      updatedAt: new Date()
    };

    await this.productRepository.save(updatedProduct);
    return updatedProduct;
  }
}
