import { useState, type FormEvent } from 'react';

import { productsContainer } from '@/modules/products/infrastructure/container/productsContainer';
import { useCreateProduct } from '@/modules/products/presentation/hooks/useCreateProduct';
import { useProductsQuery } from '@/modules/products/presentation/hooks/useProductsQuery';

const cfopOptions = ['5102 - VENDA', '5405 - VENDA COM ST', '5101 - VENDAS - BC REDUZIDA'];

const fiscalTypeOptions = [
  'Sem substituicao tributaria',
  'Produzida internamente',
  'Com substituicao tributaria'
];

const cstIcmsOptions = [
  '0 - Nacional (exceto as indicadas nos codigos 3, 4, 5 e 8)',
  '1 - Estrangeira - Importacao direta',
  '2 - Estrangeira - Adquirida no mercado interno',
  '3 - Nacional, conteudo superior a 40% e inferior ou igual a 70%',
  '4 - Nacional, processos produtivos basicos',
  '5 - Nacional, conteudo inferior a 40%',
  '6 - Estrangeira - Importacao direta, com similar nacional, lista CAMEX',
  '7 - Estrangeira - mercado interno, sem similar, lista CAMEX',
  '8 - Nacional, Conteudo de importacao superior a 70%'
];

const cstPisCofinsOptions = [
  '01',
  '02',
  '03',
  '04',
  '05',
  '06',
  '07',
  '08',
  '09',
  '49',
  '50',
  '51',
  '52',
  '53'
];

const groupOptions = ['Por kilo', 'Bebidas', 'A la Carte'];

const groupVisuals: Record<string, { label: string; icon: string; className: string }> = {
  'Por kilo': { label: 'Por kilo', icon: '⚖', className: 'is-por-kilo' },
  Bebidas: { label: 'Bebidas', icon: '🥤', className: 'is-bebidas' },
  'A la Carte': { label: 'A la Carte', icon: '🍽', className: 'is-ala-carte' }
};

const parseLegacyProductCode = (productName: string) => {
  const [firstChunk] = productName.split(' - ');
  return /^\d{2,4}$/.test(firstChunk) ? firstChunk : null;
};

const getUsedProductCodes = (products: Array<{ productCode?: string; name: string }>) => {
  const usedCodes = new Set<string>();

  for (const product of products) {
    const code = product.productCode ?? parseLegacyProductCode(product.name);
    if (code) {
      usedCodes.add(code);
    }
  }

  return usedCodes;
};

const getProductDisplayName = (product: { productCode?: string; name: string }) => {
  const legacyCode = parseLegacyProductCode(product.name);
  if (legacyCode) {
    return product.name.split(' - ').slice(1).join(' - ');
  }

  return product.name;
};

const generateRandomProductCode = (usedCodes: Set<string>) => {
  for (let attempts = 0; attempts < 300; attempts += 1) {
    const candidate = String(Math.floor(Math.random() * 99) + 1).padStart(2, '0');
    if (!usedCodes.has(candidate)) {
      return candidate;
    }
  }

  // Fallback para manter unicidade mesmo com alta ocupacao de codigos curtos.
  for (let fallback = 100; fallback <= 9999; fallback += 1) {
    const candidate = String(fallback);
    if (!usedCodes.has(candidate)) {
      return candidate;
    }
  }

  return String(Date.now()).slice(-4);
};

const calculateSalePrice = (costValue: number, marginPercent: number) => {
  const base = Number.isFinite(costValue) ? costValue : 0;
  const margin = Number.isFinite(marginPercent) ? marginPercent : 0;
  return Number((base * (1 + margin / 100)).toFixed(2));
};

