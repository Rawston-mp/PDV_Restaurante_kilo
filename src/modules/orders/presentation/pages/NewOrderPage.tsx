import { useState, type FormEvent } from 'react';

import { loadRecentWeightHistory } from '@/modules/orders/infrastructure/local/comandaPersistence';
import type { Order } from '@/modules/orders/domain/entities/Order';
import { ordersContainer } from '@/modules/orders/infrastructure/container/ordersContainer';
import { useComandaStatus } from '@/modules/orders/presentation/hooks/useComandaStatus';
import { useCreateOrder } from '@/modules/orders/presentation/hooks/useCreateOrder';
import { useScaleSocket } from '@/modules/orders/presentation/hooks/useScaleSocket';
import { useAuth } from '@/modules/auth/presentation/providers/AuthProvider';

export function NewOrderPage() {
  const { can } = useAuth();
  const [table, setTable] = useState('01');
  const [currentOrder, setCurrentOrder] = useState<Order | null>(null);
  const [itemName, setItemName] = useState('Refrigerante');
  const [itemPrice, setItemPrice] = useState(8);
  const [itemQuantity, setItemQuantity] = useState(1);
  const [itemByWeight, setItemByWeight] = useState(false);
  const [itemWeight, setItemWeight] = useState(0.3);
  const [recentHistory, setRecentHistory] = useState<number[]>([]);
  const { createOrder, saving } = useCreateOrder();
  const { comandaAtiva, abrirComanda, fecharComanda, loading, error } = useComandaStatus();
  const { weight, connected } = useScaleSocket(comandaAtiva, comandaAtiva);

  const loadHistory = async () => {
    const history = await loadRecentWeightHistory(3);
    setRecentHistory(history.map((entry) => entry.peso));
  };

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const order = await createOrder(table);
    setCurrentOrder(order);
    await loadHistory();
  };

  const onAddItem = async (event: FormEvent) => {
    event.preventDefault();
    if (!currentOrder) {
      return;
    }

    const order = await ordersContainer.addItemToOrder.execute({
      orderId: currentOrder.id,
      item: {
        id: `it-${crypto.randomUUID()}`,
        productId: 'manual-item',
        productName: itemName,
        quantity: itemQuantity,
        unitPrice: itemPrice,
        byWeight: itemByWeight,
        weight: itemByWeight ? itemWeight : undefined
      }
    });

    setCurrentOrder(order);
  };

  const onAdvanceStatus = async () => {
    if (!currentOrder) {
      return;
    }

    const order = await ordersContainer.advanceOrderStatus.execute({
      orderId: currentOrder.id
    });

    setCurrentOrder(order);
  };

  return (
    <section className="card">
      <h2>Novo Pedido</h2>
      <form onSubmit={onSubmit}>
        <label htmlFor="table">Mesa</label>
        <input
          id="table"
          value={table}
          onChange={(e) => setTable(e.target.value)}
          required
        />
        <button type="submit" disabled={saving}>
          {saving ? 'Salvando...' : 'Criar pedido'}
        </button>
      </form>

      <div>
        <p>Comanda ativa: {comandaAtiva ? 'sim' : 'nao'}</p>
        <button type="button" onClick={() => void abrirComanda()} disabled={loading || comandaAtiva}>
          Abrir comanda
        </button>
        <button type="button" onClick={() => void fecharComanda()} disabled={loading || !comandaAtiva}>
          Fechar comanda
        </button>
        {error && <p>{error}</p>}
      </div>

      {currentOrder && (
        <>
          <p>Pedido criado: {currentOrder.id}</p>
          <p>Status atual: {currentOrder.status}</p>
          <p>Total atual: R$ {currentOrder.total.toFixed(2)}</p>

          <h3>Adicionar item</h3>
          <p>Balanca: {connected ? 'conectada' : 'desconectada'}</p>
          <p>Peso recebido: {weight ? `${weight.toFixed(3)} kg` : 'aguardando leitura'}</p>
          <form onSubmit={onAddItem}>
            <label htmlFor="item-name">Nome do item</label>
            <input
              id="item-name"
              value={itemName}
              onChange={(e) => setItemName(e.target.value)}
              required
            />

            <label htmlFor="item-price">Preco unitario</label>
            <input
              id="item-price"
              type="number"
              step="0.01"
              min={0}
              value={itemPrice}
              onChange={(e) => setItemPrice(Number(e.target.value))}
              required
            />

            <label htmlFor="item-quantity">Quantidade</label>
            <input
              id="item-quantity"
              type="number"
              step="1"
              min={1}
              value={itemQuantity}
              onChange={(e) => setItemQuantity(Number(e.target.value))}
              required
            />

            <label>
              <input
                type="checkbox"
                checked={itemByWeight}
                onChange={(e) => setItemByWeight(e.target.checked)}
              />
              Item por peso
            </label>

            {itemByWeight && (
              <>
                <label htmlFor="item-weight">Peso (kg)</label>
                <input
                  id="item-weight"
                  type="number"
                  step="0.001"
                  min={0.001}
                  value={itemWeight}
                  onChange={(e) => setItemWeight(Number(e.target.value))}
                  required
                />
                <button
                  type="button"
                  disabled={!comandaAtiva || !weight}
                  onClick={() => {
                    if (weight) {
                      setItemWeight(weight);
                    }
                  }}
                >
                  Usar peso da balanca
                </button>
                <button
                  type="button"
                  onClick={() => {
                    void loadHistory();
                  }}
                >
                  Atualizar historico local
                </button>
              </>
            )}

            {recentHistory.length > 0 && (
              <p>
                Historico local: {recentHistory.map((value) => `${value.toFixed(3)}kg`).join(' | ')}
              </p>
            )}

            <button type="submit" disabled={!can('orders:add-item')}>
              Adicionar item ao pedido
            </button>
          </form>

          <button type="button" onClick={onAdvanceStatus} disabled={!can('orders:advance-status')}>
            Avancar status do pedido
          </button>
        </>
      )}
    </section>
  );
}
