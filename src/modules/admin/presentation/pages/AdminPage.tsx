import { useEffect, useMemo, useState } from 'react';

import { useAuth } from '@/modules/auth/presentation/providers/AuthProvider';
import { productsContainer } from '@/modules/products/infrastructure/container/productsContainer';
import {
  clearSensitiveAuditEvents,
  listSensitiveAuditEvents,
  type SensitiveAuditEvent
} from '@/modules/admin/infrastructure/local/sensitiveAuditLog';
import type { SyncQueueTask } from '@/shared/sync/domain/entities/SyncQueueTask';

export function AdminPage() {
  const { user } = useAuth();
  const [syncTasks, setSyncTasks] = useState<SyncQueueTask[]>([]);
  const [auditEvents, setAuditEvents] = useState<SensitiveAuditEvent[]>([]);
  const [message, setMessage] = useState<string | null>(null);

  const refresh = async () => {
    const tasks = await productsContainer.syncTaskQueue.listAll();
    setSyncTasks(tasks);
    setAuditEvents(listSensitiveAuditEvents());
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

  const onProcessQueue = async () => {
    const result = await productsContainer.processSyncQueue.execute();
    setMessage(
      `Fila processada: ${result.processed} tarefas | sucesso ${result.succeeded} | falha ${result.failed}.`
    );
    await refresh();
  };

  const onClearAudit = () => {
    clearSensitiveAuditEvents();
    setAuditEvents([]);
    setMessage('Auditoria local de acoes sensiveis foi limpa.');
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
        </article>

        <article className="card admin-audit">
          <h3>Auditoria de acoes sensiveis</h3>
          {auditEvents.length === 0 ? (
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
                  {auditEvents.map((event) => (
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
        </article>
      </div>
    </section>
  );
}
