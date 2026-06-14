export interface Categoria {
  id: string;
  nome: string;
  cor: string;
}

export interface ItemComanda {
  id: string;
  nome: string;
  precoUnitario: number;
  peso?: number;
  quantidade: number;
  categoriaId: string;
  subtotal: number;
  porUnidade: boolean;
}

export interface Comanda {
  id: string;
  numeroMesa: number;
  itens: ItemComanda[];
  total: number;
  status: 'aberta' | 'fechada' | 'cancelada';
  dataAbertura: Date;
}

export interface EstadoComanda {
  comandaAtual: Comanda | null;
  comandaNumber: string;
  isOfflineMode: boolean;
  lockOwner: 'COMANDA_A' | 'COMANDA_B' | null;
  lockStationId: 'BALANCA_A' | 'BALANCA_B' | null;
  lockExpiresAt: string | null;
  campoAtivo: 'COMANDA' | 'PESQUISA';
  categorias: Categoria[];
  categoriaSelecionada: string;
  itens: ItemComanda[];
  subtotal: number;
  impostos: number;
  total: number;
  pesoAtual: number;
  pesoManual: number | null;
  precoAtual: number;
  pesquisa: string;
  tecladoAtivo: 'NUMERICO' | 'VIRTUAL';
  isComandaConectada: boolean;
  erro: string | null;
  canFinalize: boolean;
}
