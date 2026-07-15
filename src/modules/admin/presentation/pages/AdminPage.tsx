import { useEffect, useMemo, useState, type FormEvent } from 'react';

import { useAuth } from '@/modules/auth/presentation/providers/AuthProvider';
import { getRoleLabel, type Role } from '@/modules/auth/domain/types/Role';
import { productsContainer } from '@/modules/products/infrastructure/container/productsContainer';
import {
  clearSensitiveAuditEvents,
  listSensitiveAuditEvents,
  type SensitiveAuditEvent
} from '@/modules/admin/infrastructure/local/sensitiveAuditLog';
import { StoreSettingsPanel } from '@/modules/admin/presentation/components/StoreSettingsPanel';
import { PeripheralSettingsPanel } from '@/modules/admin/presentation/components/PeripheralSettingsPanel';
import type { Product } from '@/modules/products/domain/entities/Product';
import type { SyncQueueTask } from '@/shared/sync/domain/entities/SyncQueueTask';
import { logInfo } from '@/shared/infrastructure/logging/structuredLogger';
import {
  BR_UF_OPTIONS,
  CERTIFICATE_IMPORT_SOURCE_OPTIONS,
  CERTIFICATE_MODEL_OPTIONS,
  CERTIFICATE_SETTINGS_STORAGE_KEY,
  DEFAULT_CERTIFICATE_RENEW_ALERT_DAYS,
  formatCertificateFileSize,
  getCertificateExpiryStatus,
  getUfNfceRuleMessage,
  parseDigitalCertificateSettings,
  type CertificateImportSource,
  type CertificateModel,
  type DigitalCertificateSettings,
  validateCscByUf
} from '@/shared/domain/services/digitalCertificateRules';
import { formatCnpj, isValidCnpj, normalizeCnpj } from '@/shared/domain/services/documentValidation';

const actionOptions: Array<SensitiveAuditEvent['action'] | 'ALL'> = ['ALL', 'CLOSE_COMANDA', 'CANCEL_ORDER'];
const outcomeOptions: Array<SensitiveAuditEvent['outcome'] | 'ALL'> = ['ALL', 'SUCCESS', 'DENIED'];

const actionLabels: Record<SensitiveAuditEvent['action'] | 'ALL', string> = {
  ALL: 'Todas as ações',
  CLOSE_COMANDA: 'Fechamento de comanda',
  CANCEL_ORDER: 'Cancelamento de pedido'
};

const outcomeLabels: Record<SensitiveAuditEvent['outcome'] | 'ALL', string> = {
  ALL: 'Todos os resultados',
  SUCCESS: 'Aprovado',
  DENIED: 'Negado'
};

