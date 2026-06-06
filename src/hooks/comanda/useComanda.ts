import { useMemo, useState } from 'react';

import type { Categoria, EstadoComanda, ItemComanda } from '@/types/comanda';
import { useKeyboard } from '@/hooks/comanda/useKeyboard';
import { useWeight } from '@/hooks/comanda/useWeight';

type ProdutoCatalogo = {
  id: string;
  nome: string;
  precoUnitario: number;
  categoriaId: string;
  porUnidade: boolean;
};

const categoriasPadrao: Categoria[] = [
  { id: 'saladas', nome: 'Saladas', cor: '#10b981' },
  { id: 'quentes', nome: 'Quentes', cor: '#f59e0b' },
  { id: 'sobremesas', nome: 'Sobremesas', cor: '#a78bfa' },
  { id: 'bebidas', nome: 'Bebidas', cor: '#38bdf8' }
];

const catalogoProdutos: ProdutoCatalogo[] = [
  { id: 'p1', nome: 'Buffet kilo', precoUnitario: 74.9, categoriaId: 'quentes', porUnidade: false },
  { id: 'p2', nome: 'Sobremesa da casa', precoUnitario: 64.9, categoriaId: 'sobremesas', porUnidade: false },
  { id: 'p3', nome: 'Refrigerante lata 350ml', precoUnitario: 7.5, categoriaId: 'bebidas', porUnidade: true },
  { id: 'p4', nome: 'Agua sem gas 500ml', precoUnitario: 4.5, categoriaId: 'bebidas', porUnidade: true }
];

export function useComanda(taxaImposto = 0.1) {
  const [comandaNumber, setComandaNumber] = useState('');
  const [campoAtivo, setCampoAtivo] = useState<'COMANDA' | 'PESQUISA'>('COMANDA');
  const [categoriaSelecionada, setCategoriaSelecionada] = useState(categoriasPadrao[0].id);
  const [pesquisa, setPesquisa] = useState('');
  const [itens, setItens] = useState<ItemComanda[]>([]);
  const [erro, setErro] = useState<string | null>(null);
  const [precoAtual, setPrecoAtual] = useState(catalogoProdutos[0].precoUnitario);

  const { tecladoAtivo, toggleToNumerico, toggleToVirtual } = useKeyboard('NUMERICO');
  const { pesoAtual, pesoManual, setPesoManual, isComandaConectada } = useWeight();

  const subtotal = useMemo(() => itens.reduce((acc, item) => acc + item.subtotal, 0), [itens]);
  const impostos = useMemo(() => Number((subtotal * taxaImposto).toFixed(2)), [subtotal, taxaImposto]);
  const total = useMemo(() => Number((subtotal + impostos).toFixed(2)), [subtotal, impostos]);

  const produtosFiltrados = useMemo(() => {
    const termo = pesquisa.trim().toLowerCase();
    return catalogoProdutos.filter((produto) => {
      const matchCategoria = produto.categoriaId === categoriaSelecionada;
      const matchPesquisa = termo.length === 0 || produto.nome.toLowerCase().includes(termo);
      return matchCategoria && matchPesquisa;
    });
  }, [categoriaSelecionada, pesquisa]);

  const adicionarProduto = (produto: ProdutoCatalogo) => {
    if (!comandaNumber.trim()) {
      setErro('Informe o numero da comanda para adicionar itens.');
      return;
    }

    const quantidade = produto.porUnidade ? 1 : Number(pesoAtual.toFixed(3));
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
    setComandaNumber('');
    setItens([]);
    setPesquisa('');
    setErro(null);
    setCampoAtivo('COMANDA');
    toggleToNumerico();
  };

  const focarComanda = () => {
    setCampoAtivo('COMANDA');
    toggleToNumerico();
  };

  const focarPesquisa = () => {
    setCampoAtivo('PESQUISA');
    toggleToVirtual();
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
    comandaAtual: comandaNumber
      ? {
          id: comandaNumber,
          numeroMesa: Number(comandaNumber) || 0,
          itens,
          total,
          status: 'aberta',
          dataAbertura: new Date()
        }
      : null,
    comandaNumber,
    campoAtivo,
    categorias: categoriasPadrao,
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
    canFinalize: itens.length > 0
  };

  const actions = {
    setComandaNumber,
    setPesquisa,
    setPesoManual,
    focarComanda,
    focarPesquisa,
    selecionarCategoria: setCategoriaSelecionada,
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
