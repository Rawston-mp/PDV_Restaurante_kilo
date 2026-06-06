import { useEffect, useMemo, useState } from 'react';

import type { Categoria, EstadoComanda, ItemComanda } from '@/types/comanda';
import { useKeyboard } from '@/hooks/comanda/useKeyboard';
import { useWeight } from '@/hooks/comanda/useWeight';
import {
  buildComandaCategories,
  mergeCategoryOptions,
  readStoredProductCategories
} from '@/modules/products/domain/services/productCategories';
import { productsContainer } from '@/modules/products/infrastructure/container/productsContainer';

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
  const [comandaNumber, setComandaNumber] = useState('');
  const [comandaAtivaId, setComandaAtivaId] = useState<string | null>(null);
  const [dataAberturaAtual, setDataAberturaAtual] = useState<Date | null>(null);
  const [comandasAbertas, setComandasAbertas] = useState<Record<string, ComandaSnapshot>>({});
  const [campoAtivo, setCampoAtivo] = useState<'COMANDA' | 'PESQUISA'>('COMANDA');
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [categoriaSelecionada, setCategoriaSelecionada] = useState('');
  const [catalogoProdutos, setCatalogoProdutos] = useState<ProdutoCatalogo[]>([]);
  const [pesquisa, setPesquisa] = useState('');
  const [itens, setItens] = useState<ItemComanda[]>([]);
  const [erro, setErro] = useState<string | null>(null);
  const [precoAtual, setPrecoAtual] = useState(0);

  const { tecladoAtivo, toggleToNumerico, toggleToVirtual } = useKeyboard('NUMERICO');
  const { pesoSensor, pesoAtual, pesoManual, setPesoManual, isComandaConectada } = useWeight();

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

  const abrirComanda = () => {
    const nextId = comandaNumber.trim();
    if (!nextId) {
      setErro('Informe o numero da comanda e pressione Enter para abrir.');
      return false;
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
    setErro(null);

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
    setCampoAtivo('COMANDA');
    toggleToNumerico();
  };

  const focarComanda = () => {
    setCampoAtivo('COMANDA');
    toggleToNumerico();
  };

  const focarPesquisa = () => {
    if (!abrirComanda()) {
      return;
    }

    setCampoAtivo('PESQUISA');
    toggleToVirtual();
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
