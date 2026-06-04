import { useEffect, useMemo, useState, type FormEvent } from 'react';

import { useAuth } from '@/modules/auth/presentation/providers/AuthProvider';
import type { Role } from '@/modules/auth/domain/types/Role';
import type { PinKind } from '@/modules/auth/infrastructure/local/pinPolicy';
import { productsContainer } from '@/modules/products/infrastructure/container/productsContainer';
import {
  clearSensitiveAuditEvents,
  listSensitiveAuditEvents,
  type SensitiveAuditEvent
} from '@/modules/admin/infrastructure/local/sensitiveAuditLog';
import type { Product } from '@/modules/products/domain/entities/Product';
import type { SyncQueueTask } from '@/shared/sync/domain/entities/SyncQueueTask';
import { logInfo } from '@/shared/infrastructure/logging/structuredLogger';

const actionOptions: Array<SensitiveAuditEvent['action'] | 'ALL'> = ['ALL', 'CLOSE_COMANDA', 'CANCEL_ORDER'];
const outcomeOptions: Array<SensitiveAuditEvent['outcome'] | 'ALL'> = ['ALL', 'SUCCESS', 'DENIED'];

const roleOptions: Role[] = ['ADMIN', 'GERENTE', 'CAIXA', 'ATENDENTE', 'BALANCA_A', 'BALANCA_B'];

const parseLegacyProductCode = (productName: string) => {
  const [firstChunk] = productName.split(' - ');
  return /^\d{2,4}$/.test(firstChunk) ? firstChunk : '--';
};

const getProductDisplayName = (product: Product) => {
  const legacyCode = parseLegacyProductCode(product.name);
  if (legacyCode !== '--') {
    return product.name.split(' - ').slice(1).join(' - ');
  }

  return product.name;
};

