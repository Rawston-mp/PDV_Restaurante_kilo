// ─── Domain types ────────────────────────────────────────────────────────────

export type ProductUnit = 'KG' | 'UN';

export type Product = {
  id: string;
  name: string;
  price: number;
  category: string;
  unit: ProductUnit;
};

export type CartItem = {
  product: Product;
  quantity: number;
};

export type PaymentMethod =
  | 'DINHEIRO'
  | 'DEBITO'
  | 'CREDITO'
  | 'PIX'
  | 'FIADO'
  | 'TICKET'
  | 'DESCONTO';

export type PaymentEntry = {
  method: PaymentMethod;
  label: string;
  amount: number;
};

export type CaixaView = 'pos' | 'payment' | 'cashclose';

// ─── Mock data ────────────────────────────────────────────────────────────────

export const CATEGORIES: string[] = [
  'Todos',
  'Destaque',
  'Self Service',
  'Bebidas',
  'Lanches',
  'Sobremesas',
  'Porções',
];

export const PAYMENT_METHODS: { method: PaymentMethod; label: string; color: string }[] = [
  { method: 'DINHEIRO',  label: 'Dinheiro',    color: 'bg-emerald-50  border-emerald-300 text-emerald-800 hover:bg-emerald-100' },
  { method: 'DEBITO',    label: 'Débito',       color: 'bg-blue-50     border-blue-300    text-blue-800    hover:bg-blue-100'    },
  { method: 'CREDITO',   label: 'Crédito',      color: 'bg-violet-50   border-violet-300  text-violet-800  hover:bg-violet-100'  },
  { method: 'PIX',       label: 'PIX',          color: 'bg-teal-50     border-teal-300    text-teal-800    hover:bg-teal-100'    },
  { method: 'FIADO',     label: 'Fiado',        color: 'bg-orange-50   border-orange-300  text-orange-800  hover:bg-orange-100'  },
  { method: 'TICKET',    label: 'Ticket',       color: 'bg-yellow-50   border-yellow-300  text-yellow-800  hover:bg-yellow-100'  },
  { method: 'DESCONTO',  label: 'Desconto',     color: 'bg-red-50      border-red-300     text-red-800     hover:bg-red-100'     },
];

export const MOCK_PRODUCTS: Product[] = [
  { id: 'p01', name: 'Self Service', price: 59.90, category: 'Destaque', unit: 'KG' },
  { id: 'p02', name: 'Self Service Kids', price: 39.90, category: 'Destaque', unit: 'KG' },
  { id: 'p03', name: 'Coca-Cola 600ml', price: 7.50, category: 'Bebidas', unit: 'UN' },
  { id: 'p04', name: 'Coca-Cola KS', price: 5.00, category: 'Bebidas', unit: 'UN' },
  { id: 'p05', name: 'Água Sem Gás 500ml', price: 3.00, category: 'Bebidas', unit: 'UN' },
  { id: 'p06', name: 'Água Com Gás 330ml', price: 4.50, category: 'Bebidas', unit: 'UN' },
  { id: 'p07', name: 'Suco Natural', price: 9.90, category: 'Bebidas', unit: 'UN' },
  { id: 'p08', name: 'Cerveja Brahma 600ml', price: 11.00, category: 'Bebidas', unit: 'UN' },
  { id: 'p09', name: 'Cerveja Heineken 600ml', price: 14.00, category: 'Bebidas', unit: 'UN' },
  { id: 'p10', name: 'Banana Prata', price: 6.99, category: 'Sobremesas', unit: 'KG' },
  { id: 'p11', name: 'Balas Yogurte', price: 2.50, category: 'Destaque', unit: 'UN' },
  { id: 'p12', name: 'Cheetos Mix Queijo', price: 5.50, category: 'Lanches', unit: 'UN' },
  { id: 'p13', name: 'Bis Extra Oreo', price: 4.90, category: 'Sobremesas', unit: 'UN' },
  { id: 'p14', name: 'Caipirão', price: 18.00, category: 'Bebidas', unit: 'UN' },
  { id: 'p15', name: 'Costela Suína', price: 49.90, category: 'Porções', unit: 'KG' },
  { id: 'p16', name: 'Doce de Leite', price: 8.00, category: 'Sobremesas', unit: 'UN' },
  { id: 'p17', name: 'Porcao Fritas', price: 24.90, category: 'Porções', unit: 'UN' },
  { id: 'p18', name: 'Doce do Conde', price: 6.00, category: 'Sobremesas', unit: 'UN' },
  { id: 'p19', name: 'Ypiôca', price: 16.00, category: 'Bebidas', unit: 'UN' },
  { id: 'p20', name: 'Diamante Negro', price: 3.50, category: 'Sobremesas', unit: 'UN' },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

export const formatBRL = (value: number) =>
  value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
