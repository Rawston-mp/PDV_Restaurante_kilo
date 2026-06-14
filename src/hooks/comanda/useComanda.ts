import { useEffect, useMemo, useRef, useState } from 'react';

import type { Categoria, EstadoComanda, ItemComanda } from '@/types/comanda';
import { useKeyboard } from '@/hooks/comanda/useKeyboard';
import { useWeight } from '@/hooks/comanda/useWeight';
import { useAuth } from '@/modules/auth/presentation/providers/AuthProvider';
import {
  buildComandaCategories,
  mergeCategoryOptions,
  readStoredProductCategories
} from '@/modules/products/domain/services/productCategories';
import { productsContainer } from '@/modules/products/infrastructure/container/productsContainer';
import { readComandaCache, writeComandaCache } from '@/shared/infrastructure/storage/comandaCache';

type ProdutoCatalogo = {
  id: string;
  nome: string;
  precoUnitario: number;
  categoriaId: string;
  porUnidade: boolean;
};

type ComandaSnapshot = {
  itens: ItemComanda[];
  dataAbertura: Date;
};

type LockOwner = 'COMANDA_A' | 'COMANDA_B';
type LockStationId = 'BALANCA_A' | 'BALANCA_B';

type LockContext = {
  owner: LockOwner;
  stationId: LockStationId;
};

type LockData = {
  owner: LockOwner;
  stationId: LockStationId;
  expiresAt: string;
};

type BackendError = {
  status?: number;
  message: string;
  conflictLock?: {
    owner?: string;
    stationId?: string;
    expiresAt?: string;
  };
};

type AcquireLockResponse = {
  ok: boolean;
  lock?: LockData;
};

const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:3001';
const LOCK_TTL_SECONDS = 120;

type PersistedComandaSnapshot = {
  itens: ItemComanda[];
  updatedAt: string;
};

const loadPersistedComandas = (): Record<string, ComandaSnapshot> => {
  const parsed = readComandaCache() as Record<string, PersistedComandaSnapshot>;
  return Object.entries(parsed).reduce<Record<string, ComandaSnapshot>>((acc, [numero, snapshot]) => {
    acc[numero] = {
      itens: snapshot.itens,
      dataAbertura: snapshot.updatedAt ? new Date(snapshot.updatedAt) : new Date()
    };

    return acc;
  }, {});
};

const persistComandas = (comandas: Record<string, ComandaSnapshot>) => {
  const payload = Object.entries(comandas).reduce<Record<string, PersistedComandaSnapshot>>((acc, [numero, snapshot]) => {
    acc[numero] = {
      itens: snapshot.itens,
      updatedAt: snapshot.dataAbertura.toISOString()
    };

    return acc;
  }, {});

  writeComandaCache(payload);
};

const roleToLockContext = (role?: string | null): LockContext | null => {
  if (role === 'COMANDA_A') {
    return {
      owner: 'COMANDA_A',
      stationId: 'BALANCA_A'
    };
  }

  if (role === 'COMANDA_B') {
    return {
      owner: 'COMANDA_B',
      stationId: 'BALANCA_B'
    };
  }

  return null;
};

const formatLockConflictMessage = (error: BackendError) => {
  const owner = error.conflictLock?.owner;
  const station = error.conflictLock?.stationId;

  if (owner || station) {
    return `Comanda em uso por ${owner ?? 'outro operador'} (${station ?? 'outra estacao'}).`;
  }

  return error.message || 'Comanda em uso por outra balanca.';
};

const isConnectivityError = (error: unknown) => {
  if (error instanceof TypeError) {
    return true;
  }

  if (typeof error === 'object' && error !== null && 'message' in error) {
    const rawMessage = String((error as { message?: unknown }).message ?? '');
    const normalizedMessage = rawMessage.toLowerCase();
    return normalizedMessage.includes('failed to fetch') || normalizedMessage.includes('networkerror');
  }

  return false;
};

const parseError = async (response: Response): Promise<BackendError> => {
  const fallback: BackendError = {
    status: response.status,
    message: 'Falha ao comunicar com o backend de comandas.'
  };

  try {
    const payload = (await response.json()) as {
      message?: string;
      conflictLock?: BackendError['conflictLock'];
    };

    return {
      status: response.status,
      message: payload.message ?? fallback.message,
      conflictLock: payload.conflictLock
    };
  } catch {
    return fallback;
  }
};

