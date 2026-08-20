import { useState, type FormEvent } from 'react';

import { clientsContainer } from '@/modules/clients/infrastructure/container/clientsContainer';
import { useConveniosQuery } from '@/modules/convenios/presentation/hooks/useConveniosQuery';
import { loadRecentWeightHistory } from '@/modules/orders/infrastructure/local/comandaPersistence';
import type { Order } from '@/modules/orders/domain/entities/Order';
import { ordersContainer } from '@/modules/orders/infrastructure/container/ordersContainer';
import { useComandaStatus } from '@/modules/orders/presentation/hooks/useComandaStatus';
import { useCreateOrder } from '@/modules/orders/presentation/hooks/useCreateOrder';
import { useScaleSocket } from '@/modules/orders/presentation/hooks/useScaleSocket';
import { useAuth } from '@/modules/auth/presentation/providers/AuthProvider';
import { useClientsQuery } from '@/modules/clients/presentation/hooks/useClientsQuery';
import { getCertificateFiscalBlockReason } from '@/shared/domain/services/digitalCertificateRules';

const formatLaunchDateTime = (value: Date) => {
  const datePart = new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  }).format(value);

  const timePart = new Intl.DateTimeFormat('pt-BR', {
    hour: '2-digit',
    minute: '2-digit'
  }).format(value);

  return `${datePart} ${timePart}`;
};

