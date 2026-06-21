// ─── Domain types ────────────────────────────────────────────────────────────

export type ProductUnit = 'KG' | 'UN';

export type Product = {
  id: string;
  name: string;
  price: number;
  category: string;
  unit: ProductUnit;
  imageUrl?: string;
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
  method: Exclude<PaymentMethod, 'DESCONTO'>;
  label: string;
  amount: number;
};

export type PaymentDocumentMode = 'NFCE' | 'ORCAMENTO';

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
  { id: 'p01', name: 'PF Completo', price: 25.90, category: 'Destaque', unit: 'UN', imageUrl: 'https://picsum.photos/seed/pf-completo/320/220' },
  { id: 'p02', name: 'Self Service', price: 5.49, category: 'Self Service', unit: 'KG', imageUrl: 'https://picsum.photos/seed/self-service/320/220' },
  { id: 'p03', name: 'Filé de Frango', price: 21.90, category: 'Destaque', unit: 'UN', imageUrl: 'https://picsum.photos/seed/file-frango/320/220' },
  { id: 'p04', name: 'X-Burger', price: 18.90, category: 'Lanches', unit: 'UN', imageUrl: 'https://picsum.photos/seed/xburger/320/220' },
  { id: 'p05', name: 'Coca-Cola Lata', price: 6.00, category: 'Bebidas', unit: 'UN', imageUrl: 'https://picsum.photos/seed/coca/320/220' },
  { id: 'p06', name: 'Suco de Laranja', price: 7.50, category: 'Bebidas', unit: 'UN', imageUrl: 'https://picsum.photos/seed/suco-laranja/320/220' },
  { id: 'p07', name: 'Bolo de Chocolate', price: 9.90, category: 'Sobremesas', unit: 'UN', imageUrl: 'https://picsum.photos/seed/bolo-chocolate/320/220' },
  { id: 'p08', name: 'Batata Frita', price: 14.90, category: 'Porções', unit: 'UN', imageUrl: 'https://picsum.photos/seed/batata-frita/320/220' },
  { id: 'p09', name: 'Café Expresso', price: 8.00, category: 'Bebidas', unit: 'UN', imageUrl: 'https://picsum.photos/seed/cafe-expresso/320/220' },
  { id: 'p10', name: 'Pudim', price: 7.90, category: 'Sobremesas', unit: 'UN', imageUrl: 'https://picsum.photos/seed/pudim/320/220' },
  { id: 'p11', name: 'Milkshake', price: 12.50, category: 'Bebidas', unit: 'UN', imageUrl: 'https://picsum.photos/seed/milkshake/320/220' },
  { id: 'p12', name: 'Brigadeiro', price: 4.90, category: 'Sobremesas', unit: 'UN', imageUrl: 'https://picsum.photos/seed/brigadeiro/320/220' },
  { id: 'p13', name: 'Coxinha', price: 8.50, category: 'Lanches', unit: 'UN', imageUrl: 'https://picsum.photos/seed/coxinha/320/220' },
  { id: 'p14', name: 'Pastel', price: 9.90, category: 'Lanches', unit: 'UN', imageUrl: 'https://picsum.photos/seed/pastel/320/220' },
  { id: 'p15', name: 'Água Mineral', price: 4.00, category: 'Bebidas', unit: 'UN', imageUrl: 'https://picsum.photos/seed/agua-mineral/320/220' },
  { id: 'p16', name: 'Açaí 300ml', price: 13.00, category: 'Sobremesas', unit: 'UN', imageUrl: 'https://picsum.photos/seed/acai/320/220' },
  { id: 'p17', name: 'Wrap Frango', price: 16.50, category: 'Lanches', unit: 'UN', imageUrl: 'https://picsum.photos/seed/wrap-frango/320/220' },
  { id: 'p18', name: 'Cheesecake', price: 11.90, category: 'Sobremesas', unit: 'UN', imageUrl: 'https://picsum.photos/seed/cheesecake/320/220' },
  { id: 'p19', name: 'Empadão', price: 15.00, category: 'Lanches', unit: 'UN', imageUrl: 'https://picsum.photos/seed/empadao/320/220' },
  { id: 'p20', name: 'Porção Mista', price: 39.90, category: 'Porções', unit: 'UN', imageUrl: 'https://picsum.photos/seed/porcao-mista/320/220' },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

export const formatBRL = (value: number) =>
  value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
