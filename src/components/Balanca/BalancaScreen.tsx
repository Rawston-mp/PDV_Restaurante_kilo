import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';

import { useWebSocket } from '@/hooks/useWebSocket';
import { useProductsQuery } from '@/modules/products/presentation/hooks/useProductsQuery';
import { useAuth } from '@/modules/auth/presentation/providers/AuthProvider';
import type { SensitiveAction } from '@/modules/auth/presentation/providers/AuthProvider';
import { PriceDisplay } from '@/components/Balanca/PriceDisplay';
import {
  ProductGrid,
  type ProductCard,
  type ProductCategory
} from '@/components/Balanca/ProductGrid';
import { WeightDisplay } from '@/components/Balanca/WeightDisplay';

type ScaleEventPayload = {
  peso: number;
  origem?: 'A' | 'B';
  timestamp?: string;
};

type BalancaScreenProps = {
  wsUrl?: string;
};

type ScaleId = 'A' | 'B';

type ComandaItem = {
  id: string;
  item: string;
  unitPrice: number;
  weight: number;
  total: number;
};

const isScaleEvent = (payload: unknown): payload is ScaleEventPayload => {
  if (typeof payload !== 'object' || payload === null) {
    return false;
  }

  const maybe = payload as Partial<ScaleEventPayload>;
  return typeof maybe.peso === 'number' && Number.isFinite(maybe.peso) && maybe.peso >= 0;
};

const normalizeCategory = (value: string): ProductCategory => {
  const normalized = value.trim().toUpperCase();
  if (!normalized) {
    return 'GERAL';
  }

  return normalized;
};

