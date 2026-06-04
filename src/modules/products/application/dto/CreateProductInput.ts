export type CreateProductInput = {
  id: string;
  productCode: string;
  name: string;
  category: string;
  costValue: number;
  marginProfit: number;
  price: number;
  byWeight: boolean;
  stock: number;
};
