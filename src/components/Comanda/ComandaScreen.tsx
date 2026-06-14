import { useEffect, useState, useRef } from 'react';

import { CategoryGrid } from '@/components/Comanda/CategoryGrid';
import { ComandaHeader } from '@/components/Comanda/ComandaHeader';
import { ItemsList } from '@/components/Comanda/ItemsList';
import { KeyboardToggle } from '@/components/Comanda/KeyboardToggle';
import { NextComandaButton } from '@/components/Comanda/NextComandaButton';
import { NumericKeypad } from '@/components/Comanda/NumericKeypad';
import { PriceDisplay } from '@/components/Comanda/PriceDisplay';
import { TotalDisplay } from '@/components/Comanda/TotalDisplay';
import { VirtualKeyboard } from '@/components/Comanda/VirtualKeyboard';
import { WeightDisplay } from '@/components/Comanda/WeightDisplay';
import { useComanda } from '@/hooks/comanda/useComanda';

const normalizeSearchText = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[^\x00-\x7F]/g, '')
    .toLowerCase();

const isSelServiceName = (value: string) => {
  const normalized = normalizeSearchText(value);
  return normalized.includes('sel-service') || normalized.includes('self-service') || normalized.includes('self service');
};

const isPorQuiloCategoryName = (value: string) => {
  const normalized = normalizeSearchText(value).replace(/\s+/g, ' ').trim();
  return normalized === 'por quilo' || normalized === 'por kilo';
};

