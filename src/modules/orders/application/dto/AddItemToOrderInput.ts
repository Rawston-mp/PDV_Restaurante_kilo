export type AddItemToOrderInput = {
  orderId: string;
  item: {
    id: string;
    productId: string;
    productName: string;
    quantity: number;
    unitPrice: number;
    byWeight: boolean;
    weight?: number;
  };
};