export function BalancaScreen({ wsUrl }: BalancaScreenProps) {
  const { products: productEntities } = useProductsQuery();
  const { user, confirmSensitiveAction } = useAuth();

  const [activeScale, setActiveScale] = useState<ScaleId>('A');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<ProductCategory>('GERAL');
  const [comandaItems, setComandaItems] = useState<ComandaItem[]>([]);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<SensitiveAction | null>(null);
  const [confirmPin, setConfirmPin] = useState('');
  const [confirmMessage, setConfirmMessage] = useState<string | null>(null);

  const mappedProducts = useMemo<ProductCard[]>(() => {
    if (productEntities.length === 0) {
      return [
        { id: 'd1', name: 'Prato executivo', category: 'GERAL', pricePerKg: 39.9, isPopular: true },
        { id: 'd2', name: 'Sobremesa da casa', category: 'SOBREMESAS', pricePerKg: 64.9 },
        { id: 'd3', name: 'Salada premium', category: 'SALADAS', pricePerKg: 36.5 }
      ];
    }

    return productEntities.map((product) => ({
      id: product.id,
      name: product.name,
      category: normalizeCategory(product.category),
      pricePerKg: product.price,
      isPopular: product.stock > 25,
      disabled: product.stock <= 0
    }));
  }, [productEntities]);

  const categories = useMemo(() => {
    const base = new Set(mappedProducts.map((product) => product.category));
    if (!base.has('GERAL')) {
      base.add('GERAL');
    }

    return Array.from(base);
  }, [mappedProducts]);

  useEffect(() => {
    if (!categories.includes(selectedCategory)) {
      setSelectedCategory(categories[0] ?? 'GERAL');
    }
  }, [categories, selectedCategory]);

  const [selectedProduct, setSelectedProduct] = useState<ProductCard | null>(null);

  useEffect(() => {
    if (!selectedProduct && mappedProducts.length > 0) {
      setSelectedProduct(mappedProducts[0]);
    }
  }, [mappedProducts, selectedProduct]);

  const { lastMessage, error, isConnected } = useWebSocket<ScaleEventPayload>({
    url: wsUrl,
    eventName: 'atualizar_peso',
    validatePayload: isScaleEvent,
    enabled: true
  });

  const currentWeight = useMemo(() => {
    if (!lastMessage) {
      return 0;
    }

    if (lastMessage.origem && lastMessage.origem !== activeScale) {
      return 0;
    }

    return lastMessage.peso;
  }, [lastMessage, activeScale]);

  const currentTotal = useMemo(() => {
    if (!selectedProduct) {
      return 0;
    }

    return Number((selectedProduct.pricePerKg * currentWeight).toFixed(2));
  }, [selectedProduct, currentWeight]);

  const visibleProducts = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    return mappedProducts
      .filter((product) => selectedCategory === 'GERAL' || product.category === selectedCategory)
      .filter((product) => (normalizedSearch ? product.name.toLowerCase().includes(normalizedSearch) : true));
  }, [mappedProducts, searchTerm, selectedCategory]);

  const comandaTotal = useMemo(() => {
    return comandaItems.reduce((sum, item) => sum + item.total, 0);
  }, [comandaItems]);

  const onSelectProduct = (product: ProductCard) => {
    setSelectedProduct(product);
    setSelectedCategory(product.category);
    setFeedback(`Produto selecionado: ${product.name}`);
  };

  const onQuickAddItem = useCallback(() => {
    if (!selectedProduct) {
      setFeedback('Selecione um produto para continuar.');
      return;
    }

    if (currentWeight <= 0) {
      setFeedback('Aguardando leitura da balanca para adicionar item.');
      return;
    }

    const nextItem: ComandaItem = {
      id: `item-${crypto.randomUUID()}`,
      item: selectedProduct.name,
      unitPrice: selectedProduct.pricePerKg,
      weight: Number(currentWeight.toFixed(3)),
      total: currentTotal
    };

    setComandaItems((prev) => [nextItem, ...prev].slice(0, 8));
    setFeedback(`Item adicionado: ${selectedProduct.name} por R$ ${currentTotal.toFixed(2)}.`);
  }, [currentTotal, currentWeight, selectedProduct]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === '/' || event.key === 'F3') {
        event.preventDefault();
        const input = document.getElementById('balanca-search');
        if (input instanceof HTMLInputElement) {
          input.focus();
          input.select();
        }
      }

      if (event.ctrlKey && event.key === '1') {
        event.preventDefault();
        setActiveScale('A');
        setFeedback('Balanca A selecionada.');
      }

      if (event.ctrlKey && event.key === '2') {
        event.preventDefault();
        setActiveScale('B');
        setFeedback('Balanca B selecionada.');
      }

      if (event.key === 'Enter') {
        const active = document.activeElement;
        if (active && active.id === 'balanca-search') {
          return;
        }

        event.preventDefault();
        onQuickAddItem();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onQuickAddItem]);

  const canUseScaleA = user?.role === 'ADMIN' || user?.role === 'GERENTE' || user?.role === 'CAIXA' || user?.role === 'BALANCA_A';
  const canUseScaleB = user?.role === 'ADMIN' || user?.role === 'GERENTE' || user?.role === 'CAIXA' || user?.role === 'BALANCA_B';

  const openSensitiveModal = (action: SensitiveAction) => {
    setPendingAction(action);
    setConfirmPin('');
    setConfirmMessage(null);
  };

  const closeSensitiveModal = () => {
    setPendingAction(null);
    setConfirmPin('');
    setConfirmMessage(null);
  };

  const onConfirmSensitiveAction = (event: FormEvent) => {
    event.preventDefault();

    if (!pendingAction) {
      return;
    }

    const result = confirmSensitiveAction(pendingAction, confirmPin);
    if (!result.success) {
      setConfirmMessage(result.message);
      return;
    }

    if (pendingAction === 'CLOSE_COMANDA') {
      setComandaItems([]);
      setFeedback('Comanda fechada com sucesso.');
    }

    if (pendingAction === 'CANCEL_ORDER') {
      setComandaItems((prev) => prev.slice(1));
      setFeedback('Ultimo item da comanda foi cancelado com sucesso.');
    }

    setConfirmMessage(result.message);
    setTimeout(() => {
      closeSensitiveModal();
    }, 450);
  };

  return (
    <main className="balanca-screen">
      <header className="balanca-topbar">
        <div className="balanca-brand">
          <h1>Balancas integradas</h1>
          <p>Comanda ativa com pesquisa rapida e atalhos de teclado.</p>
        </div>

        <div className="balanca-scale-switch">
          <button
            type="button"
            disabled={!canUseScaleA}
            className={activeScale === 'A' ? 'is-active' : ''}
            onClick={() => {
              setActiveScale('A');
              setFeedback(canUseScaleA ? 'Balanca A selecionada.' : 'Perfil sem acesso a Balanca A.');
            }}
          >
            Balanca A
          </button>
          <button
            type="button"
            disabled={!canUseScaleB}
            className={activeScale === 'B' ? 'is-active' : ''}
            onClick={() => {
              setActiveScale('B');
              setFeedback(canUseScaleB ? 'Balanca B selecionada.' : 'Perfil sem acesso a Balanca B.');
            }}
          >
            Balanca B
          </button>
        </div>
      </header>

      <section className="balanca-layout">
        <div className="balanca-left-column">
          <div className="balanca-search-box">
            <label htmlFor="balanca-search">Pesquisa de item</label>
            <input
              id="balanca-search"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Pesquisar item por nome"
            />
            <p>
              Atalhos: <span>/</span> ou <span>F3</span> foca pesquisa | <span>Ctrl+1</span> Balanca A | <span>Ctrl+2</span> Balanca B | <span>Enter</span> adiciona item.
            </p>
          </div>

          <WeightDisplay weight={currentWeight} realtimeEnabled wsUrl={wsUrl} error={error} />

          <PriceDisplay
            weight={currentWeight}
            unitPrice={selectedProduct?.pricePerKg ?? 0}
            realtimeEnabled
            wsUrl={wsUrl}
          />

          <button
            type="button"
            onClick={onQuickAddItem}
            className="balanca-primary-cta"
          >
            Adicionar item rapidamente
          </button>

          {feedback && (
            <p className="balanca-feedback">
              {feedback}
            </p>
          )}
        </div>

        <div className="balanca-right-column">
          <article className="balanca-card comanda-card">
            <header className="balanca-card-header">
              <h2>Comanda ativa</h2>
              <span className={['balanca-status-pill', isConnected ? 'is-connected' : 'is-offline'].join(' ')}>
                {isConnected ? `Online | Balanca ${activeScale}` : 'Sem conexao'}
              </span>
            </header>

            {comandaItems.length === 0 ? (
              <p className="balanca-muted">Nenhum item na comanda. Use Enter para incluir rapidamente.</p>
            ) : (
              <table className="comanda-table">
                <thead>
                  <tr>
                    <th>Item</th>
                    <th>Unidade</th>
                    <th>Peso</th>
                    <th>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {comandaItems.map((item) => (
                    <tr key={item.id}>
                      <td>{item.item}</td>
                      <td>R$ {item.unitPrice.toFixed(2)}</td>
                      <td>{item.weight.toFixed(3)}</td>
                      <td>R$ {item.total.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            <footer className="comanda-footer">
              <p>Itens: {comandaItems.length}</p>
              <strong>Total: R$ {comandaTotal.toFixed(2)}</strong>
            </footer>

            <div className="comanda-sensitive-actions">
              <button type="button" className="sensitive-close" onClick={() => openSensitiveModal('CLOSE_COMANDA')}>
                Fechar comanda
              </button>
              <button type="button" className="sensitive-cancel" onClick={() => openSensitiveModal('CANCEL_ORDER')}>
                Cancelar pedido
              </button>
            </div>
          </article>

          <ProductGrid
            products={visibleProducts}
            categories={categories}
            activeCategory={selectedCategory}
            onCategoryChange={setSelectedCategory}
            selectedProductId={selectedProduct?.id}
            onSelectProduct={onSelectProduct}
          />
        </div>
      </section>

      {pendingAction && (
        <div className="sensitive-modal-overlay" role="dialog" aria-modal="true">
          <div className="sensitive-modal">
            <h3>
              Confirmar {pendingAction === 'CLOSE_COMANDA' ? 'fechamento da comanda' : 'cancelamento do pedido'}
            </h3>
            <p>
              Digite o PIN de confirmacao do perfil {user?.role ?? 'desconhecido'} para liberar a acao.
            </p>

            <form onSubmit={onConfirmSensitiveAction}>
              <label htmlFor="confirm-pin">PIN de confirmacao</label>
              <input
                id="confirm-pin"
                type="password"
                value={confirmPin}
                onChange={(event) => setConfirmPin(event.target.value)}
                placeholder="Ex.: 2200"
                required
              />

              <div className="sensitive-modal-actions">
                <button type="submit">Confirmar</button>
                <button type="button" className="button-muted" onClick={closeSensitiveModal}>
                  Voltar
                </button>
              </div>
            </form>

            {confirmMessage && <p className="sensitive-modal-message">{confirmMessage}</p>}
          </div>
        </div>
      )}
    </main>
  );
}

export function BalancaScreenExample() {
  return <BalancaScreen />;
}