export function ProductsPage() {
  const { products, setProducts, reload } = useProductsQuery();
  const { createProduct, saving } = useCreateProduct();

  const [showCadastroSpan, setShowCadastroSpan] = useState(false);
  const [activeTab, setActiveTab] = useState<'PRODUTO' | 'FISCAL'>('PRODUTO');

  const [name, setName] = useState('');
  const [productCode, setProductCode] = useState('');
  const [barcode, setBarcode] = useState('');
  const [category, setCategory] = useState(groupOptions[0]);
  const [ncm, setNcm] = useState('');
  const [costValue, setCostValue] = useState(0);
  const [marginProfit, setMarginProfit] = useState(0);
  const [salePrice, setSalePrice] = useState(0);
  const [stock, setStock] = useState(0);
  const [byWeight, setByWeight] = useState(false);

  const [cfop, setCfop] = useState(cfopOptions[0]);
  const [cstIcms, setCstIcms] = useState(cstIcmsOptions[0]);
  const [aliqIcms, setAliqIcms] = useState('');
  const [cstPis, setCstPis] = useState(cstPisCofinsOptions[0]);
  const [aliqPis, setAliqPis] = useState('');
  const [cstCofins, setCstCofins] = useState(cstPisCofinsOptions[0]);
  const [aliqCofins, setAliqCofins] = useState('');
  const [fiscalType, setFiscalType] = useState(fiscalTypeOptions[0]);

  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const currency = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

  const generateCodeForCurrentCatalog = () => {
    const usedCodes = getUsedProductCodes(products);
    return generateRandomProductCode(usedCodes);
  };

  const onSyncProducts = async () => {
    try {
      const result = await productsContainer.syncProducts.execute();
      await reload();
      setSyncMessage(
        `Sincronizacao de produtos: ${result.mergedCount} itens, ${result.resolvedConflicts} conflitos.`
      );
    } catch (error) {
      await productsContainer.syncTaskQueue.enqueue('SYNC_PRODUCTS');
      setSyncMessage(
        `Falha na sincronizacao. Tarefa enviada para fila: ${
          error instanceof Error ? error.message : 'erro desconhecido'
        }`
      );
    }
  };

  const onProcessSyncQueue = async () => {
    const result = await productsContainer.processSyncQueue.execute();
    await reload();
    const pending = await productsContainer.syncTaskQueue.listAll();

    setSyncMessage(
      `Fila processada: ${result.processed} tarefas, ${result.succeeded} sucesso, ${result.failed} falha. Pendentes: ${pending.length}.`
    );
  };

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();

    const usedCodes = getUsedProductCodes(products);
    const generatedCode = productCode && !usedCodes.has(productCode)
      ? productCode
      : generateRandomProductCode(usedCodes);

    const product = await createProduct({
      productCode: generatedCode,
      name,
      category,
      costValue,
      marginProfit,
      price: salePrice,
      stock,
      byWeight
    });

    setProducts((prev) => [...prev, product]);

    setName('');
    setProductCode(generateRandomProductCode(new Set([...usedCodes, generatedCode])));
    setBarcode('');
    setNcm('');
    setCostValue(0);
    setMarginProfit(0);
    setSalePrice(0);
    setStock(0);
    setByWeight(false);

    setCfop(cfopOptions[0]);
    setCstIcms(cstIcmsOptions[0]);
    setAliqIcms('');
    setCstPis(cstPisCofinsOptions[0]);
    setAliqPis('');
    setCstCofins(cstPisCofinsOptions[0]);
    setAliqCofins('');
    setFiscalType(fiscalTypeOptions[0]);

    setShowCadastroSpan(false);
    setActiveTab('PRODUTO');
  };

  return (
    <section className="products-page">
      <header className="products-header card">
        <div>
          <p className="products-eyebrow">Catalogo e precificacao</p>
          <h2>Produtos</h2>
          <p className="products-subtitle">Cadastre e sincronize itens com foco em operacao rapida de caixa.</p>
        </div>
        <div className="products-kpi">
          <strong>{products.length}</strong>
          <span>itens cadastrados</span>
        </div>
      </header>

      <article className="card products-toolbar">
        <div className="products-toolbar-actions">
          <button
            type="button"
            className="products-new-button"
            onClick={() => {
              if (!showCadastroSpan) {
                setProductCode(generateCodeForCurrentCatalog());
                setActiveTab('PRODUTO');
              }

              setShowCadastroSpan((prev) => !prev);
            }}
          >
            + Novo cadastro
          </button>
          <button type="button" onClick={onSyncProducts}>
            Sincronizar produtos
          </button>
          <button type="button" className="button-muted" onClick={onProcessSyncQueue}>
            Processar fila de sincronizacao
          </button>
        </div>
        {syncMessage && <p className="sync-banner">{syncMessage}</p>}
      </article>

      {showCadastroSpan && (
        <article className="card products-cadastro-span">
          <header className="products-cadastro-header">
            <h3>Produtos &gt; Cadastro</h3>
            <div className="products-cadastro-tabs">
              <button
                type="button"
                className={activeTab === 'PRODUTO' ? 'is-active' : ''}
                onClick={() => setActiveTab('PRODUTO')}
              >
                Produto
              </button>
              <button
                type="button"
                className={activeTab === 'FISCAL' ? 'is-active' : ''}
                onClick={() => setActiveTab('FISCAL')}
              >
                Fiscal
              </button>
            </div>
          </header>

          <form onSubmit={onSubmit} className="products-form">
            {activeTab === 'PRODUTO' ? (
              <>
                <div className="products-row-4">
                  <div className="products-field-compact">
                    <label htmlFor="product-code">ID do produto (automatico)</label>
                    <input
                      id="product-code"
                      placeholder="Gerado automaticamente"
                      value={productCode}
                      readOnly
                    />
                    <small className="products-help-note">Gerado aleatoriamente e sem repeticao no catalogo.</small>
                  </div>
                  <div className="products-field-main">
                    <label htmlFor="name">Nome</label>
                    <input id="name" value={name} onChange={(e) => setName(e.target.value)} required />
                  </div>
                  <div>
                    <label htmlFor="barcode">Codigo de barra</label>
                    <input id="barcode" value={barcode} onChange={(e) => setBarcode(e.target.value)} />
                  </div>
                  <div>
                    <label htmlFor="category">Grupo</label>
                    <select
                      id="category"
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                    >
                      {groupOptions.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="products-row-2">
                  <div className="products-field-compact">
                    <label htmlFor="ncm">NCM</label>
                    <input id="ncm" value={ncm} onChange={(e) => setNcm(e.target.value)} />
                  </div>
                  <div className="products-field-compact">
                    <label htmlFor="stock">Estoque inicial</label>
                    <input
                      id="stock"
                      type="number"
                      min={0}
                      step="1"
                      value={stock}
                      onChange={(e) => setStock(Number(e.target.value))}
                      required
                    />
                  </div>
                </div>

                <div className="products-cost-block">
                  <h4>Custo inicial</h4>
                  <div className="products-row-3">
                    <div className="products-field-compact">
                      <label htmlFor="cost-value">Valor R$</label>
                      <input
                        id="cost-value"
                        type="number"
                        min={0}
                        step="0.01"
                        value={costValue}
                        onChange={(e) => {
                          const nextCost = Number(e.target.value);
                          setCostValue(nextCost);
                          setSalePrice(calculateSalePrice(nextCost, marginProfit));
                        }}
                      />
                    </div>
                    <div className="products-field-compact">
                      <label htmlFor="margin-profit">Margem lucro %</label>
                      <input
                        id="margin-profit"
                        type="number"
                        min={0}
                        step="0.01"
                        value={marginProfit}
                        onChange={(e) => {
                          const nextMargin = Number(e.target.value);
                          setMarginProfit(nextMargin);
                          setSalePrice(calculateSalePrice(costValue, nextMargin));
                        }}
                      />
                    </div>
                    <div className="products-field-compact">
                      <label htmlFor="sale-price">Preco venda</label>
                      <input
                        id="sale-price"
                        type="number"
                        min={0}
                        step="0.01"
                        value={salePrice}
                        onChange={(e) => setSalePrice(Number(e.target.value))}
                        required
                      />
                    </div>
                  </div>
                </div>

                <div className="products-row-2">
                  <div>
                    <small className="products-help-note">
                      Preco de venda pode ser calculado automaticamente por valor + margem, ou ajustado manualmente.
                    </small>
                  </div>
                </div>

                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={byWeight}
                    onChange={(e) => setByWeight(e.target.checked)}
                  />
                  Produto por peso
                </label>
              </>
            ) : (
              <>
                <div className="products-row-3">
                  <div>
                    <label htmlFor="cfop">CFOP</label>
                    <select id="cfop" value={cfop} onChange={(e) => setCfop(e.target.value)}>
                      {cfopOptions.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label htmlFor="cst-icms">CST ICMS</label>
                    <select id="cst-icms" value={cstIcms} onChange={(e) => setCstIcms(e.target.value)}>
                      {cstIcmsOptions.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                    <small className="products-help-note">Dica: use o codigo CST/CSOSN conforme seu regime.</small>
                  </div>
                  <div>
                    <label htmlFor="aliq-icms">Aliq. ICMS</label>
                    <input
                      id="aliq-icms"
                      placeholder="Ex.: 18,00"
                      value={aliqIcms}
                      onChange={(e) => setAliqIcms(e.target.value)}
                    />
                  </div>
                </div>

                <div className="products-row-3">
                  <div>
                    <label htmlFor="cst-pis">CST PIS</label>
                    <select id="cst-pis" value={cstPis} onChange={(e) => setCstPis(e.target.value)}>
                      {cstPisCofinsOptions.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label htmlFor="aliq-pis">Aliq. PIS</label>
                    <input
                      id="aliq-pis"
                      placeholder="Ex.: 1,65"
                      value={aliqPis}
                      onChange={(e) => setAliqPis(e.target.value)}
                    />
                  </div>
                  <div>
                    <label htmlFor="cst-cofins">CST COFINS</label>
                    <select id="cst-cofins" value={cstCofins} onChange={(e) => setCstCofins(e.target.value)}>
                      {cstPisCofinsOptions.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="products-row-2">
                  <div>
                    <label htmlFor="aliq-cofins">Aliq. COFINS</label>
                    <input
                      id="aliq-cofins"
                      placeholder="Ex.: 7,60"
                      value={aliqCofins}
                      onChange={(e) => setAliqCofins(e.target.value)}
                    />
                  </div>
                  <div>
                    <label htmlFor="fiscal-type">Tipo produto fiscal</label>
                    <select id="fiscal-type" value={fiscalType} onChange={(e) => setFiscalType(e.target.value)}>
                      {fiscalTypeOptions.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </>
            )}

            <div className="products-cadastro-footer">
              <button type="submit" disabled={saving}>
                {saving ? 'Salvando...' : 'Salvar dados'}
              </button>
              <button
                type="button"
                className="button-muted"
                onClick={() => setShowCadastroSpan(false)}
              >
                Fechar cadastro
              </button>
            </div>
          </form>
        </article>
      )}

      <div className="products-grid products-grid-list-only">
        <article className="card products-list-card">
          <h3>Catalogo ativo</h3>
          {products.length === 0 ? (
            <p className="empty-state">Nenhum produto cadastrado ainda.</p>
          ) : (
            <ul className="products-list">
              {products.map((product) => (
                <li key={product.id}>
                  <div>
                    <strong>
                      <span className="products-id-tag">ID {product.productCode ?? parseLegacyProductCode(product.name) ?? '--'}</span>{' '}
                      {getProductDisplayName(product)}
                    </strong>
                    <span className={['products-group-tag', groupVisuals[product.category]?.className ?? ''].join(' ')}>
                      <b>{groupVisuals[product.category]?.icon ?? '📦'}</b> {groupVisuals[product.category]?.label ?? product.category}
                    </span>
                  </div>
                  <div>
                    <strong>{currency.format(product.price)}</strong>
                    <span>estoque {product.stock}</span>
                    <span>
                      custo {product.costValue !== undefined ? currency.format(product.costValue) : '-'} | margem{' '}
                      {product.marginProfit !== undefined ? `${product.marginProfit.toFixed(2)}%` : '-'}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </article>
      </div>
    </section>
  );
}