const roleOptions: Role[] = ['ADMIN', 'GERENTE', 'CAIXA', 'ATENDENTE', 'COMANDA_A', 'COMANDA_B'];
const cnaeOptions = [
  { value: '5611-2/01', label: '5611-2/01 - Restaurantes e similares' },
  { value: '5611-2/02', label: '5611-2/02 - Lanchonetes, casas de chá, de sucos' },
  { value: '5612-1/00', label: '5612-1/00 - Serviços ambulantes de alimentação' },
  { value: '5620-1/01', label: '5620-1/01 - Fornecimento de alimentos preparados' },
  { value: '5620-1/02', label: '5620-1/02 - Serviços de alimentação para eventos' }
];

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
  const { user, getPinHealth } = useAuth();
  const [syncTasks, setSyncTasks] = useState<SyncQueueTask[]>([]);
  const [auditEvents, setAuditEvents] = useState<SensitiveAuditEvent[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [actionFilter, setActionFilter] = useState<'ALL' | SensitiveAuditEvent['action']>('ALL');
  const [outcomeFilter, setOutcomeFilter] = useState<'ALL' | SensitiveAuditEvent['outcome']>('ALL');
  const [roleFilter, setRoleFilter] = useState<'ALL' | Role>('ALL');
  const [textFilter, setTextFilter] = useState('');

  const [certificateFormError, setCertificateFormError] = useState<string | null>(null);
  const [certificateAlias, setCertificateAlias] = useState('');
  const [certificateCompanyName, setCertificateCompanyName] = useState('');
  const [certificateCnpj, setCertificateCnpj] = useState('');
  const [certificateStateRegistration, setCertificateStateRegistration] = useState('');
  const [certificateCnae, setCertificateCnae] = useState('');
  const [certificateTaxRegime, setCertificateTaxRegime] = useState('');
  const [certificateAddressLine1, setCertificateAddressLine1] = useState('');
  const [certificateAddressLine2, setCertificateAddressLine2] = useState('');
  const [certificateCityUf, setCertificateCityUf] = useState('');
  const [certificateModel, setCertificateModel] = useState<CertificateModel>('A1');
  const [certificateUf, setCertificateUf] = useState<string>('SP');
  const [certificateCscId, setCertificateCscId] = useState('');
  const [certificateCscCode, setCertificateCscCode] = useState('');
  const [certificateNfceEnvironment, setCertificateNfceEnvironment] = useState<'HOMOLOGACAO' | 'PRODUCAO'>('HOMOLOGACAO');
  const [certificateNfceSerie, setCertificateNfceSerie] = useState('1');
  const [certificateNfceNextNumber, setCertificateNfceNextNumber] = useState('1');
  const [certificateAccountingEmail, setCertificateAccountingEmail] = useState('');
  const [certificatePassword, setCertificatePassword] = useState('');
  const [certificateFileName, setCertificateFileName] = useState('');
  const [certificateFileSize, setCertificateFileSize] = useState<number | null>(null);
  const [certificateFileExtension, setCertificateFileExtension] = useState('');
  const [certificateImportSource, setCertificateImportSource] = useState<CertificateImportSource>('MAQUINA');
  const [certificateImportedAt, setCertificateImportedAt] = useState('');
  const [certificateExpirationDate, setCertificateExpirationDate] = useState('');
  const [certificateRenewAlertDays, setCertificateRenewAlertDays] = useState(
    String(DEFAULT_CERTIFICATE_RENEW_ALERT_DAYS)
  );
  const [savedCertificateSettings, setSavedCertificateSettings] = useState<DigitalCertificateSettings | null>(null);
  const [certificateMessage, setCertificateMessage] = useState<string | null>(null);
  const [isFiscalSettingsOpen, setIsFiscalSettingsOpen] = useState(false);
  const [isOperationalOpen, setIsOperationalOpen] = useState(false);
  const [isAuditOpen, setIsAuditOpen] = useState(false);

  const refresh = async () => {
    const tasks = await productsContainer.syncTaskQueue.listAll();
    setSyncTasks(tasks);
    setAuditEvents(listSensitiveAuditEvents());
    setProducts(await productsContainer.productRepository.list());
  };

  useEffect(() => {
    void refresh();
  }, []);

  useEffect(() => {
    try {
      const parsedSettings = parseDigitalCertificateSettings(localStorage.getItem(CERTIFICATE_SETTINGS_STORAGE_KEY));
      if (!parsedSettings) {
        return;
      }

      setSavedCertificateSettings(parsedSettings);
      setCertificateAlias(parsedSettings.alias);
      setCertificateCompanyName(parsedSettings.companyName);
      setCertificateCnpj(parsedSettings.cnpj);
      setCertificateStateRegistration(parsedSettings.stateRegistration ?? '');
      setCertificateCnae(parsedSettings.cnae ?? '');
      setCertificateTaxRegime(parsedSettings.taxRegime ?? '');
      setCertificateAddressLine1(parsedSettings.addressLine1 ?? '');
      setCertificateAddressLine2(parsedSettings.addressLine2 ?? '');
      setCertificateCityUf(parsedSettings.cityUf ?? '');
      setCertificateModel(parsedSettings.model);
      setCertificateUf(parsedSettings.uf);
      setCertificateCscId(parsedSettings.cscId);
      setCertificateCscCode(parsedSettings.cscCode);
      setCertificateNfceEnvironment(parsedSettings.nfceEnvironment ?? 'HOMOLOGACAO');
      setCertificateNfceSerie(parsedSettings.nfceSerie ?? '1');
      setCertificateNfceNextNumber(parsedSettings.nfceNextNumber ?? '1');
      setCertificateAccountingEmail(parsedSettings.accountingEmail ?? '');
      setCertificateFileName(parsedSettings.fileName);
      setCertificateFileSize(parsedSettings.fileSize);
      setCertificateFileExtension(parsedSettings.fileExtension);
      setCertificateImportSource(parsedSettings.importSource);
      setCertificateImportedAt(parsedSettings.importedAt);
      setCertificateExpirationDate(parsedSettings.expirationDate);
      setCertificateRenewAlertDays(
        String(parsedSettings.renewAlertDays || DEFAULT_CERTIFICATE_RENEW_ALERT_DAYS)
      );
    } catch {
      localStorage.removeItem(CERTIFICATE_SETTINGS_STORAGE_KEY);
    }
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

  const certificateExpiryInfo = useMemo(() => {
    if (!certificateExpirationDate) {
      return null;
    }

    return getCertificateExpiryStatus({
      expirationDate: certificateExpirationDate,
      renewAlertDays: certificateRenewAlertDays
    });
  }, [certificateExpirationDate, certificateRenewAlertDays]);

  const isCscRequired = true;

  const clearCertificateForm = () => {
    setCertificateFormError(null);
    setCertificateAlias('');
    setCertificateCompanyName('');
    setCertificateCnpj('');
    setCertificateStateRegistration('');
    setCertificateCnae('');
    setCertificateTaxRegime('');
    setCertificateAddressLine1('');
    setCertificateAddressLine2('');
    setCertificateCityUf('');
    setCertificateModel('A1');
    setCertificateUf('SP');
    setCertificateCscId('');
    setCertificateCscCode('');
    setCertificateNfceEnvironment('HOMOLOGACAO');
    setCertificateNfceSerie('1');
    setCertificateNfceNextNumber('1');
    setCertificateAccountingEmail('');
    setCertificatePassword('');
    setCertificateFileName('');
    setCertificateFileSize(null);
    setCertificateFileExtension('');
    setCertificateImportSource('MAQUINA');
    setCertificateImportedAt('');
    setCertificateExpirationDate('');
    setCertificateRenewAlertDays(String(DEFAULT_CERTIFICATE_RENEW_ALERT_DAYS));
  };

  const openCertificateFilePicker = (source: CertificateImportSource) => {
    setCertificateImportSource(source);
    const fileInput = document.getElementById('admin-certificate-file-input') as HTMLInputElement | null;
    fileInput?.click();
  };

  const onImportCertificateFile = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';

    if (!file) {
      return;
    }

    const extensionChunks = file.name.split('.');
    const extension = extensionChunks.length > 1 ? extensionChunks[extensionChunks.length - 1].toLowerCase() : '';

    setCertificateFileName(file.name);
    setCertificateFileSize(file.size);
    setCertificateFileExtension(extension);
    setCertificateImportedAt(new Date().toISOString());
    setCertificateFormError(null);
    setCertificateMessage('Arquivo de certificado importado. Revise os dados e salve a configuração.');

    if (extension === 'pfx' || extension === 'p12') {
      setCertificateModel('A1');
    }
  };

  const onSaveCertificateSettings = (event: FormEvent) => {
    event.preventDefault();

    const cscValidationError = isCscRequired
      ? validateCscByUf({
          uf: certificateUf,
          cscId: certificateCscId,
          cscCode: certificateCscCode
        })
      : null;
    const renewAlertDays = Number(certificateRenewAlertDays);
    const hasInvalidRenewAlertDays =
      !Number.isFinite(renewAlertDays) || renewAlertDays < 1 || renewAlertDays > 180;
    const safeRenewAlertDays = hasInvalidRenewAlertDays
      ? DEFAULT_CERTIFICATE_RENEW_ALERT_DAYS
      : renewAlertDays;

    const settings: DigitalCertificateSettings = {
      alias: certificateAlias,
      companyName: certificateCompanyName,
      cnpj: normalizeCnpj(certificateCnpj),
      stateRegistration: certificateStateRegistration,
      cnae: certificateCnae,
      taxRegime: certificateTaxRegime,
      addressLine1: certificateAddressLine1,
      addressLine2: certificateAddressLine2,
      cityUf: certificateCityUf,
      model: certificateModel,
      uf: certificateUf,
      cscId: certificateCscId,
      cscCode: certificateCscCode,
      nfceEnvironment: certificateNfceEnvironment,
      nfceSerie: certificateNfceSerie,
      nfceNextNumber: certificateNfceNextNumber,
      accountingEmail: certificateAccountingEmail,
      fileName: certificateFileName,
      fileSize: certificateFileSize ?? 0,
      fileExtension: certificateFileExtension,
      importSource: certificateImportSource,
      expirationDate: certificateExpirationDate,
      renewAlertDays: safeRenewAlertDays,
      importedAt: certificateImportedAt,
      updatedAt: new Date().toISOString()
    };

    localStorage.setItem(CERTIFICATE_SETTINGS_STORAGE_KEY, JSON.stringify(settings));
    setSavedCertificateSettings(settings);
    setCertificatePassword('');
    setCertificateFormError(null);
    const pendingWarnings = [
      !certificateCompanyName.trim() ? 'informe a razão social' : null,
      !isValidCnpj(certificateCnpj) ? 'corrija o CNPJ' : null,
      !certificateCnae.trim() ? 'selecione o CNAE principal' : null,
      !certificateTaxRegime.trim() ? 'selecione o regime tributário' : null,
      cscValidationError,
      hasInvalidRenewAlertDays ? 'ajuste o alerta de renovação para um valor entre 1 e 180 dias' : null,
      !certificateFileName.trim() ? 'importe o A1 antes de emitir NFC-e real' : null,
      !certificateStateRegistration.trim() ? 'informe a inscrição estadual antes de emitir NFC-e real' : null
    ].filter(Boolean);
    setCertificateMessage(
      pendingWarnings.length > 0
        ? `Configuração fiscal salva com pendência: ${pendingWarnings.join('; ')}.`
        : 'Configuração do certificado digital salva com sucesso.'
    );
  };

  const onRemoveCertificateSettings = () => {
    localStorage.removeItem(CERTIFICATE_SETTINGS_STORAGE_KEY);
    setSavedCertificateSettings(null);
    clearCertificateForm();
    setCertificateMessage('Configuração de certificado removida.');
  };

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
    setMessage('A auditoria local de ações sensíveis foi limpa.');

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

  return (
    <section className="admin-page">
      <header className="card admin-header">
        <div>
          <p className="admin-eyebrow">Etapa 1 | Governanca</p>
          <h2>Painel Admin</h2>
          <p className="admin-subtitle">Controle de sincronização e trilha de ações sensíveis.</p>
        </div>
      </header>

      <div className="admin-grid">
        <article className="card admin-kpis">
          <h3>Operacional</h3>
          <p className="admin-subtitle">Monitore fila, pendências e segurança dos PINs.</p>
          <div className="admin-config-toolbar admin-compact-toolbar">
            <button type="button" onClick={() => setIsOperationalOpen(true)}>Operacional</button>
          </div>

          {isOperationalOpen && (
            <div className="fixed inset-0 z-50 bg-slate-950/75 p-3 md:p-6 flex items-center justify-center">
              <section className="w-full max-w-6xl max-h-[calc(100vh-3rem)] overflow-y-auto bg-white rounded-2xl border border-slate-200 shadow-2xl mx-auto">
                <div className="sticky top-0 z-10 bg-white px-4 py-4 border-b border-slate-200 flex items-center justify-between gap-3">
                  <div>
                    <p className="admin-eyebrow">Admin</p>
                    <h3>Operacional</h3>
                    <p className="admin-subtitle">Acompanhe fila, pendências, auditoria e PINs do sistema.</p>
                  </div>
                  <button type="button" className="button-muted" onClick={() => setIsOperationalOpen(false)}>Fechar</button>
                </div>

                <div className="p-4 space-y-4">
                  <ul>
                    <li>
                      <span>Usuário ativo</span>
                      <strong>{user ? `${user.name} (${user.role})` : 'Não autenticado'}</strong>
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
                      <span>Eventos sensíveis</span>
                      <strong>{auditEvents.length}</strong>
                    </li>
                    <li>
                      <span>PIN login fraco</span>
                      <strong>{pinHealth.loginStrengthIssues}</strong>
                    </li>
                    <li>
                      <span>PIN sensível fraco</span>
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

                  <p className="admin-message">
                    A gestão de PINs por usuário fica em Lojas e vínculos, junto ao cadastro da loja selecionada.
                  </p>
                </div>
              </section>
            </div>
          )}
        </article>

        <StoreSettingsPanel />

        <PeripheralSettingsPanel onOpenFiscalSettings={() => setIsFiscalSettingsOpen(true)} />

        <article className="card admin-audit">
          <h3>Auditoria de ações sensíveis</h3>
          <p className="admin-subtitle">
            Consulte aprovações e recusas em operações críticas.
          </p>
          <div className="admin-config-toolbar admin-compact-toolbar">
            <button type="button" onClick={() => setIsAuditOpen(true)}>Auditoria</button>
          </div>

          {isAuditOpen && (
            <div className="fixed inset-0 z-50 bg-slate-950/75 p-3 md:p-6 flex items-center justify-center">
              <section className="w-full max-w-6xl max-h-[calc(100vh-3rem)] overflow-y-auto bg-white rounded-2xl border border-slate-200 shadow-2xl mx-auto">
                <div className="sticky top-0 z-10 bg-white px-4 py-4 border-b border-slate-200 flex items-center justify-between gap-3">
                  <div>
                    <p className="admin-eyebrow">Admin</p>
                    <h3>Auditoria de ações sensíveis</h3>
                    <p className="admin-subtitle">
                      Consulte tentativas aprovadas ou negadas em operações críticas, como fechamento de comanda e cancelamentos.
                    </p>
                  </div>
                  <button type="button" className="button-muted" onClick={() => setIsAuditOpen(false)}>Fechar</button>
                </div>

                <div className="p-4 space-y-4">
          <div className="admin-audit-filters">
            <select value={actionFilter} onChange={(e) => setActionFilter(e.target.value as typeof actionFilter)}>
              {actionOptions.map((item) => (
                <option key={item} value={item}>
                  Ação: {actionLabels[item]}
                </option>
              ))}
            </select>

            <select
              value={outcomeFilter}
              onChange={(e) => setOutcomeFilter(e.target.value as typeof outcomeFilter)}
            >
              {outcomeOptions.map((item) => (
                <option key={item} value={item}>
                  Resultado: {outcomeLabels[item]}
                </option>
              ))}
            </select>

            <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value as typeof roleFilter)}>
              <option value="ALL">Perfil: Todos os perfis</option>
              {roleOptions.map((role) => (
                <option key={role} value={role}>
                  Perfil: {getRoleLabel(role)}
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
            <p className="empty-state">Nenhum evento sensível registrado.</p>
          ) : (
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Quando</th>
                    <th>Ação</th>
                    <th>Perfil</th>
                    <th>Estacao</th>
                    <th>Resultado</th>
                    <th>Motivo</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAuditEvents.map((event) => (
                    <tr key={event.id}>
                      <td>{new Date(event.createdAt).toLocaleString('pt-BR')}</td>
                      <td>{actionLabels[event.action]}</td>
                      <td>{getRoleLabel(event.actorRole)}</td>
                      <td>{event.scaleId ?? '-'}</td>
                      <td>{outcomeLabels[event.outcome]}</td>
                      <td>{event.reason ?? '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <section className="admin-margin-section">
            <h3>Análise de margem por produto</h3>
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
                </div>
              </section>
            </div>
          )}
        </article>

        <article className="card admin-home-summary">
          <div>
            <h3>Resumo do sistema</h3>
            <p className="admin-subtitle">Visão rápida dos pontos que merecem atenção antes da operação.</p>
          </div>
          <ul>
            <li>
              <span>Fila pendente</span>
              <strong>{queueSummary.total}</strong>
            </li>
            <li>
              <span>Produtos cadastrados</span>
              <strong>{products.length}</strong>
            </li>
            <li>
              <span>Eventos auditados</span>
              <strong>{auditEvents.length}</strong>
            </li>
            <li>
              <span>PINs com alerta</span>
              <strong>{pinHealth.loginStrengthIssues + pinHealth.sensitiveStrengthIssues}</strong>
            </li>
          </ul>
        </article>

        {isFiscalSettingsOpen && (
          <div className="fixed inset-0 z-50 bg-slate-950/75 p-3 md:p-6 flex items-center justify-center">
            <section className="w-full max-w-6xl max-h-[calc(100vh-3rem)] overflow-y-auto bg-white rounded-2xl border border-orange-200 shadow-2xl mx-auto">
              <div className="sticky top-0 z-10 bg-white px-4 py-4 border-b border-orange-100 flex items-center justify-between gap-3">
                <div>
                  <p className="admin-eyebrow">Configurações gerais</p>
                  <h3>Configurações Fiscais NFC-e</h3>
                  <p className="admin-subtitle">Configure dados fiscais, certificado digital e parâmetros para emissão de NFC-e.</p>
                </div>
                <button type="button" className="button-muted" onClick={() => setIsFiscalSettingsOpen(false)}>Fechar</button>
              </div>

              <article className="card admin-certificate admin-fiscal-settings admin-fiscal-settings-modal">

          <form onSubmit={onSaveCertificateSettings} className="admin-certificate-form" autoComplete="off">
            <section className="admin-fiscal-section">
              <h4>Dados da Empresa para NFC-e</h4>
              <div className="admin-fiscal-grid">
                <label>
                  Razão Social *
                  <input
                    value={certificateCompanyName}
                    onChange={(e) => setCertificateCompanyName(e.target.value)}
                    placeholder="PDVTouch Restaurante"
                  />
                </label>
                <label>
                  CNPJ *
                  <input
                    value={certificateCnpj}
                    onChange={(e) => setCertificateCnpj(formatCnpj(e.target.value))}
                    placeholder="00.000.000/0000-00"
                  />
                </label>
                <label>
                  Inscrição Estadual *
                  <input
                    value={certificateStateRegistration}
                    onChange={(e) => setCertificateStateRegistration(e.target.value)}
                    placeholder="000.000.000.000"
                  />
                </label>
                <label>
                  CNAE Principal *
                  <select value={certificateCnae} onChange={(e) => setCertificateCnae(e.target.value)}>
                    <option value="">Selecione o CNAE</option>
                    {cnaeOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Regime Tributário *
                  <select value={certificateTaxRegime} onChange={(e) => setCertificateTaxRegime(e.target.value)}>
                    <option value="">Selecione o regime</option>
                    <option value="SIMPLES_NACIONAL">Simples Nacional</option>
                    <option value="LUCRO_REAL_PRESUMIDO">Lucro Real/Presumido</option>
                    <option value="MEI">Microempreendedor Individual</option>
                  </select>
                </label>
                <label>
                  Endereço Linha 1
                  <input
                    value={certificateAddressLine1}
                    onChange={(e) => setCertificateAddressLine1(e.target.value)}
                    placeholder="Rua Exemplo, 123 - Centro"
                  />
                </label>
                <label>
                  Endereço Linha 2
                  <input
                    value={certificateAddressLine2}
                    onChange={(e) => setCertificateAddressLine2(e.target.value)}
                    placeholder="Complemento, bairro"
                  />
                </label>
                <label>
                  Cidade/UF
                  <input
                    value={certificateCityUf}
                    onChange={(e) => setCertificateCityUf(e.target.value)}
                    placeholder="São Paulo/SP"
                  />
                </label>
              </div>
            </section>

            <section className="admin-fiscal-section">
              <h4>Certificado Digital</h4>
              <div className="admin-fiscal-grid">
                <label>
                  Apelido da configuração
                  <input
                    value={certificateAlias}
                    onChange={(e) => setCertificateAlias(e.target.value)}
                    placeholder="Certificado A1 principal"
                  />
                </label>
                <label>
                  Modelo
                  <select value={certificateModel} onChange={(e) => setCertificateModel(e.target.value as CertificateModel)}>
                    {CERTIFICATE_MODEL_OPTIONS.map((option) => (
                      <option key={option} value={option}>
                        Modelo {option}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  UF
                  <select value={certificateUf} onChange={(e) => setCertificateUf(e.target.value)}>
                    {BR_UF_OPTIONS.map((option) => (
                      <option key={option} value={option}>
                        UF {option}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Senha do certificado
                  <input
                    type="password"
                    value={certificatePassword}
                    onChange={(e) => setCertificatePassword(e.target.value)}
                    placeholder="Senha do certificado"
                  />
                </label>
                <label>
                  Vencimento
                  <input
                    type="date"
                    value={certificateExpirationDate}
                    onChange={(e) => setCertificateExpirationDate(e.target.value)}
                  />
                </label>
                <label>
                  Alerta renovação (dias)
                  <input
                    type="number"
                    min={1}
                    max={180}
                    value={certificateRenewAlertDays}
                    onChange={(e) => setCertificateRenewAlertDays(e.target.value)}
                    placeholder="20"
                  />
                </label>
              </div>
            </section>

            <section className="admin-fiscal-section">
              <h4>NFC-e</h4>
              <div className="admin-fiscal-grid">
                <label>
                  Ambiente
                  <select value={certificateNfceEnvironment} onChange={(e) => setCertificateNfceEnvironment(e.target.value as 'HOMOLOGACAO' | 'PRODUCAO')}>
                    <option value="HOMOLOGACAO">Homologação</option>
                    <option value="PRODUCAO">Produção</option>
                  </select>
                </label>
                <label>
                  Série NFC-e
                  <input value={certificateNfceSerie} onChange={(e) => setCertificateNfceSerie(e.target.value)} inputMode="numeric" />
                </label>
                <label>
                  Próximo número
                  <input value={certificateNfceNextNumber} onChange={(e) => setCertificateNfceNextNumber(e.target.value)} inputMode="numeric" />
                </label>
                <label>
                  CSC ID {isCscRequired ? '*' : ''}
                  <input
                    value={certificateCscId}
                    onChange={(e) => setCertificateCscId(e.target.value)}
                    placeholder={`CSC ID${isCscRequired ? ' obrigatório' : ''}`}
                  />
                </label>
                <label>
                  CSC {isCscRequired ? '*' : ''}
                  <input
                    value={certificateCscCode}
                    onChange={(e) => setCertificateCscCode(e.target.value)}
                    placeholder={`CSC${isCscRequired ? ' obrigatório' : ''}`}
                  />
                </label>
              </div>
            </section>

            <section className="admin-fiscal-section">
              <h4>Contábil</h4>
              <div className="admin-fiscal-grid">
                <label>
                  E-mail contábil
                  <input
                    value={certificateAccountingEmail}
                    onChange={(e) => setCertificateAccountingEmail(e.target.value)}
                    placeholder="contabilidade@empresa.com.br"
                  />
                </label>
              </div>
            </section>

            <div className="products-certificate-source-buttons">
              <button type="button" onClick={() => openCertificateFilePicker('MAQUINA')}>
                Importar da máquina
              </button>
              <button type="button" className="button-muted" onClick={() => openCertificateFilePicker('PENDRIVE')}>
                Importar do pen drive
              </button>
              <input
                id="admin-certificate-file-input"
                type="file"
                accept=".pfx,.p12,.cer,.crt"
                onChange={onImportCertificateFile}
                style={{ display: 'none' }}
              />
            </div>

            <p className="admin-certificate-meta">
              Arquivo: {certificateFileName || '-'} | Tamanho: {formatCertificateFileSize(certificateFileSize)} | Origem: {certificateImportSource}
            </p>
            <p className="admin-certificate-meta">Regra UF: {getUfNfceRuleMessage(certificateUf)}</p>

            {certificateExpiryInfo?.isExpired && (
              <p className="admin-certificate-alert admin-certificate-alert-danger">Certificado vencido. A emissão fiscal ficará bloqueada.</p>
            )}
            {certificateExpiryInfo?.isNearExpire && (
              <p className="admin-certificate-alert">Certificado próximo do vencimento ({certificateExpiryInfo.daysRemaining} dia(s)).</p>
            )}

            <div className="admin-actions">
              <button type="submit">Salvar configuração fiscal</button>
              <button type="button" className="button-muted" onClick={clearCertificateForm}>
                Limpar formulário
              </button>
              <button type="button" className="admin-danger" onClick={onRemoveCertificateSettings}>
                Remover configuração
              </button>
            </div>
          </form>

          {certificateFormError && <p className="admin-message">{certificateFormError}</p>}
          {certificateMessage && <p className="admin-message">{certificateMessage}</p>}

          {savedCertificateSettings && (
            <p className="admin-certificate-meta">
              Configuração ativa: {savedCertificateSettings.alias || savedCertificateSettings.fileName} | Atualizada em {new Date(savedCertificateSettings.updatedAt).toLocaleString('pt-BR')}
            </p>
          )}
              </article>
            </section>
          </div>
        )}
      </div>
    </section>
  );
}