const normalizeSearchText = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[^\x00-\x7F]/g, '')
    .toLowerCase();

const isPorQuiloCategoryName = (value: string) => {
  const normalized = normalizeSearchText(value).replace(/\s+/g, ' ').trim();
  return normalized === 'por quilo' || normalized === 'por kilo';
};

const isSelServiceProduct = (value: string) => {
  const normalized = normalizeSearchText(value);
  return normalized.includes('sel-service') || normalized.includes('self-service') || normalized.includes('self service');
};

export function useComanda(taxaImposto = 0.1) {
  const { user } = useAuth();
  const [comandaNumber, setComandaNumber] = useState('');
  const [comandaAtivaId, setComandaAtivaId] = useState<string | null>(null);
  const [dataAberturaAtual, setDataAberturaAtual] = useState<Date | null>(null);
  const [comandasAbertas, setComandasAbertas] = useState<Record<string, ComandaSnapshot>>(() => loadPersistedComandas());
  const [campoAtivo, setCampoAtivo] = useState<'COMANDA' | 'PESQUISA'>('COMANDA');
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [categoriaSelecionada, setCategoriaSelecionada] = useState('');
  const [catalogoProdutos, setCatalogoProdutos] = useState<ProdutoCatalogo[]>([]);
  const [pesquisa, setPesquisa] = useState('');
  const [itens, setItens] = useState<ItemComanda[]>([]);
  const [erro, setErro] = useState<string | null>(null);
  const [precoAtual, setPrecoAtual] = useState(0);
  const [lockData, setLockData] = useState<LockData | null>(null);
  const [isOfflineMode, setIsOfflineMode] = useState(false);

  const { tecladoAtivo, toggleToNumerico, toggleToVirtual } = useKeyboard('NUMERICO');
  const { pesoSensor, pesoAtual, pesoManual, setPesoManual, isComandaConectada } = useWeight(Boolean(comandaAtivaId));
  const activeComandaRef = useRef<string | null>(null);
  const lockContext = useMemo(() => roleToLockContext(user?.role), [user?.role]);

  useEffect(() => {
    const loadCatalogo = async () => {
      try {
        const products = await productsContainer.productRepository.list();
        const mappedProducts: ProdutoCatalogo[] = products.map((product) => ({
          id: product.id,
          nome: product.name,
          precoUnitario: product.price,
          categoriaId: product.category,
          porUnidade: !product.byWeight
        }));

        const nextCategorias = buildComandaCategories(
          mergeCategoryOptions(readStoredProductCategories(), products)
        );

        setCatalogoProdutos(mappedProducts);
        setCategorias(nextCategorias);
        setCategoriaSelecionada((current) => {
          if (nextCategorias.some((categoria) => categoria.id === current)) {
            return current;
          }

          return nextCategorias[0]?.id ?? '';
        });
        setPrecoAtual((current) => current || mappedProducts[0]?.precoUnitario || 0);
      } catch {
        setCatalogoProdutos([]);
        setCategorias([]);
        setCategoriaSelecionada('');
        setPrecoAtual(0);
      }
    };

    void loadCatalogo();
  }, []);

  const subtotal = useMemo(() => itens.reduce((acc, item) => acc + item.subtotal, 0), [itens]);
  const impostos = useMemo(() => Number((subtotal * taxaImposto).toFixed(2)), [subtotal, taxaImposto]);
  const total = useMemo(() => Number((subtotal + impostos).toFixed(2)), [subtotal, impostos]);
  const porQuiloCategoryId = useMemo(
    () => categorias.find((categoria) => isPorQuiloCategoryName(categoria.nome))?.id ?? null,
    [categorias]
  );
  const isComandaAberta = Boolean(comandaAtivaId);

  useEffect(() => {
    activeComandaRef.current = comandaAtivaId;
  }, [comandaAtivaId]);

  useEffect(() => {
    if (!lockContext) {
      setLockData(null);
    }
  }, [lockContext]);

  useEffect(() => {
    persistComandas(comandasAbertas);
  }, [comandasAbertas]);

  useEffect(() => {
    if (!comandaAtivaId) {
      return;
    }

    setComandasAbertas((prev) => ({
      ...prev,
      [comandaAtivaId]: {
        itens,
        dataAbertura: dataAberturaAtual ?? prev[comandaAtivaId]?.dataAbertura ?? new Date()
      }
    }));
  }, [comandaAtivaId, dataAberturaAtual, itens]);

  const requestOpenComanda = async (numero: string) => {
    const response = await fetch(`${API_BASE}/api/v1/comandas`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ numero })
    });

    if (!response.ok) {
      throw await parseError(response);
    }
  };

  const acquireLock = async (numero: string) => {
    if (!lockContext) {
      setLockData(null);
      return null;
    }

    const response = await fetch(`${API_BASE}/api/v1/comandas/${encodeURIComponent(numero)}/lock/acquire`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        owner: lockContext.owner,
        stationId: lockContext.stationId,
        ttlSeconds: LOCK_TTL_SECONDS,
        reason: 'ui_comanda_open'
      })
    });

    if (!response.ok) {
      throw await parseError(response);
    }

    const payload = (await response.json()) as AcquireLockResponse;
    if (!payload.lock) {
      return null;
    }

    setLockData(payload.lock);
    return payload.lock;
  };

  const renewLock = async (numero: string) => {
    if (!lockContext) {
      return;
    }

    const response = await fetch(`${API_BASE}/api/v1/comandas/${encodeURIComponent(numero)}/lock/renew`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        owner: lockContext.owner,
        stationId: lockContext.stationId,
        ttlSeconds: LOCK_TTL_SECONDS,
        reason: 'ui_comanda_heartbeat'
      })
    });

    if (!response.ok) {
      throw await parseError(response);
    }

    const payload = (await response.json()) as AcquireLockResponse;
    if (payload.lock) {
      setLockData(payload.lock);
    }
  };

  const releaseLock = async (numero: string) => {
    if (!lockContext) {
      setLockData(null);
      return;
    }

    const response = await fetch(`${API_BASE}/api/v1/comandas/${encodeURIComponent(numero)}/lock/release`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        owner: lockContext.owner,
        stationId: lockContext.stationId,
        reason: 'ui_comanda_release'
      })
    });

    if (!response.ok) {
      const backendError = await parseError(response);
      if (backendError.status === 409) {
        setLockData(null);
        return;
      }

      throw backendError;
    }

    setLockData(null);
  };

  useEffect(() => {
    if (!comandaAtivaId || !lockContext) {
      return;
    }

    const intervalId = window.setInterval(() => {
      void renewLock(comandaAtivaId).catch((backendError: BackendError) => {
        setErro(backendError.message || 'Falha ao renovar lock da comanda.');
      });
    }, 15000);

    return () => {
      clearInterval(intervalId);
    };
  }, [comandaAtivaId, lockContext]);

  useEffect(() => {
    return () => {
      const activeNumero = activeComandaRef.current;
      if (!activeNumero || !lockContext) {
        return;
      }

      void releaseLock(activeNumero).catch(() => {
        // sem efeito visual no unmount
      });
    };
  }, [lockContext]);

  const produtosFiltrados = useMemo(() => {
    const termo = pesquisa.trim().toLowerCase();

    if (termo.length > 0 && termo.length < 3) {
      return [];
    }

    const isBuscaGlobalPorNome = termo.length >= 3;

    return catalogoProdutos.filter((produto) => {
      const matchCategoria =
        isBuscaGlobalPorNome || !categoriaSelecionada || produto.categoriaId === categoriaSelecionada;
      const matchPesquisa = termo.length === 0 || produto.nome.toLowerCase().includes(termo);
      return matchCategoria && matchPesquisa;
    });
  }, [catalogoProdutos, categoriaSelecionada, pesquisa]);

  const salvarSnapshotComandaAtual = () => {
    if (!comandaAtivaId) {
      return;
    }

    setComandasAbertas((prev) => ({
      ...prev,
      [comandaAtivaId]: {
        itens,
        dataAbertura: dataAberturaAtual ?? prev[comandaAtivaId]?.dataAbertura ?? new Date()
      }
    }));
  };

  const abrirComanda = async () => {
    const nextId = comandaNumber.trim();
    if (!nextId) {
      setErro('Informe o numero da comanda e pressione Enter para abrir.');
      return false;
    }

    if (comandaAtivaId === nextId) {
      setErro(null);
      return true;
    }

    const comandaAnterior = comandaAtivaId && comandaAtivaId !== nextId ? comandaAtivaId : null;
    let openedOffline = false;

    try {
      await requestOpenComanda(nextId);
      setIsOfflineMode(false);
      if (lockContext) {
        await acquireLock(nextId);

        if (comandaAnterior) {
          await releaseLock(comandaAnterior);
        }
      }
    } catch (backendError) {
      if (isConnectivityError(backendError)) {
        openedOffline = true;
        setLockData(null);
        setIsOfflineMode(true);
      } else {
        const typedError = backendError as BackendError;
        if (typedError.status === 409) {
          setErro(formatLockConflictMessage(typedError));
          return false;
        }

        openedOffline = true;
        setLockData(null);
        setIsOfflineMode(true);
      }
    }

    const snapshotAtual = comandaAtivaId
      ? {
          itens,
          dataAbertura: dataAberturaAtual ?? comandasAbertas[comandaAtivaId]?.dataAbertura ?? new Date()
        }
      : null;

    const snapshotDestino = comandasAbertas[nextId];

    setComandasAbertas((prev) => {
      if (!comandaAtivaId) {
        return prev;
      }

      return {
        ...prev,
        [comandaAtivaId]: snapshotAtual ?? prev[comandaAtivaId]
      };
    });

    if (snapshotDestino) {
      setItens(snapshotDestino.itens);
      setDataAberturaAtual(snapshotDestino.dataAbertura);
    } else {
      setItens([]);
      setDataAberturaAtual(new Date());
      setComandasAbertas((prev) => ({
        ...prev,
        [nextId]: {
          itens: [],
          dataAbertura: new Date()
        }
      }));

      if (porQuiloCategoryId) {
        setCategoriaSelecionada(porQuiloCategoryId);
      }
    }

    setComandaAtivaId(nextId);
    setErro(openedOffline ? 'Backend indisponivel. Comanda aberta em modo local.' : null);

    return true;
  };

  const adicionarProduto = (produto: ProdutoCatalogo) => {
    if (!isComandaAberta) {
      setErro('Abra a comanda (Enter no numero) antes de adicionar itens.');
      return;
    }

    let pesoLido = Number(pesoAtual.toFixed(3));
    if (!produto.porUnidade && isSelServiceProduct(produto.nome) && pesoSensor > 0) {
      pesoLido = Number(pesoSensor.toFixed(3));
    }

    const quantidade = produto.porUnidade ? 1 : pesoLido;
    if (!produto.porUnidade && quantidade <= 0) {
      setErro('Aguardando peso do sensor ou informe peso manual.');
      return;
    }

    const subtotalItem = Number((produto.precoUnitario * quantidade).toFixed(2));
    const novoItem: ItemComanda = {
      id: crypto.randomUUID(),
      nome: produto.nome,
      precoUnitario: produto.precoUnitario,
      quantidade,
      peso: produto.porUnidade ? undefined : quantidade,
      categoriaId: produto.categoriaId,
      subtotal: subtotalItem,
      porUnidade: produto.porUnidade
    };

    setItens((prev) => [novoItem, ...prev]);
    setPesquisa('');
    setErro(null);
    setPrecoAtual(produto.precoUnitario);

    if (!produto.porUnidade && pesoManual !== null) {
      setPesoManual(null);
    }
  };

  const removerItem = (id: string) => {
    setItens((prev) => prev.filter((item) => item.id !== id));
  };

  const ajustarQuantidade = (id: string, delta: number) => {
    setItens((prev) =>
      prev
        .map((item) => {
          if (item.id !== id) {
            return item;
          }

          const proximaQuantidade = item.porUnidade
            ? item.quantidade + delta
            : Number((item.quantidade + delta * 0.1).toFixed(3));

          if (proximaQuantidade <= 0) {
            return null;
          }

          return {
            ...item,
            quantidade: proximaQuantidade,
            peso: item.porUnidade ? undefined : proximaQuantidade,
            subtotal: Number((item.precoUnitario * proximaQuantidade).toFixed(2))
          };
        })
        .filter((item): item is ItemComanda => item !== null)
    );
  };

  const finalizeComanda = () => {
    const activeNumero = comandaAtivaId;

    salvarSnapshotComandaAtual();

    if (comandaAtivaId) {
      setComandasAbertas((prev) => ({
        ...prev,
        [comandaAtivaId]: {
          itens,
          dataAbertura: dataAberturaAtual ?? prev[comandaAtivaId]?.dataAbertura ?? new Date()
        }
      }));
    }

    setComandaNumber('');
    setComandaAtivaId(null);
    setDataAberturaAtual(null);
    setItens([]);
    setPesquisa('');
    setErro(null);
    setPesoManual(null);
    setIsOfflineMode(false);
    setCampoAtivo('COMANDA');
    toggleToNumerico();

    if (activeNumero) {
      void releaseLock(activeNumero).catch((backendError: BackendError) => {
        setErro(backendError.message || 'Falha ao liberar lock da comanda encerrada.');
      });
    }
  };

  const focarComanda = () => {
    setCampoAtivo('COMANDA');
    toggleToNumerico();
  };

  const focarPesquisa = () => {
    void (async () => {
      if (isComandaAberta && comandaAtivaId === comandaNumber.trim()) {
        setCampoAtivo('PESQUISA');
        toggleToVirtual();
        return;
      }

      const opened = await abrirComanda();
      if (!opened) {
        return;
      }

      setCampoAtivo('PESQUISA');
      toggleToVirtual();
    })();
  };

  const selecionarCategoria = (nextCategoryId: string) => {
    if (nextCategoryId === porQuiloCategoryId && !isComandaAberta) {
      setErro('A categoria Por quilo so pode ser usada com a comanda aberta.');
      return;
    }

    setCategoriaSelecionada(nextCategoryId);
    setErro(null);
  };

  const handleKeyPress = (key: string) => {
    if (key === 'Clear') {
      if (campoAtivo === 'COMANDA') {
        setComandaNumber('');
      } else {
        setPesquisa('');
      }
      return;
    }

    if (key === 'Backspace') {
      if (campoAtivo === 'COMANDA') {
        setComandaNumber((current) => current.slice(0, -1));
      } else {
        setPesquisa((current) => current.slice(0, -1));
      }
      return;
    }

    if (key === 'Enter') {
      if (campoAtivo === 'COMANDA') {
        focarPesquisa();
        return;
      }

      const primeiroProduto = produtosFiltrados[0];
      if (primeiroProduto) {
        adicionarProduto(primeiroProduto);
      }
      return;
    }

    if (campoAtivo === 'COMANDA') {
      if (!/^[0-9.]$/.test(key)) {
        return;
      }

      if (key === '.' && comandaNumber.includes('.')) {
        return;
      }

      setComandaNumber((current) => `${current}${key}`);
      return;
    }

    setPesquisa((current) => `${current}${key}`);
  };

  const state: EstadoComanda = {
    comandaAtual: comandaAtivaId
      ? {
          id: comandaAtivaId,
          numeroMesa: Number(comandaAtivaId) || 0,
          itens,
          total,
          status: 'aberta',
          dataAbertura: dataAberturaAtual ?? new Date()
        }
      : null,
    comandaNumber,
    isOfflineMode,
    lockOwner: lockData?.owner ?? null,
    lockStationId: lockData?.stationId ?? null,
    lockExpiresAt: lockData?.expiresAt ?? null,
    campoAtivo,
    categorias,
    categoriaSelecionada,
    itens,
    subtotal,
    impostos,
    total,
    pesoAtual,
    pesoManual,
    precoAtual,
    pesquisa,
    tecladoAtivo,
    isComandaConectada,
    erro,
    canFinalize: isComandaAberta
  };

  const actions = {
    setComandaNumber,
    setPesquisa,
    setPesoManual,
    focarComanda,
    focarPesquisa,
    selecionarCategoria,
    selecionarProduto: adicionarProduto,
    removerItem,
    ajustarQuantidade,
    finalizeComanda,
    handleKeyPress,
    toggleToNumerico,
    toggleToVirtual
  };

  return {
    state,
    actions,
    produtosFiltrados
  };
}
