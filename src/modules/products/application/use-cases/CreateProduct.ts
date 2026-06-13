import type { Product } from '@/modules/products/domain/entities/Product';
import type { ProductRepository } from '@/modules/products/domain/ports/ProductRepository';
import type { CreateProductInput } from '@/modules/products/application/dto/CreateProductInput';

export class CreateProduct {
  constructor(private readonly productRepository: ProductRepository) {}

  async execute(input: CreateProductInput): Promise<Product> {
    const now = new Date();

    const product: Product = {
      id: input.id,
      productCode: input.productCode,
      barcode: input.barcode,
      imageUrl: input.imageUrl,
      name: input.name,
      category: input.category,
      isUnavailable: input.isUnavailable ?? false,
      isHidden: input.isHidden ?? false,
      ncm: input.ncm,
      cfop: input.cfop,
      cstIcms: input.cstIcms,
      taxSituationCode: input.taxSituationCode,
      aliqIcms: input.aliqIcms,
      cstPis: input.cstPis,
      aliqPis: input.aliqPis,
      cstCofins: input.cstCofins,
      aliqCofins: input.aliqCofins,
      fiscalType: input.fiscalType,
      costValue: input.costValue,
      marginProfit: input.marginProfit,
      price: input.price,
      byWeight: input.byWeight,
      stock: input.stock,
      version: 1,
      createdAt: now,
      updatedAt: now
    };

    await this.productRepository.save(product);
    return product;
  }
}
