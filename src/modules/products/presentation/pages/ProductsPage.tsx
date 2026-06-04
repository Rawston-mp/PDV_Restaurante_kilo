import { useState } from 'react';

import { productsContainer } from '@/modules/products/infrastructure/container/productsContainer';
import { useCreateProduct } from '@/modules/products/presentation/hooks/useCreateProduct';
import { useProductsQuery } from '@/modules/products/presentation/hooks/useProductsQuery';

export function ProductsPage() {
  const { products, setProducts, reload } = useProductsQuery();
  const { createProduct, saving } = useCreateProduct();

  const [name, setName] = useState('');
  const [category, setCategory] = useState('GERAL');
  const [price, setPrice] = useState(0);
  const [stock, setStock] = useState(0);
  const [byWeight, setByWeight] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const currency = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

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

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    const product = await createProduct({
      name,
      category,
      price,
      stock,
      byWeight
    });

    setProducts((prev) => [...prev, product]);
    setName('');
    setPrice(0);
    setStock(0);
    setByWeight(false);
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

      <div className="products-grid">
        <article className="card products-form-card">
          <h3>Novo produto</h3>

          <form onSubmit={onSubmit} className="products-form">
            <label htmlFor="name">Nome</label>
            <input id="name" value={name} onChange={(e) => setName(e.target.value)} required />

            <label htmlFor="category">Categoria</label>
            <input
              id="category"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              required
            />

            <div className="products-row-2">
              <div>
                <label htmlFor="price">Preco</label>
                <input
                  id="price"
                  type="number"
                  min={0}
                  step="0.01"
                  value={price}
                  onChange={(e) => setPrice(Number(e.target.value))}
                  required
                />
              </div>
              <div>
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

            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={byWeight}
                onChange={(e) => setByWeight(e.target.checked)}
              />
              Produto por peso
            </label>

            <button type="submit" disabled={saving}>
              {saving ? 'Salvando...' : 'Cadastrar produto'}
            </button>
          </form>

          <div className="products-actions">
            <button type="button" onClick={onSyncProducts}>
              Sincronizar produtos
            </button>
            <button type="button" className="button-muted" onClick={onProcessSyncQueue}>
              Processar fila de sincronizacao
            </button>
          </div>

          {syncMessage && <p className="sync-banner">{syncMessage}</p>}
        </article>

        <article className="card products-list-card">
          <h3>Catalogo ativo</h3>
          {products.length === 0 ? (
            <p className="empty-state">Nenhum produto cadastrado ainda.</p>
          ) : (
            <ul className="products-list">
              {products.map((product) => (
                <li key={product.id}>
                  <div>
                    <strong>{product.name}</strong>
                    <span>{product.category}</span>
                  </div>
                  <div>
                    <strong>{currency.format(product.price)}</strong>
                    <span>estoque {product.stock}</span>
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