export function ComandaScreen() {
  const { state, actions, produtosFiltrados } = useComanda();
  const comandaInputRef = useRef<HTMLInputElement | null>(null);
  const pesquisaInputRef = useRef<HTMLInputElement | null>(null);
  const [isPesoManualEditing, setIsPesoManualEditing] = useState(false);
  const [pesoManualDraft, setPesoManualDraft] = useState('');
  const [pesoManualError, setPesoManualError] = useState<string | null>(null);
  const pesquisaSanitizada = state.pesquisa.trim();
  const statusOperacional = state.lockStationId
    ? `${state.isComandaConectada ? 'Conectada' : 'Sem conexao'} | lock ${state.lockStationId}`
    : state.isComandaConectada
      ? 'Conectada'
      : 'Sem conexao';
  const deveBloquearResultados = pesquisaSanitizada.length > 0 && pesquisaSanitizada.length < 3;
  const porQuiloCategoryId = state.categorias.find((categoria) => isPorQuiloCategoryName(categoria.nome))?.id;
  const categoriaDesabilitadaSemComanda = !state.comandaAtual?.id && porQuiloCategoryId ? [porQuiloCategoryId] : [];

  useEffect(() => {
    if (state.campoAtivo === 'COMANDA') {
      comandaInputRef.current?.focus();
      return;
    }

    pesquisaInputRef.current?.focus();
  }, [state.campoAtivo]);

  const iniciarEdicaoPesoManual = () => {
    setPesoManualDraft((state.pesoManual ?? state.pesoAtual).toFixed(3));
    setPesoManualError(null);
    setIsPesoManualEditing(true);
    actions.toggleToNumerico();
  };

  const cancelarEdicaoPesoManual = () => {
    setIsPesoManualEditing(false);
    setPesoManualError(null);
  };

  const limparPesoManual = () => {
    setIsPesoManualEditing(false);
    setPesoManualError(null);
    setPesoManualDraft('');
    actions.setPesoManual(null);
  };

  const selecionarProdutoParaLancamento = () => {
    if (produtosFiltrados.length === 0) {
      return null;
    }

    return produtosFiltrados.find((produto) => isSelServiceName(produto.nome)) ?? produtosFiltrados[0];
  };

  const aplicarPesoManual = (inserirNaComanda = false) => {
    const sanitized = pesoManualDraft.trim().replace(',', '.');
    const nextPeso = Number(sanitized);

    if (!Number.isFinite(nextPeso) || nextPeso <= 0) {
      setPesoManualError('Peso invalido. Use valor maior que zero.');
      return;
    }

    const roundedPeso = Number(nextPeso.toFixed(3));
    actions.setPesoManual(roundedPeso);
    setPesoManualDraft(roundedPeso.toFixed(3));
    setPesoManualError(null);
    setIsPesoManualEditing(false);

    if (!inserirNaComanda) {
      return;
    }

    const produtoAlvo = selecionarProdutoParaLancamento();
    if (produtoAlvo) {
      actions.selecionarProduto(produtoAlvo);
    }
  };

  const handleNumpadPesoManual = (key: string) => {
    if (key === 'Clear') {
      setPesoManualDraft('');
      setPesoManualError(null);
      return;
    }

    if (key === 'Backspace') {
      setPesoManualDraft((current) => current.slice(0, -1));
      setPesoManualError(null);
      return;
    }

    if (key === 'Enter') {
      aplicarPesoManual(true);
      return;
    }

    if (!/^[0-9.]$/.test(key)) {
      return;
    }

    if (key === '.' && pesoManualDraft.includes('.')) {
      return;
    }

    setPesoManualDraft((current) => `${current}${key}`);
    setPesoManualError(null);
  };

  const handleComandaKeyPress = (key: string) => {
    if (isPesoManualEditing) {
      handleNumpadPesoManual(key);
      return;
    }

    actions.handleKeyPress(key);
  };

  return (
    <div className="comanda-screen">
      <div className="comanda-container">
        <div className="comanda-header-wrap">
          <ComandaHeader
            status={statusOperacional}
            title="TELA DE COMANDA"
            isOfflineMode={state.isOfflineMode}
          />
          <div className="comanda-top-fields">
            <div className="comanda-field-group">
              <label htmlFor="comanda-number-input">Numero da comanda</label>
              <input
                id="comanda-number-input"
                ref={comandaInputRef}
                type="text"
                value={state.comandaNumber}
                onFocus={actions.focarComanda}
                onChange={(event) => actions.setComandaNumber(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    actions.focarPesquisa();
                  }
                }}
                placeholder="Ex.: 125"
                className="comanda-number-input"
              />
            </div>
            <div className="comanda-field-group">
              <label htmlFor="comanda-search-input">Pesquisa de item</label>
              <input
                id="comanda-search-input"
                ref={pesquisaInputRef}
                type="text"
                value={state.pesquisa}
                onFocus={actions.focarPesquisa}
                onChange={(event) => actions.setPesquisa(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    actions.handleKeyPress('Enter');
                  }
                }}
                placeholder="Digite para filtrar produtos"
                className="comanda-search-input"
              />
            </div>
          </div>
        </div>

        <div className="comanda-layout-grid">
          <section className="comanda-left-column">
            <div className="comanda-display-grid">
              <WeightDisplay
                value={state.pesoAtual}
                manualValue={state.pesoManual}
                isEditing={isPesoManualEditing}
                draftValue={pesoManualDraft}
                error={pesoManualError}
                onStartEdit={iniciarEdicaoPesoManual}
                onDraftChange={(next) => {
                  setPesoManualDraft(next);
                  setPesoManualError(null);
                }}
                onApply={aplicarPesoManual}
                onConfirmEnter={() => aplicarPesoManual(true)}
                onCancel={cancelarEdicaoPesoManual}
                onClearManual={limparPesoManual}
              />
              <PriceDisplay value={state.precoAtual} />
            </div>

            <CategoryGrid
              categories={state.categorias}
              activeId={state.categoriaSelecionada}
              onSelect={actions.selecionarCategoria}
              disabledIds={categoriaDesabilitadaSemComanda}
            />

            <section className="comanda-panel comanda-suggestions-panel">
              <p className="panel-label">Resultados da pesquisa</p>
              <div className="comanda-suggestions">
                {deveBloquearResultados && (
                  <p className="comanda-suggestions-empty">
                    Digite ao menos 3 letras para listar os produtos.
                  </p>
                )}
                {!deveBloquearResultados && pesquisaSanitizada.length >= 3 && produtosFiltrados.length === 0 && (
                  <p className="comanda-suggestions-empty">
                    Nenhum produto encontrado para "{pesquisaSanitizada}".
                  </p>
                )}
                {produtosFiltrados.map((produto) => (
                  <button key={produto.id} type="button" onClick={() => actions.selecionarProduto(produto)}>
                    <strong>{produto.nome}</strong>
                    <small>R$ {produto.precoUnitario.toFixed(2)} / {produto.porUnidade ? 'un' : 'kg'}</small>
                  </button>
                ))}
              </div>
            </section>

            <ItemsList items={state.itens} onDelete={actions.removerItem} onAdjust={actions.ajustarQuantidade} />
            <TotalDisplay subtotal={state.subtotal} impostos={state.impostos} total={state.total} />

            {state.erro && <p className="comanda-error">{state.erro}</p>}
          </section>

          <section className="comanda-right-column">
            <KeyboardToggle
              active={state.tecladoAtivo}
              onNumerico={actions.focarComanda}
              onVirtual={actions.focarPesquisa}
            />

            {state.tecladoAtivo === 'NUMERICO' ? (
              <NumericKeypad onKeyPress={handleComandaKeyPress} />
            ) : (
              <VirtualKeyboard onKeyPress={actions.handleKeyPress} />
            )}

            <NextComandaButton onClick={actions.finalizeComanda} disabled={!state.canFinalize} />
          </section>
        </div>
      </div>
    </div>
  );
}
