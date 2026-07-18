import type { CreateStockEntryInput } from '@/modules/stockEntries/application/dto/CreateStockEntryInput';
import type { StockEntry } from '@/modules/stockEntries/domain/entities/StockEntry';
import type { StockEntryRepository } from '@/modules/stockEntries/domain/ports/StockEntryRepository';
import type { ProductRepository } from '@/modules/products/domain/ports/ProductRepository';
import { calculateNewStock } from '@/modules/stock/domain/services/stockRules';

export class CreateStockEntry {
  constructor(
    private readonly stockEntryRepository: StockEntryRepository,
    private readonly productRepository: ProductRepository
  ) {}

  async execute(input: CreateStockEntryInput): Promise<StockEntry> {
    const product = await this.productRepository.findById(input.productId);

    if (!product) {
      throw new Error('Produto não encontrado');
    }

    const now = new Date();
    const conversionFactor = product.unitsPerPurchase && product.unitsPerPurchase > 0
      ? product.unitsPerPurchase
      : 1;
    const convertedQuantity = input.quantity * conversionFactor;
    const convertedUnitCost = input.unitCost / conversionFactor;
    const updatedMarginProfit = convertedUnitCost > 0 && product.price > 0
      ? Number((((product.price - convertedUnitCost) / convertedUnitCost) * 100).toFixed(2))
      : 0;
    const updatedProduct = {
      ...product,
      stock: calculateNewStock(product.stock, convertedQuantity),
      purchaseCostValue: input.unitCost,
      costValue: convertedUnitCost,
      marginProfit: updatedMarginProfit,
      version: product.version + 1,
      updatedAt: now
    };

    const stockEntry: StockEntry = {
      id: input.id,
      stockEntryCode: input.stockEntryCode,
      noteCode: input.noteCode,
      natureOfOperation: input.natureOfOperation,
      productId: input.productId,
      productName: input.productName,
      supplierName: input.supplierName,
      invoiceNumber: input.invoiceNumber,
      series: input.series,
      accessKey: input.accessKey,
      authorizationProtocol: input.authorizationProtocol,
      issueDate: input.issueDate,
      deliveryDate: input.deliveryDate,
      icmsBase: input.icmsBase,
      icmsValue: input.icmsValue,
      icmsSubstitutionBase: input.icmsSubstitutionBase,
      icmsSubstitutionValue: input.icmsSubstitutionValue,
      productsValue: input.productsValue,
      freightValue: input.freightValue,
      insuranceValue: input.insuranceValue,
      discountValue: input.discountValue,
      additionalExpensesValue: input.additionalExpensesValue,
      ipiValue: input.ipiValue,
      invoiceTotalValue: input.invoiceTotalValue,
      documentModel: input.documentModel,
      paymentCondition: input.paymentCondition,
      stockLocation: input.stockLocation,
      purchaseOrder: input.purchaseOrder,
      freightByAccount: input.freightByAccount,
      purchaseQuantity: input.quantity,
      purchaseUnit: product.purchaseUnit ?? 'UN',
      saleUnit: product.saleUnit ?? product.purchaseUnit ?? 'UN',
      conversionFactor,
      purchaseUnitCost: input.unitCost,
      quantity: convertedQuantity,
      unitCost: convertedUnitCost,
      totalCost: input.quantity * input.unitCost,
      notes: input.notes,
      receivedAt: input.receivedAt,
      version: 1,
      createdAt: now,
      updatedAt: now
    };

    await this.productRepository.save(updatedProduct);
    await this.stockEntryRepository.save(stockEntry);

    return stockEntry;
  }
}
