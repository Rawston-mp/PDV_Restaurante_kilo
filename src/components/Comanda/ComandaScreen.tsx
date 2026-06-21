import { useEffect, useState, useRef } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';

import { CategoryGrid } from '@/components/Comanda/CategoryGrid';
import { ComandaHeader, type ComandaStatusTone } from '@/components/Comanda/ComandaHeader';
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

const formatCurrency = (value: number) =>
  value.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });

export function ComandaScreen() {
  const { state, actions, produtosFiltrados } = useComanda();
  const comandaInputRef = useRef<HTMLInputElement | null>(null);
  const pesquisaInputRef = useRef<HTMLInputElement | null>(null);
  const [isPesoManualEditing, setIsPesoManualEditing] = useState(false);
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(true);
  const [isWorkspaceExpanded, setIsWorkspaceExpanded] = useState(false);
  const [pesoManualDraft, setPesoManualDraft] = useState('');
  const [pesoManualError, setPesoManualError] = useState<string | null>(null);
  const pesquisaSanitizada = state.pesquisa.trim();
  const isComandaOpen = Boolean(state.comandaAtual?.id);
  const statusTone: ComandaStatusTone = !isComandaOpen
    ? 'neutral'
    : state.isSyncing
      ? 'syncing'
      : state.isOfflineMode
        ? 'warning'
        : state.isComandaConectada
          ? 'success'
          : 'danger';
  const stationLabel = state.lockStationId?.replace('_', ' ');
  const statusOperacional = !isComandaOpen
    ? 'Aguardando comanda'
    : state.isSyncing
      ? 'Sincronizando'
      : state.isOfflineMode
        ? 'Modo local'
        : state.isComandaConectada
          ? `Balança conectada${stationLabel ? ` · ${stationLabel}` : ''}`
          : 'Sensor desconectado';
  const deveBloquearResultados = pesquisaSanitizada.length > 0 && pesquisaSanitizada.length < 3;
  const categoriaDesabilitadaSemComanda = !isComandaOpen
    ? state.categorias.map((categoria) => categoria.id)
    : [];

  useEffect(() => {
    if (state.campoAtivo === 'COMANDA') {
      comandaInputRef.current?.focus();
      return;
    }

    pesquisaInputRef.current?.focus();
  }, [state.campoAtivo]);

  useEffect(() => {
    setIsKeyboardVisible(true);
  }, [state.campoAtivo]);

  useEffect(() => {
    if (!isWorkspaceExpanded) {
      return;
    }

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsWorkspaceExpanded(false);
      }
    };

    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [isWorkspaceExpanded]);

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
      setPesoManualError('Peso inválido. Use um valor maior que zero.');
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
            title={isComandaOpen ? `Comanda #${state.comandaAtual?.id} aberta` : 'Abra uma comanda'}
            subtitle={isComandaOpen
              ? 'Adicione itens ou libere a balança para o próximo atendimento.'
              : 'Digite ou leia o número da comanda para iniciar.'}
            tone={statusTone}
            pendingSyncCount={state.pendingSyncCount}
            onRetry={state.isOfflineMode ? () => void actions.retrySync() : undefined}
          />
          <div className="comanda-top-fields">
            <div className="comanda-field-group">
              <label htmlFor="comanda-number-input">Número da comanda</label>
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
              <small>Pressione Enter ou use o botao Abrir comanda.</small>
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
                disabled={!isComandaOpen}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    actions.handleKeyPress('Enter');
                  }
                }}
                placeholder={isComandaOpen ? 'Digite para filtrar produtos' : 'Abra uma comanda para pesquisar'}
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
                isConnected={state.isComandaConectada}
                isComandaOpen={isComandaOpen}
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

            <div className={`comanda-workspace${isWorkspaceExpanded ? ' is-expanded' : ''}`}>
              <CategoryGrid
                categories={state.categorias}
                activeId={state.categoriaSelecionada}
                onSelect={actions.selecionarCategoria}
                disabledIds={categoriaDesabilitadaSemComanda}
                expanded={isWorkspaceExpanded}
                onToggleExpand={() => setIsWorkspaceExpanded((current) => !current)}
              />

              <section className="comanda-panel comanda-suggestions-panel">
                <div className="comanda-products-heading">
                  <p className="panel-label">
                    {!isComandaOpen
                      ? 'Produtos'
                      : pesquisaSanitizada.length >= 3
                        ? 'Resultados da pesquisa'
                        : 'Produtos da categoria'}
                  </p>
                  {isComandaOpen && !deveBloquearResultados && (
                    <span>{produtosFiltrados.length} {produtosFiltrados.length === 1 ? 'produto' : 'produtos'}</span>
                  )}
                </div>
                <div className="comanda-suggestions">
                  {!isComandaOpen && (
                    <p className="comanda-suggestions-empty">
                      Abra uma comanda para consultar e adicionar produtos.
                    </p>
                  )}
                  {isComandaOpen && deveBloquearResultados && (
                    <p className="comanda-suggestions-empty">
                      Digite ao menos 3 letras para listar os produtos.
                    </p>
                  )}
                  {isComandaOpen && !deveBloquearResultados && pesquisaSanitizada.length >= 3 && produtosFiltrados.length === 0 && (
                    <p className="comanda-suggestions-empty">
                      Nenhum produto encontrado para "{pesquisaSanitizada}".
                    </p>
                  )}
                  {isComandaOpen && produtosFiltrados.map((produto) => (
                    <button
                      key={produto.id}
                      type="button"
                      className="comanda-product-row"
                      onClick={() => actions.selecionarProduto(produto)}
                      aria-label={`Adicionar ${produto.nome}`}
                    >
                      <span className="comanda-product-description">
                        <strong>{produto.nome}</strong>
                        <small>
                          {produto.porUnidade ? '1 un' : 'Venda por peso'}
                          <span aria-hidden="true"> · </span>
                          {formatCurrency(produto.precoUnitario)} / {produto.porUnidade ? 'un' : 'kg'}
                        </small>
                      </span>
                      <strong className="comanda-product-price">
                        {formatCurrency(produto.precoUnitario)}
                      </strong>
                    </button>
                  ))}
                </div>
              </section>

              <ItemsList
                items={state.itens}
                onDelete={actions.removerItem}
                onAdjust={actions.ajustarQuantidade}
                canDelete={state.canDeleteItems}
              />
            </div>
            <TotalDisplay subtotal={state.subtotal} impostos={state.impostos} total={state.total} />

            {state.feedback && <p className="comanda-feedback" role="status">{state.feedback}</p>}
            {state.erro && <p className="comanda-error">{state.erro}</p>}
          </section>

          <section className="comanda-right-column">
            <div className="comanda-keyboard-toolbar">
              <KeyboardToggle
                active={state.tecladoAtivo}
                onNumerico={actions.focarComanda}
                onVirtual={actions.focarPesquisa}
              />
              <button
                type="button"
                className="comanda-keyboard-collapse"
                onClick={() => setIsKeyboardVisible((current) => !current)}
                aria-label={isKeyboardVisible ? 'Ocultar teclado' : 'Mostrar teclado'}
                title={isKeyboardVisible ? 'Ocultar teclado' : 'Mostrar teclado'}
              >
                {isKeyboardVisible ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
              </button>
            </div>

            {isKeyboardVisible && (
              state.tecladoAtivo === 'NUMERICO' ? (
                <NumericKeypad onKeyPress={handleComandaKeyPress} />
              ) : (
                <VirtualKeyboard onKeyPress={actions.handleKeyPress} />
              )
            )}

            <NextComandaButton
              onClick={isComandaOpen ? actions.finalizeComanda : actions.focarPesquisa}
              disabled={isComandaOpen ? !state.canFinalize : !state.canOpen}
              label={isComandaOpen ? 'LIBERAR BALANÇA' : 'ABRIR COMANDA'}
              helperText={isComandaOpen
                ? 'A comanda permanece aberta para novos consumos e para o caixa.'
                : 'Informe o número acima para iniciar o atendimento.'}
            />
          </section>
        </div>
      </div>
    </div>
  );
}
