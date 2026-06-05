import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type KeyboardEvent as ReactKeyboardEvent } from 'react';

import { useWebSocket } from '@/hooks/useWebSocket';
import { useProductsQuery } from '@/modules/products/presentation/hooks/useProductsQuery';
import { useAuth } from '@/modules/auth/presentation/providers/AuthProvider';
import type { SensitiveAction } from '@/modules/auth/presentation/providers/AuthProvider';
import { appendSensitiveAuditEvent } from '@/modules/admin/infrastructure/local/sensitiveAuditLog';
import { logInfo, logWarn } from '@/shared/infrastructure/logging/structuredLogger';
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
  byUnit: boolean;
  total: number;
};

type KeyboardTarget = 'COMANDA' | 'SEARCH' | 'MANUAL_WEIGHT';

const virtualKeyboardRows = [
  ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'],
  ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
  ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L'],
  ['Z', 'X', 'C', 'V', 'B', 'N', 'M']
] as const;

const comandaKeyboardRows = [
  ['1', '2', '3'],
  ['4', '5', '6'],
  ['7', '8', '9'],
  ['0']
] as const;

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
  const [comandaInputValue, setComandaInputValue] = useState('');
  const [activeComandaNumber, setActiveComandaNumber] = useState<string | null>(null);
  const [keyboardTarget, setKeyboardTarget] = useState<KeyboardTarget>('COMANDA');
  const [isVirtualKeyboardVisible, setIsVirtualKeyboardVisible] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [manualWeightInput, setManualWeightInput] = useState('');
  const [manualWeightValue, setManualWeightValue] = useState<number | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<ProductCategory>('GERAL');
  const [comandaItems, setComandaItems] = useState<ComandaItem[]>([]);
  const [comandaItemsRegistry, setComandaItemsRegistry] = useState<Record<string, ComandaItem[]>>({});
  const [comandaScaleLocks, setComandaScaleLocks] = useState<Record<string, ScaleId>>({});
  const [feedback, setFeedback] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<SensitiveAction | null>(null);
  const [confirmPin, setConfirmPin] = useState('');
  const [confirmMessage, setConfirmMessage] = useState<string | null>(null);
  const comandaInputRef = useRef<HTMLInputElement | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const isComandaOpen = Boolean(activeComandaNumber);

  const mappedProducts = useMemo<ProductCard[]>(() => {
    if (productEntities.length === 0) {
      return [
        { id: 'd1', name: 'Prato executivo', category: 'GERAL', pricePerKg: 39.9, unitLabel: 'kg', isPopular: true },
        { id: 'd2', name: 'Sobremesa da casa', category: 'SOBREMESAS', pricePerKg: 64.9, unitLabel: 'kg' },
        { id: 'd3', name: 'Salada premium', category: 'SALADAS', pricePerKg: 36.5, unitLabel: 'kg' }
      ];
    }

    return productEntities.map((product) => ({
      id: product.id,
      name: product.name,
      category: normalizeCategory(product.category),
      pricePerKg: product.price,
      unitLabel: (() => {
        if (product.byWeight === false) {
          return 'un' as const;
        }

        const normalizedLabel = `${product.name} ${product.category}`.toUpperCase();
        if (normalizedLabel.includes('REFRIGERANTE') || normalizedLabel.includes('BEBIDA')) {
          return 'un' as const;
        }

        return 'kg' as const;
      })(),
      isPopular: product.stock > 25,
      disabled: product.stock <= 0
    }));
  }, [productEntities]);

  const productEntityById = useMemo(() => {
    return new Map(productEntities.map((product) => [product.id, product]));
  }, [productEntities]);

  const isUnitSaleProduct = useCallback((product: ProductCard) => {
    if (product.unitLabel === 'un') {
      return true;
    }

    const normalizedLabel = `${product.name} ${product.category}`.toUpperCase();
    if (normalizedLabel.includes('REFRIGERANTE') || normalizedLabel.includes('BEBIDA')) {
      return true;
    }

    const sourceProduct = productEntityById.get(product.id);
    if (!sourceProduct) {
      return false;
    }

    return sourceProduct.byWeight === false;
  }, [productEntityById]);

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

  const effectiveWeight = useMemo(() => {
    if (manualWeightValue !== null && manualWeightValue > 0) {
      return manualWeightValue;
    }

    return currentWeight;
  }, [currentWeight, manualWeightValue]);

  const previewAmount = useMemo(() => {
    if (!selectedProduct) {
      return 0;
    }

    if (isUnitSaleProduct(selectedProduct)) {
      return 1;
    }

    return effectiveWeight;
  }, [effectiveWeight, isUnitSaleProduct, selectedProduct]);

  const visibleProducts = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    return mappedProducts
      .filter((product) => selectedCategory === 'GERAL' || product.category === selectedCategory)
      .filter((product) => (normalizedSearch ? product.name.toLowerCase().includes(normalizedSearch) : true))
      .map((product) => ({
        ...product,
        disabled: !isComandaOpen || product.disabled
      }));
  }, [mappedProducts, searchTerm, selectedCategory, isComandaOpen]);

  const suggestedProducts = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();
    if (!isComandaOpen || normalizedSearch.length < 3) {
      return [];
    }

    return mappedProducts
      .filter((product) => product.name.toLowerCase().includes(normalizedSearch))
      .slice(0, 6);
  }, [mappedProducts, searchTerm, isComandaOpen]);

  const comandaTotal = useMemo(() => {
    return comandaItems.reduce((sum, item) => sum + item.total, 0);
  }, [comandaItems]);

  useEffect(() => {
    if (!activeComandaNumber) {
      return;
    }

    setComandaItemsRegistry((prev) => ({
      ...prev,
      [activeComandaNumber]: comandaItems
    }));
  }, [activeComandaNumber, comandaItems]);

  const launchCartItems = useMemo(() => {
    return comandaItems.slice(0, 4);
  }, [comandaItems]);

  const onIncrementComandaItem = useCallback((itemId: string) => {
    setComandaItems((prev) =>
      prev.map((item) => {
        if (item.id !== itemId) {
          return item;
        }

        const nextAmount = item.byUnit ? item.weight + 1 : Number((item.weight + 0.1).toFixed(3));
        return {
          ...item,
          weight: nextAmount,
          total: Number((item.unitPrice * nextAmount).toFixed(2))
        };
      })
    );
    setFeedback('Item atualizado na comanda.');
  }, []);

  const onDecrementComandaItem = useCallback((itemId: string) => {
    setComandaItems((prev) => {
      const nextItems: ComandaItem[] = [];

      for (const item of prev) {
        if (item.id !== itemId) {
          nextItems.push(item);
          continue;
        }

        const decrementedAmount = item.byUnit ? item.weight - 1 : Number((item.weight - 0.1).toFixed(3));
        if (decrementedAmount <= 0) {
          continue;
        }

        nextItems.push({
          ...item,
          weight: decrementedAmount,
          total: Number((item.unitPrice * decrementedAmount).toFixed(2))
        });
      }

      return nextItems;
    });
    setFeedback('Item atualizado na comanda.');
  }, []);

  const onRemoveComandaItem = useCallback((itemId: string) => {
    setComandaItems((prev) => prev.filter((item) => item.id !== itemId));
    setFeedback('Item removido da comanda.');
  }, []);

  const addItemForProduct = useCallback((product: ProductCard) => {
    if (!isComandaOpen) {
      setFeedback('Abra a comanda antes de lançar itens e peso.');
      return;
    }

    const byUnit = isUnitSaleProduct(product);
    const launchAmount = byUnit ? 1 : effectiveWeight;

    if (!byUnit && effectiveWeight <= 0) {
      setFeedback('Aguardando leitura da balanca ou informe peso manual para adicionar item.');
      return;
    }

    const nextTotal = Number((product.pricePerKg * launchAmount).toFixed(2));
    const nextItem: ComandaItem = {
      id: `item-${crypto.randomUUID()}`,
      item: product.name,
      unitPrice: product.pricePerKg,
      weight: Number(launchAmount.toFixed(3)),
      byUnit,
      total: nextTotal
    };

    setComandaItems((prev) => [nextItem, ...prev].slice(0, 8));
    setSelectedProduct(product);
    setSelectedCategory(product.category);
    setSearchTerm('');
    setIsVirtualKeyboardVisible(false);
    setFeedback(
      `Item adicionado: ${product.name} (${byUnit ? '1 un' : `${launchAmount.toFixed(3)} kg`}) por R$ ${nextTotal.toFixed(2)}.`
    );
  }, [effectiveWeight, isComandaOpen, isUnitSaleProduct]);

  const openComandaFromInput = useCallback(() => {
    const nextComanda = comandaInputValue.trim();
    if (!nextComanda) {
      setFeedback('Leia a comanda no leitor ou digite o numero para abrir.');
      return;
    }

    const lockedScale = comandaScaleLocks[nextComanda];
    if (lockedScale && lockedScale !== activeScale) {
      setFeedback(`Comanda ${nextComanda} esta em atendimento na Balanca ${lockedScale}.`);
      return;
    }

    if (activeComandaNumber && activeComandaNumber !== nextComanda) {
      setComandaScaleLocks((prev) => {
        const nextLocks = { ...prev };
        delete nextLocks[activeComandaNumber];
        return nextLocks;
      });
    }

    setComandaScaleLocks((prev) => ({
      ...prev,
      [nextComanda]: activeScale
    }));

    setActiveComandaNumber(nextComanda);
    setComandaItems(comandaItemsRegistry[nextComanda] ?? []);
    setIsVirtualKeyboardVisible(false);
    setFeedback(
      comandaItemsRegistry[nextComanda]
        ? `Comanda ${nextComanda} reaberta com itens anteriores.`
        : `Comanda ${nextComanda} aberta com sucesso.`
    );
  }, [activeComandaNumber, activeScale, comandaInputValue, comandaItemsRegistry, comandaScaleLocks]);

  const switchScaleWithGuard = useCallback((targetScale: ScaleId) => {
    if (activeScale === targetScale) {
      return;
    }

    if (activeComandaNumber) {
      const lockedScale = comandaScaleLocks[activeComandaNumber] ?? activeScale;
      if (lockedScale !== targetScale) {
        setFeedback(`Comanda ${activeComandaNumber} esta aberta na Balanca ${lockedScale}. Finalize em Proximo cliente para trocar.`);
        return;
      }
    }

    setActiveScale(targetScale);
    setFeedback(`Balanca ${targetScale} selecionada.`);
  }, [activeComandaNumber, activeScale, comandaScaleLocks]);

  const updateKeyboardTargetValue = useCallback((updater: (current: string) => string) => {
    if (keyboardTarget === 'COMANDA') {
      setComandaInputValue((current) => updater(current));
      return;
    }

    if (keyboardTarget === 'MANUAL_WEIGHT') {
      setManualWeightInput((current) => updater(current));
      return;
    }

    setSearchTerm((current) => updater(current));
  }, [keyboardTarget]);

  const onVirtualKeyboardPress = useCallback((key: string) => {
    if (key === 'BACKSPACE') {
      updateKeyboardTargetValue((current) => current.slice(0, -1));
      return;
    }

    if (key === 'CLEAR') {
      updateKeyboardTargetValue(() => '');
      return;
    }

    if (key === 'SPACE') {
      updateKeyboardTargetValue((current) => `${current} `);
      return;
    }

    if (key === 'DOT') {
      if (keyboardTarget !== 'MANUAL_WEIGHT' && keyboardTarget !== 'COMANDA') {
        return;
      }

      updateKeyboardTargetValue((current) => {
        if (current.includes('.') || current.includes(',')) {
          return current;
        }

        return current.length === 0 ? '0.' : `${current}.`;
      });
      return;
    }

    if (key === 'ENTER') {
      if (keyboardTarget === 'COMANDA') {
        openComandaFromInput();
        setIsVirtualKeyboardVisible(false);
        return;
      }

      if (keyboardTarget === 'SEARCH') {
        const firstSuggestion = suggestedProducts[0];
        if (firstSuggestion) {
          addItemForProduct(firstSuggestion);
          return;
        }

        if (!selectedProduct) {
          setFeedback('Selecione um produto para continuar.');
          return;
        }

        addItemForProduct(selectedProduct);
      }
      return;
    }

    const charToAppend = keyboardTarget === 'SEARCH' ? key.toLowerCase() : key;
    updateKeyboardTargetValue((current) => `${current}${charToAppend}`);
  }, [addItemForProduct, keyboardTarget, openComandaFromInput, selectedProduct, suggestedProducts, updateKeyboardTargetValue]);

  const onSelectProduct = (product: ProductCard) => {
    if (!isComandaOpen) {
      setFeedback('Abra a comanda antes de selecionar produtos.');
      return;
    }

    setSelectedProduct(product);
    setSelectedCategory(product.category);
    setFeedback(`Produto selecionado: ${product.name}`);
  };

  const onQuickAddItem = useCallback(() => {
    if (!isComandaOpen) {
      setFeedback('Abra a comanda antes de lançar itens e peso.');
      return;
    }

    if (!selectedProduct) {
      setFeedback('Selecione um produto para continuar.');
      return;
    }

    addItemForProduct(selectedProduct);
  }, [addItemForProduct, isComandaOpen, selectedProduct]);

  const applyManualWeight = useCallback(() => {
    const parsedWeight = Number(manualWeightInput.replace(',', '.'));
    if (!Number.isFinite(parsedWeight) || parsedWeight <= 0) {
      setFeedback('Informe um peso manual válido em kg.');
      return;
    }

    setManualWeightValue(parsedWeight);
    setFeedback(`Peso manual aplicado: ${parsedWeight.toFixed(3)} kg.`);
  }, [manualWeightInput]);

  const clearManualWeight = useCallback(() => {
    setManualWeightValue(null);
    setManualWeightInput('');
    setFeedback('Peso manual removido. Retornando leitura da balança.');
  }, []);

  const onSearchInputKeyDown = useCallback((event: ReactKeyboardEvent<HTMLInputElement>) => {
    if (event.key !== 'Enter') {
      return;
    }

    event.preventDefault();

    const firstSuggestion = suggestedProducts[0];
    if (firstSuggestion) {
      addItemForProduct(firstSuggestion);
      return;
    }

    onQuickAddItem();
  }, [addItemForProduct, onQuickAddItem, suggestedProducts]);

  useEffect(() => {
    if (!isComandaOpen) {
      setKeyboardTarget('COMANDA');
      setIsVirtualKeyboardVisible(false);
      comandaInputRef.current?.focus();
      return;
    }

    searchInputRef.current?.focus();
  }, [isComandaOpen]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === '/' || event.key === 'F3') {
        event.preventDefault();
        if (!isComandaOpen) {
          const input = document.getElementById('balanca-comanda');
          if (input instanceof HTMLInputElement) {
            input.focus();
            input.select();
          }
          return;
        }

        const searchInput = document.getElementById('balanca-search');
        if (searchInput instanceof HTMLInputElement) {
          searchInput.focus();
          searchInput.select();
        }
      }

      if (event.ctrlKey && event.key === '1') {
        event.preventDefault();
        switchScaleWithGuard('A');
      }

      if (event.ctrlKey && event.key === '2') {
        event.preventDefault();
        switchScaleWithGuard('B');
      }

      if (event.key === 'Enter') {
        const active = document.activeElement;
        if (active && active.id === 'balanca-comanda') {
          event.preventDefault();
          openComandaFromInput();
          return;
        }

        if (active && active.id === 'balanca-search') {
          return;
        }

        event.preventDefault();
        onQuickAddItem();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isComandaOpen, onQuickAddItem, openComandaFromInput, switchScaleWithGuard]);

  const canUseScaleA = user?.role === 'ADMIN' || user?.role === 'GERENTE' || user?.role === 'CAIXA' || user?.role === 'BALANCA_A';
  const canUseScaleB = user?.role === 'ADMIN' || user?.role === 'GERENTE' || user?.role === 'CAIXA' || user?.role === 'BALANCA_B';
  const canAdvanceToNextCustomer = user?.role === 'ADMIN' || user?.role === 'GERENTE' || user?.role === 'CAIXA' || user?.role === 'BALANCA_A' || user?.role === 'BALANCA_B';

  const proceedToNextCustomer = useCallback(() => {
    if (!isComandaOpen) {
      setFeedback('Nenhuma comanda aberta para encerrar atendimento.');
      return;
    }

    if (!canAdvanceToNextCustomer) {
      setFeedback('Perfil sem permissao para encerrar atendimento.');
      return;
    }

    if (activeComandaNumber) {
      setComandaItemsRegistry((prev) => ({
        ...prev,
        [activeComandaNumber]: comandaItems
      }));

      setComandaScaleLocks((prev) => {
        const nextLocks = { ...prev };
        delete nextLocks[activeComandaNumber];
        return nextLocks;
      });
    }

    if (user) {
      appendSensitiveAuditEvent({
        action: 'CLOSE_COMANDA',
        actorRole: user.role,
        actorName: user.name,
        outcome: 'SUCCESS',
        reason: 'Encerrado sem PIN para agilidade operacional da balanca.',
        scaleId: activeScale
      });
    }

    setActiveComandaNumber(null);
    setComandaInputValue('');
    setComandaItems([]);
    setSearchTerm('');
    setManualWeightValue(null);
    setManualWeightInput('');
    setIsVirtualKeyboardVisible(false);
    setFeedback('Atendimento encerrado. Balanca pronta para o proximo cliente; reabra a comanda quando necessario.');
  }, [activeComandaNumber, activeScale, canAdvanceToNextCustomer, comandaItems, isComandaOpen, user]);

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
      logWarn({
        event: 'BALANCA_SENSITIVE_DENIED',
        module: 'balanca',
        details: {
          action: pendingAction,
          scale: activeScale,
          role: user?.role ?? 'UNKNOWN'
        }
      });

      if (user) {
        appendSensitiveAuditEvent({
          action: pendingAction,
          actorRole: user.role,
          actorName: user.name,
          outcome: 'DENIED',
          reason: result.message,
          scaleId: activeScale
        });
      }
      setConfirmMessage(result.message);
      return;
    }

    if (pendingAction === 'CANCEL_ORDER') {
      setComandaItems((prev) => prev.slice(1));
      setFeedback('Ultimo item da comanda foi cancelado com sucesso.');
    }

    logInfo({
      event: 'BALANCA_SENSITIVE_SUCCESS',
      module: 'balanca',
      details: {
        action: pendingAction,
        scale: activeScale,
        role: user?.role ?? 'UNKNOWN'
      }
    });

    if (user) {
      appendSensitiveAuditEvent({
        action: pendingAction,
        actorRole: user.role,
        actorName: user.name,
        outcome: 'SUCCESS',
        reason: result.message,
        scaleId: activeScale
      });
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
              if (!canUseScaleA) {
                setFeedback('Perfil sem acesso a Balanca A.');
                return;
              }

              switchScaleWithGuard('A');
            }}
          >
            Balanca A
          </button>
          <button
            type="button"
            disabled={!canUseScaleB}
            className={activeScale === 'B' ? 'is-active' : ''}
            onClick={() => {
              if (!canUseScaleB) {
                setFeedback('Perfil sem acesso a Balanca B.');
                return;
              }

              switchScaleWithGuard('B');
            }}
          >
            Balanca B
          </button>
        </div>
      </header>

      <section className="balanca-layout">
        <div className="balanca-left-column">
          <div className="balanca-search-box">
            <label htmlFor="balanca-comanda">Leitura da comanda</label>
            <div className="balanca-comanda-row">
              <input
                id="balanca-comanda"
                ref={comandaInputRef}
                value={comandaInputValue}
                onFocus={() => {
                  setKeyboardTarget('COMANDA');
                  setIsVirtualKeyboardVisible(true);
                }}
                onChange={(event) => setComandaInputValue(event.target.value)}
                placeholder="Aguardando leitura da comanda..."
                className={!isComandaOpen ? 'balanca-input-waiting' : ''}
              />
              <button type="button" className="balanca-open-comanda" onClick={openComandaFromInput}>
                {isComandaOpen ? 'Trocar comanda' : 'Abrir comanda'}
              </button>
            </div>
            <p className={['balanca-comanda-waiting', !isComandaOpen ? 'is-blinking' : ''].join(' ')}>
              {isComandaOpen
                ? `Comanda ativa: ${activeComandaNumber}`
                : 'Aguardando leitura da comanda por leitor. Se necessário, digite o número da comanda.'}
            </p>

            <label htmlFor="balanca-search">Pesquisa de item</label>
            <input
              id="balanca-search"
              ref={searchInputRef}
              value={searchTerm}
              onFocus={() => {
                setKeyboardTarget('SEARCH');
                setIsVirtualKeyboardVisible(true);
              }}
              onKeyDown={onSearchInputKeyDown}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder={isComandaOpen ? 'Pesquisar item por nome' : 'Abra a comanda para habilitar a pesquisa'}
              disabled={!isComandaOpen}
            />

            {suggestedProducts.length > 0 && (
              <div className="balanca-search-suggestions" role="list" aria-label="Sugestões de produtos">
                {suggestedProducts.map((product) => (
                  <button
                    key={product.id}
                    type="button"
                    className="balanca-suggestion-item"
                    onClick={() => {
                      addItemForProduct(product);
                      setIsVirtualKeyboardVisible(false);
                    }}
                  >
                    <strong>{product.name}</strong>
                    <small>R$ {product.pricePerKg.toFixed(2)} / {isUnitSaleProduct(product) ? 'un' : 'kg'}</small>
                  </button>
                ))}
              </div>
            )}

            <div className="balanca-keyboard-target-switch" role="group" aria-label="Destino do teclado virtual">
              <button
                type="button"
                className={keyboardTarget === 'COMANDA' ? 'is-active' : ''}
                onClick={() => {
                  setKeyboardTarget('COMANDA');
                  setIsVirtualKeyboardVisible(true);
                  comandaInputRef.current?.focus();
                }}
              >
                Teclado: Comanda
              </button>
              <button
                type="button"
                className={keyboardTarget === 'SEARCH' ? 'is-active' : ''}
                onClick={() => {
                  setKeyboardTarget('SEARCH');
                  setIsVirtualKeyboardVisible(true);
                  searchInputRef.current?.focus();
                }}
                disabled={!isComandaOpen}
              >
                Teclado: Pesquisa
              </button>
            </div>

            {isVirtualKeyboardVisible && (
              <div
                className={[
                  'balanca-virtual-keyboard',
                  keyboardTarget === 'COMANDA' || keyboardTarget === 'MANUAL_WEIGHT' ? 'is-comanda' : 'is-search'
                ].join(' ')}
                aria-label="Teclado virtual"
              >
                {keyboardTarget === 'COMANDA' || keyboardTarget === 'MANUAL_WEIGHT' ? (
                  <>
                    {comandaKeyboardRows.map((row, rowIndex) => (
                      <div key={`comanda-row-${rowIndex}`} className="balanca-keyboard-row is-comanda-row">
                        {row.map((key) => (
                          <button key={key} type="button" onClick={() => onVirtualKeyboardPress(key)}>
                            {key}
                          </button>
                        ))}
                      </div>
                    ))}
                    <div
                      className={[
                        'balanca-keyboard-row',
                        'is-actions',
                        'is-comanda-actions'
                      ].join(' ')}
                    >
                      <button type="button" onClick={() => onVirtualKeyboardPress('DOT')}>.</button>
                      <button type="button" onClick={() => onVirtualKeyboardPress('BACKSPACE')}>Apagar</button>
                      <button type="button" onClick={() => onVirtualKeyboardPress('CLEAR')}>Limpar</button>
                      <button type="button" onClick={() => onVirtualKeyboardPress('ENTER')}>Enter</button>
                    </div>
                  </>
                ) : (
                  <>
                    {virtualKeyboardRows.map((row, rowIndex) => (
                      <div key={`row-${rowIndex}`} className="balanca-keyboard-row">
                        {row.map((key) => (
                          <button key={key} type="button" onClick={() => onVirtualKeyboardPress(key)}>
                            {key}
                          </button>
                        ))}
                      </div>
                    ))}
                    <div className="balanca-keyboard-row is-actions">
                      <button type="button" onClick={() => onVirtualKeyboardPress('SPACE')}>Espaço</button>
                      <button type="button" onClick={() => onVirtualKeyboardPress('BACKSPACE')}>Apagar</button>
                      <button type="button" onClick={() => onVirtualKeyboardPress('CLEAR')}>Limpar</button>
                      <button type="button" onClick={() => onVirtualKeyboardPress('ENTER')}>Enter</button>
                    </div>
                  </>
                )}
              </div>
            )}

            <p>
              Atalhos: <span>/</span> ou <span>F3</span> foca pesquisa | <span>Ctrl+1</span> Balanca A | <span>Ctrl+2</span> Balanca B | <span>Enter</span> adiciona item.
            </p>
          </div>

          <WeightDisplay weight={isComandaOpen ? currentWeight : 0} realtimeEnabled wsUrl={wsUrl} error={error} />

          <div className="balanca-manual-weight">
            <label htmlFor="balanca-manual-weight-input">Peso manual (kg)</label>
            <div className="balanca-manual-weight-row">
              <input
                id="balanca-manual-weight-input"
                value={manualWeightInput}
                onFocus={() => {
                  setKeyboardTarget('MANUAL_WEIGHT');
                  setIsVirtualKeyboardVisible(true);
                }}
                onChange={(event) => setManualWeightInput(event.target.value)}
                placeholder="Ex: 0,450"
                disabled={!isComandaOpen}
              />
              <button type="button" onClick={applyManualWeight} disabled={!isComandaOpen}>
                Usar peso manual
              </button>
              <button type="button" className="button-muted" onClick={clearManualWeight} disabled={!isComandaOpen || manualWeightValue === null}>
                Limpar manual
              </button>
            </div>
            <p>
              Fonte do peso: {manualWeightValue !== null ? `manual (${manualWeightValue.toFixed(3)} kg)` : 'balança'}
            </p>
          </div>

          <PriceDisplay
            weight={isComandaOpen ? previewAmount : 0}
            unitPrice={selectedProduct?.pricePerKg ?? 0}
            unitLabel={selectedProduct && isUnitSaleProduct(selectedProduct) ? 'un' : 'kg'}
            realtimeEnabled
            wsUrl={wsUrl}
          />

          <button
            type="button"
            onClick={() => {
              onQuickAddItem();
              setIsVirtualKeyboardVisible(false);
            }}
            className="balanca-primary-cta"
            disabled={!isComandaOpen}
          >
            Adicionar item rapidamente
          </button>

          {launchCartItems.length > 0 && (
            <article className="balanca-launch-cart" aria-live="polite">
              <header>
                <h3>Carrinho de lançamento</h3>
                <span>{launchCartItems.length} item(ns) recente(s)</span>
              </header>
              <div className="balanca-launch-cart-list">
                {launchCartItems.map((item) => (
                  <div key={item.id} className="balanca-launch-cart-item">
                    <strong>{item.item}</strong>
                    <small>{item.byUnit ? `${item.weight.toFixed(0)} un` : `${item.weight.toFixed(3)} kg`}</small>
                    <span>R$ {item.total.toFixed(2)}</span>
                  </div>
                ))}
              </div>
              <footer>
                <strong>Total parcial: R$ {comandaTotal.toFixed(2)}</strong>
              </footer>
            </article>
          )}

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

            <p className="balanca-comanda-id">
              {isComandaOpen ? `Nº da comanda: ${activeComandaNumber}` : 'Nenhuma comanda aberta.'}
            </p>

            {comandaItems.length === 0 ? (
              <p className="balanca-muted">
                {isComandaOpen
                  ? 'Nenhum item na comanda. Use Enter para incluir rapidamente.'
                  : 'Nenhuma comanda aberta. Leia ou digite o numero da comanda para iniciar.'}
              </p>
            ) : (
              <table className="comanda-table">
                <thead>
                  <tr>
                    <th>Item</th>
                    <th>Unidade</th>
                    <th>Peso/Un</th>
                    <th>Total</th>
                    <th>Excluir</th>
                  </tr>
                </thead>
                <tbody>
                  {comandaItems.map((item) => (
                    <tr key={item.id}>
                      <td>{item.item}</td>
                      <td>R$ {item.unitPrice.toFixed(2)}</td>
                      <td>
                        <div className="comanda-amount-control">
                          <button type="button" onClick={() => onDecrementComandaItem(item.id)}>-</button>
                          <span>{item.byUnit ? `${item.weight.toFixed(0)} un` : `${item.weight.toFixed(3)} kg`}</span>
                          <button type="button" onClick={() => onIncrementComandaItem(item.id)}>+</button>
                        </div>
                      </td>
                      <td>R$ {item.total.toFixed(2)}</td>
                      <td>
                        <button type="button" className="comanda-delete-item" onClick={() => onRemoveComandaItem(item.id)}>
                          Excluir
                        </button>
                      </td>
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
              <button
                type="button"
                className="sensitive-close"
                disabled={!isComandaOpen}
                onClick={proceedToNextCustomer}
              >
                Proximo cliente
              </button>
              <button
                type="button"
                className="sensitive-cancel"
                disabled={!isComandaOpen || comandaItems.length === 0}
                onClick={() => openSensitiveModal('CANCEL_ORDER')}
              >
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
              Confirmar cancelamento do pedido
            </h3>
            <p>
              {`Digite o PIN de confirmacao do perfil ${user?.role ?? 'desconhecido'} para liberar a acao.`}
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