export function NewOrderPage() {
  const { can } = useAuth();
  const { clients, setClients } = useClientsQuery();
  const { convenios } = useConveniosQuery();
  const [table, setTable] = useState('01');
  const [currentOrder, setCurrentOrder] = useState<Order | null>(null);
  const [itemName, setItemName] = useState('Refrigerante');
  const [itemPrice, setItemPrice] = useState(8);
  const [itemQuantity, setItemQuantity] = useState(1);
  const [itemByWeight, setItemByWeight] = useState(false);
  const [itemWeight, setItemWeight] = useState(0.3);
  const [recentHistory, setRecentHistory] = useState<number[]>([]);
  const [paymentType, setPaymentType] = useState<'A_VISTA' | 'FIADO' | 'CONVENIO'>('A_VISTA');
  const [selectedClientId, setSelectedClientId] = useState('');
  const [selectedConvenioId, setSelectedConvenioId] = useState('');
  const [fiadoFeedback, setFiadoFeedback] = useState<string | null>(null);
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
    setPaymentType('A_VISTA');
    setSelectedClientId('');
    setSelectedConvenioId('');
    setFiadoFeedback(null);
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

  const fiscalBlockReason = currentOrder?.status === 'PRONTO' ? getCertificateFiscalBlockReason() : null;

  const onAdvanceStatus = async () => {
    if (!currentOrder) {
      return;
    }

    const isFinalizingOrder = currentOrder.status === 'PRONTO';

    if (isFinalizingOrder && fiscalBlockReason) {
      setFiadoFeedback(fiscalBlockReason);
        return;
    }

    if (isFinalizingOrder && paymentType === 'FIADO' && !selectedClientId) {
      setFiadoFeedback('Selecione um cliente para lançar o fiado antes de finalizar.');
      return;
    }

    if (isFinalizingOrder && paymentType === 'CONVENIO' && !selectedConvenioId) {
      setFiadoFeedback('Selecione um convenio para fechar o caixa antes de finalizar.');
      return;
    }

    const order = await ordersContainer.advanceOrderStatus.execute({
      orderId: currentOrder.id
    });

    if (isFinalizingOrder && paymentType === 'FIADO' && selectedClientId) {
      const targetClient = clients.find((client) => client.id === selectedClientId);

      if (!targetClient) {
        setFiadoFeedback('O cliente selecionado não foi encontrado para lançar o fiado.');
      } else {
        const launchedAt = formatLaunchDateTime(new Date());
        const entryDescription = `Fiado pedido ${currentOrder.id} - Mesa ${currentOrder.table} - Total R$ ${currentOrder.total.toFixed(2)}`;

        const updatedClient = {
          ...targetClient,
          consumptionHistory: [
            {
              id: `entry-${crypto.randomUUID()}`,
              description: entryDescription,
              launchedAt
            },
            ...targetClient.consumptionHistory
          ],
          version: targetClient.version + 1,
          updatedAt: new Date()
        };

        await clientsContainer.clientRepository.save(updatedClient);
        setClients((prev) => prev.map((client) => (client.id === targetClient.id ? updatedClient : client)));
        setFiadoFeedback(`Fiado lancado no cliente ${targetClient.fullName}.`);
      }
    } else if (isFinalizingOrder && paymentType === 'CONVENIO' && selectedConvenioId) {
      const targetConvenio = convenios.find((convenio) => convenio.id === selectedConvenioId);
      setFiadoFeedback(
        targetConvenio
          ? `Convênio associado ao fechamento: ${targetConvenio.name}.`
          : 'O convênio selecionado não foi encontrado.'
      );
    } else {
      setFiadoFeedback(null);
    }

    setCurrentOrder(order);
  };

  return (
    <div className="new-order-page">
      <header className="new-order-header">
        <div>
          <h2>Novo Pedido</h2>
          <p className="products-subtitle">Abertura de mesa, controle de comanda e lançamento de itens.</p>
        </div>
      </header>

      <section className="new-order-card">
        <h3>Mesa do Pedido</h3>
        <form onSubmit={onSubmit} className="new-order-form-inline" autoComplete="off">
          <div className="new-order-form-group">
            <label htmlFor="table">Mesa</label>
            <input
              id="table"
              value={table}
              onChange={(e) => setTable(e.target.value)}
              placeholder="Ex: 01"
              required
            />
          </div>
          <button type="submit" className="new-order-btn new-order-btn--success" disabled={saving}>
            {saving ? 'Salvando...' : 'Criar pedido'}
          </button>
        </form>
      </section>

      <section className="new-order-card">
        <h3>Status da Comanda</h3>
        <div className="new-order-comanda-toolbar">
          <span className={`new-order-status-pill ${comandaAtiva ? 'is-open' : ''}`}>
            Comanda ativa: {comandaAtiva ? 'sim' : 'não'}
          </span>
          <button
            type="button"
            className="new-order-btn new-order-btn--success"
            onClick={() => void abrirComanda()}
            disabled={loading || comandaAtiva}
          >
            Abrir comanda
          </button>
          <button
            type="button"
            className="new-order-btn new-order-btn--danger"
            onClick={() => void fecharComanda()}
            disabled={loading || !comandaAtiva}
          >
            Fechar comanda
          </button>
        </div>
        {error && <p className="products-form-warning">{error}</p>}
      </section>

      {currentOrder && (
        <>
          <section className="new-order-card">
            <h3>Detalhes do Pedido</h3>
            <p>Pedido criado: {currentOrder.id}</p>
            <p>Status atual: {currentOrder.status}</p>
            <p>Total atual: R$ {currentOrder.total.toFixed(2)}</p>

            <h3 style={{ marginTop: '0.85rem' }}>Fechamento / Caixa</h3>
            <div className="new-order-form-group">
              <label htmlFor="payment-type">Forma de pagamento</label>
              <select
                id="payment-type"
                value={paymentType}
                onChange={(e) => setPaymentType(e.target.value as 'A_VISTA' | 'FIADO' | 'CONVENIO')}
              >
                <option value="A_VISTA">A vista</option>
                <option value="FIADO">Fiado</option>
                <option value="CONVENIO">Convenio</option>
              </select>
            </div>

            {paymentType === 'FIADO' && (
              <div className="new-order-form-group">
                <label htmlFor="fiado-client">Cliente para lançar fiado</label>
                <select
                  id="fiado-client"
                  value={selectedClientId}
                  onChange={(e) => setSelectedClientId(e.target.value)}
                >
                  <option value="">Selecione um cliente</option>
                  {clients
                    .filter((client) => client.active)
                    .map((client) => (
                      <option key={client.id} value={client.id}>
                        {client.fullName} ({client.clientCode})
                      </option>
                    ))}
                </select>
                {clients.filter((client) => client.active).length === 0 && (
                  <p className="products-form-warning">Nenhum cliente ativo cadastrado para lançamento de fiado.</p>
                )}
              </div>
            )}

            {paymentType === 'CONVENIO' && (
              <div className="new-order-form-group">
                <label htmlFor="convenio-select">Convênio</label>
                <select
                  id="convenio-select"
                  value={selectedConvenioId}
                  onChange={(e) => setSelectedConvenioId(e.target.value)}
                >
                  <option value="">Selecione um convênio</option>
                  {convenios
                    .filter((convenio) => convenio.active)
                    .map((convenio) => (
                      <option key={convenio.id} value={convenio.id}>
                        {convenio.name} ({convenio.paymentMethod})
                      </option>
                    ))}
                </select>
                {convenios.filter((convenio) => convenio.active).length === 0 && (
                  <p className="products-form-warning">Nenhum convênio ativo cadastrado para fechamento do caixa.</p>
                )}
              </div>
            )}

            {fiadoFeedback && <p className="products-form-info">{fiadoFeedback}</p>}
            {fiscalBlockReason && <p className="products-form-warning">{fiscalBlockReason}</p>}
          </section>

          <section className="new-order-card">
            <h3>Adicionar item</h3>
            <p>Sensor de peso: {connected ? 'conectado' : 'desconectado'}</p>
            <p>Peso recebido: {weight ? `${weight.toFixed(3)} kg` : 'aguardando leitura'}</p>

            <form onSubmit={onAddItem} autoComplete="off" className="products-form">
              <div className="products-row-3">
                <div>
                  <label htmlFor="item-name">Nome do item</label>
                  <input
                    id="item-name"
                    value={itemName}
                    onChange={(e) => setItemName(e.target.value)}
                    required
                  />
                </div>

                <div>
                  <label htmlFor="item-price">Preço unitário</label>
                  <input
                    id="item-price"
                    type="number"
                    step="0.01"
                    min={0}
                    value={itemPrice}
                    onChange={(e) => setItemPrice(Number(e.target.value))}
                    required
                  />
                </div>

                <div>
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
                </div>
              </div>

              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={itemByWeight}
                  onChange={(e) => setItemByWeight(e.target.checked)}
                />
                Item por peso
              </label>

              {itemByWeight && (
                <div style={{ display: 'grid', gap: '0.65rem' }}>
                  <div className="new-order-form-group">
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
                  </div>
                  <div style={{ display: 'flex', gap: '0.65rem', flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      className="new-order-btn new-order-btn--info"
                      disabled={!comandaAtiva || !weight}
                      onClick={() => {
                        if (weight) {
                          setItemWeight(weight);
                        }
                      }}
                    >
                      Usar peso do sensor
                    </button>
                    <button
                      type="button"
                      className="new-order-btn new-order-btn--purple"
                      onClick={() => {
                        void loadHistory();
                      }}
                    >
                      Atualizar histórico local
                    </button>
                  </div>
                </div>
              )}

              {recentHistory.length > 0 && (
                <p className="products-subtitle">
                  Histórico local: {recentHistory.map((value) => `${value.toFixed(3)} kg`).join(' | ')}
                </p>
              )}

              <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginTop: '0.5rem' }}>
                <button
                  type="submit"
                  className="new-order-btn new-order-btn--primary"
                  disabled={!can('orders:add-item')}
                >
                  Adicionar item ao pedido
                </button>
                <button
                  type="button"
                  className="new-order-btn new-order-btn--warning"
                  onClick={onAdvanceStatus}
                  disabled={!can('orders:advance-status') || Boolean(fiscalBlockReason)}
                >
                  Avançar status do pedido
                </button>
              </div>
            </form>
          </section>
        </>
      )}
    </div>
  );
}