export function AdminPage() {
  const { user, changePin, getPinHealth } = useAuth();
  const [syncTasks, setSyncTasks] = useState<SyncQueueTask[]>([]);
  const [auditEvents, setAuditEvents] = useState<SensitiveAuditEvent[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [actionFilter, setActionFilter] = useState<'ALL' | SensitiveAuditEvent['action']>('ALL');
  const [outcomeFilter, setOutcomeFilter] = useState<'ALL' | SensitiveAuditEvent['outcome']>('ALL');
  const [roleFilter, setRoleFilter] = useState<'ALL' | Role>('ALL');
  const [textFilter, setTextFilter] = useState('');

  const [pinRole, setPinRole] = useState<Role>('CAIXA');
  const [pinKind, setPinKind] = useState<PinKind>('LOGIN');
  const [currentPin, setCurrentPin] = useState('');
  const [nextPin, setNextPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [pinMessage, setPinMessage] = useState<string | null>(null);

  const refresh = async () => {
    const tasks = await productsContainer.syncTaskQueue.listAll();
    setSyncTasks(tasks);
    setAuditEvents(listSensitiveAuditEvents());
    setProducts(await productsContainer.productRepository.list());
  };

  useEffect(() => {
    void refresh();
  }, []);

  const queueSummary = useMemo(() => {
    const pendingProducts = syncTasks.filter((task) => task.type === 'SYNC_PRODUCTS').length;
    const pendingOrders = syncTasks.filter((task) => task.type === 'SYNC_ORDERS').length;

    return {
      total: syncTasks.length,
      pendingProducts,
      pendingOrders
    };
  }, [syncTasks]);

  const pinHealth = useMemo(() => getPinHealth(), [getPinHealth]);
  const currency = useMemo(
    () => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }),
    []
  );

  const marginRows = useMemo(() => {
    return products
      .map((product) => {
        const costValue = product.costValue ?? 0;
        const price = product.price;
        const marginValue = price - costValue;
        const marginPercent = costValue > 0 ? (marginValue / costValue) * 100 : null;
        const estimatedProfitStock = marginValue * product.stock;

        return {
          product,
          costValue,
          marginValue,
          marginPercent,
          estimatedProfitStock
        };
      })
      .sort((a, b) => b.estimatedProfitStock - a.estimatedProfitStock);
  }, [products]);

  const filteredAuditEvents = useMemo(() => {
    const normalizedText = textFilter.trim().toLowerCase();

    return auditEvents.filter((event) => {
      if (actionFilter !== 'ALL' && event.action !== actionFilter) {
        return false;
      }

      if (outcomeFilter !== 'ALL' && event.outcome !== outcomeFilter) {
        return false;
      }

      if (roleFilter !== 'ALL' && event.actorRole !== roleFilter) {
        return false;
      }

      if (!normalizedText) {
        return true;
      }

      const line = [
        event.action,
        event.actorRole,
        event.actorName,
        event.outcome,
        event.reason ?? '',
        event.scaleId ?? ''
      ]
        .join(' ')
        .toLowerCase();

      return line.includes(normalizedText);
    });
  }, [actionFilter, outcomeFilter, roleFilter, textFilter, auditEvents]);

  const onProcessQueue = async () => {
    const result = await productsContainer.processSyncQueue.execute();
    setMessage(
      `Fila processada: ${result.processed} tarefas | sucesso ${result.succeeded} | falha ${result.failed}.`
    );

    logInfo({
      event: 'ADMIN_PROCESS_SYNC_QUEUE',
      module: 'admin',
      details: {
        processed: result.processed,
        succeeded: result.succeeded,
        failed: result.failed
      }
    });

    await refresh();
  };

  const onClearAudit = () => {
    clearSensitiveAuditEvents();
    setAuditEvents([]);
    setMessage('Auditoria local de acoes sensiveis foi limpa.');

    logInfo({
      event: 'ADMIN_CLEAR_AUDIT',
      module: 'admin'
    });
  };

  const onExportAudit = () => {
    const payload = JSON.stringify(filteredAuditEvents, null, 2);
    const blob = new Blob([payload], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `audit-sensitive-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.json`;
    link.click();
    URL.revokeObjectURL(url);

    setMessage(`Exportacao concluida com ${filteredAuditEvents.length} eventos.`);
  };

  const onChangePin = (event: FormEvent) => {
    event.preventDefault();

    const result = changePin({
      kind: pinKind,
      role: pinRole,
      currentPin,
      nextPin,
      confirmPin
    });

    setPinMessage(result.message);

    if (result.success) {
      setCurrentPin('');
      setNextPin('');
      setConfirmPin('');
    }
  };

  return (
    <section className="admin-page">
      <header className="card admin-header">
        <div>
          <p className="admin-eyebrow">Etapa 1 | Governanca</p>
          <h2>Painel Admin</h2>
          <p className="admin-subtitle">Controle de sincronizacao e trilha de acoes sensiveis.</p>
        </div>
      </header>

      <div className="admin-grid">
        <article className="card admin-kpis">
          <h3>Visao operacional</h3>
          <ul>
            <li>
              <span>Usuario ativo</span>
              <strong>{user ? `${user.name} (${user.role})` : 'Nao autenticado'}</strong>
            </li>
            <li>
              <span>Fila total</span>
              <strong>{queueSummary.total}</strong>
            </li>
            <li>
              <span>Pendencias produtos</span>
              <strong>{queueSummary.pendingProducts}</strong>
            </li>
            <li>
              <span>Pendencias pedidos</span>
              <strong>{queueSummary.pendingOrders}</strong>
            </li>
            <li>
              <span>Eventos sensiveis</span>
              <strong>{auditEvents.length}</strong>
            </li>
            <li>
              <span>PIN login fraco</span>
              <strong>{pinHealth.loginStrengthIssues}</strong>
            </li>
            <li>
              <span>PIN sensivel fraco</span>
              <strong>{pinHealth.sensitiveStrengthIssues}</strong>
            </li>
          </ul>

          <div className="admin-actions">
            <button type="button" onClick={() => void refresh()}>
              Atualizar painel
            </button>
            <button type="button" className="button-muted" onClick={() => void onProcessQueue()}>
              Processar fila
            </button>
            <button type="button" className="admin-danger" onClick={onClearAudit}>
              Limpar auditoria
            </button>
          </div>

          {message && <p className="admin-message">{message}</p>}

          <form onSubmit={onChangePin} className="admin-pin-form">
            <h4>Gestao de PIN</h4>

            <label htmlFor="pin-role">Perfil</label>
            <select id="pin-role" value={pinRole} onChange={(e) => setPinRole(e.target.value as Role)}>
              {roleOptions.map((role) => (
                <option key={role} value={role}>
                  {role}
                </option>
              ))}
            </select>

            <label htmlFor="pin-kind">Tipo</label>
            <select
              id="pin-kind"
              value={pinKind}
              onChange={(e) => setPinKind(e.target.value as PinKind)}
            >
              <option value="LOGIN">LOGIN</option>
              <option value="SENSITIVE">SENSITIVE</option>
            </select>

            <label htmlFor="pin-current">PIN atual</label>
            <input
              id="pin-current"
              type="password"
              value={currentPin}
              onChange={(e) => setCurrentPin(e.target.value)}
              required
            />

            <label htmlFor="pin-next">Novo PIN</label>
            <input
              id="pin-next"
              type="password"
              value={nextPin}
              onChange={(e) => setNextPin(e.target.value)}
              required
            />

            <label htmlFor="pin-confirm">Confirmar novo PIN</label>
            <input
              id="pin-confirm"
              type="password"
              value={confirmPin}
              onChange={(e) => setConfirmPin(e.target.value)}
              required
            />

            <button type="submit">Atualizar PIN</button>
            {pinMessage && <p className="admin-message">{pinMessage}</p>}
          </form>
        </article>

        <article className="card admin-audit">
          <h3>Auditoria de acoes sensiveis</h3>
          <div className="admin-audit-filters">
            <select value={actionFilter} onChange={(e) => setActionFilter(e.target.value as typeof actionFilter)}>
              {actionOptions.map((item) => (
                <option key={item} value={item}>
                  Acao: {item}
                </option>
              ))}
            </select>

            <select
              value={outcomeFilter}
              onChange={(e) => setOutcomeFilter(e.target.value as typeof outcomeFilter)}
            >
              {outcomeOptions.map((item) => (
                <option key={item} value={item}>
                  Resultado: {item}
                </option>
              ))}
            </select>

            <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value as typeof roleFilter)}>
              <option value="ALL">Perfil: ALL</option>
              {roleOptions.map((role) => (
                <option key={role} value={role}>
                  Perfil: {role}
                </option>
              ))}
            </select>

            <input
              value={textFilter}
              onChange={(e) => setTextFilter(e.target.value)}
              placeholder="Buscar por texto"
            />

            <button type="button" onClick={onExportAudit}>
              Exportar JSON
            </button>
          </div>

          {filteredAuditEvents.length === 0 ? (
            <p className="empty-state">Nenhum evento sensivel registrado.</p>
          ) : (
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Quando</th>
                    <th>Acao</th>
                    <th>Perfil</th>
                    <th>Balanca</th>
                    <th>Resultado</th>
                    <th>Motivo</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAuditEvents.map((event) => (
                    <tr key={event.id}>
                      <td>{new Date(event.createdAt).toLocaleString('pt-BR')}</td>
                      <td>{event.action}</td>
                      <td>{event.actorRole}</td>
                      <td>{event.scaleId ?? '-'}</td>
                      <td>{event.outcome}</td>
                      <td>{event.reason ?? '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <section className="admin-margin-section">
            <h3>Analise de Margem por Produto</h3>
            {marginRows.length === 0 ? (
              <p className="empty-state">Nenhum produto para analisar.</p>
            ) : (
              <div className="admin-table-wrap">
                <table className="admin-table admin-margin-table">
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>Produto</th>
                      <th>Custo</th>
                      <th>Venda</th>
                      <th>Margem %</th>
                      <th>Estoque</th>
                      <th>Lucro est. estoque</th>
                    </tr>
                  </thead>
                  <tbody>
                    {marginRows.map(({ product, costValue, marginPercent, estimatedProfitStock }) => (
                      <tr key={`margin-${product.id}`}>
                        <td>{product.productCode ?? parseLegacyProductCode(product.name)}</td>
                        <td>{getProductDisplayName(product)}</td>
                        <td>{currency.format(costValue)}</td>
                        <td>{currency.format(product.price)}</td>
                        <td>{marginPercent !== null ? `${marginPercent.toFixed(2)}%` : '-'}</td>
                        <td>{product.stock}</td>
                        <td>{currency.format(estimatedProfitStock)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </article>
      </div>
    </section>
  );
}
