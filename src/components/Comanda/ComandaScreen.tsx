import { useEffect, useRef } from 'react';

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

export function ComandaScreen() {
  const { state, actions, produtosFiltrados } = useComanda();
  const comandaInputRef = useRef<HTMLInputElement | null>(null);
  const pesquisaInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (state.campoAtivo === 'COMANDA') {
      comandaInputRef.current?.focus();
      return;
    }

    pesquisaInputRef.current?.focus();
  }, [state.campoAtivo]);

  return (
    <div className="comanda-screen">
      <div className="comanda-container">
        <div className="comanda-header-wrap">
          <ComandaHeader
            status={state.isBalancaConectada ? 'Conectada' : 'Sem conexao'}
            title="BALANCA - TELA DE COMANDA"
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
                placeholder="Digite para filtrar produtos"
                className="comanda-search-input"
              />
            </div>
          </div>
        </div>

        <div className="comanda-layout-grid">
          <section className="comanda-left-column">
            <div className="comanda-display-grid">
              <WeightDisplay value={state.pesoAtual} />
              <PriceDisplay value={state.precoAtual} />
            </div>

            <CategoryGrid
              categories={state.categorias}
              activeId={state.categoriaSelecionada}
              onSelect={actions.selecionarCategoria}
            />

            <section className="comanda-panel comanda-suggestions-panel">
              <p className="panel-label">Resultados da pesquisa</p>
              <div className="comanda-suggestions">
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
              <NumericKeypad onKeyPress={actions.handleKeyPress} />
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
