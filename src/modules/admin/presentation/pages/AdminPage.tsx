import { useEffect, useMemo, useState, type FormEvent } from 'react';

import { AboutSystemButton } from '@/app/AboutSystemButton';
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
import type { FiscalDocument } from '@/modules/fiscal/domain/entities/FiscalDocument';
import {
  FISCAL_GATEWAY_API_BASE_URLS,
  FISCAL_GATEWAY_RATE_LIMITS,
  FISCAL_GATEWAY_WEBHOOK_RETRY_POLICY,
  loadFiscalGatewaySettings,
  maskApiKey,
  saveFiscalGatewaySettings,
  type FiscalGatewayEnvironment,
  type FiscalGatewaySettings
} from '@/modules/fiscal/domain/services/fiscalGatewaySettings';
import { fiscalContainer } from '@/modules/fiscal/infrastructure/container/fiscalContainer';
import {
  commercialStatusLabels,
  findStoreSettingById,
  isPlatformOwnerStore,
  readPlatformOwnerSettings,
  readStoreSettings,
  savePlatformOwnerSettings,
  saveStoreSettings,
  type PlatformOwnerSettings,
  type StoreCommercialStatus,
  type StoreSettings
} from '@/modules/admin/infrastructure/local/platformSettings';
import type { Product } from '@/modules/products/domain/entities/Product';
import type { SyncQueueTask } from '@/shared/sync/domain/entities/SyncQueueTask';
import { logInfo } from '@/shared/infrastructure/logging/structuredLogger';
import {
  BR_UF_OPTIONS,
  CERTIFICATE_IMPORT_SOURCE_OPTIONS,
  CERTIFICATE_MODEL_OPTIONS,
  CERTIFICATE_SETTINGS_STORAGE_KEY,
  DEFAULT_CERTIFICATE_RENEW_ALERT_DAYS,
  SEFAZ_PRODUCTION_READY,
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

const fiscalStatusLabels: Record<FiscalDocument['status'], string> = {
  PENDING: 'Pendente',
  OFFLINE: 'Offline',
  AUTHORIZED: 'Autorizada',
  REJECTED: 'Rejeitada',
  CANCELLED: 'Cancelada',
  MANUAL_REVIEW: 'Revisão manual'
};

const sefazEnvironmentLabels: Record<'ALL' | 'HOMOLOGACAO' | 'PRODUCAO', string> = {
  ALL: 'Todos os ambientes',
  HOMOLOGACAO: 'Homologação (testes)',
  PRODUCAO: 'Produção (venda real)'
};

const sefazProductionMissingItems = [
  'Gateway real de autorização SEFAZ-SP ou API fiscal homologada',
  'Assinatura XML NFC-e com certificado A1',
  'Transmissão real para webservice da SEFAZ-SP',
  'Retorno real de protocolo, cStat, xMotivo e QR Code',
  'Contingência fiscal validada com contador antes do go-live'
];

const roleOptions: Role[] = ['ADMIN', 'GERENTE', 'CAIXA', 'ATENDENTE', 'COMANDA_A', 'COMANDA_B'];
const commercialStatusOptions: StoreCommercialStatus[] = [
  'EM_DIA',
  'AVISO_PAGAMENTO',
  'SUSPENSA',
  'CANCELADA',
  'TESTE',
  'CORTESIA'
];
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
  const [fiscalDocuments, setFiscalDocuments] = useState<FiscalDocument[]>([]);
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
  const [isPdvSefazOpen, setIsPdvSefazOpen] = useState(false);
  const [sefazEnvironmentFilter, setSefazEnvironmentFilter] = useState<'ALL' | 'HOMOLOGACAO' | 'PRODUCAO'>('ALL');
  const [isCommercialOpen, setIsCommercialOpen] = useState(false);
  const [isSupportOpen, setIsSupportOpen] = useState(false);
  const [commercialStores, setCommercialStores] = useState<StoreSettings[]>(readStoreSettings);
  const [selectedCommercialStoreId, setSelectedCommercialStoreId] = useState(commercialStores[0]?.id ?? '');
  const [ownerSettings, setOwnerSettings] = useState<PlatformOwnerSettings>(readPlatformOwnerSettings);
  const [fiscalGatewaySettings, setFiscalGatewaySettings] = useState<FiscalGatewaySettings>(loadFiscalGatewaySettings);

  const refresh = async () => {
    const tasks = await productsContainer.syncTaskQueue.listAll();
    setSyncTasks(tasks);
    setAuditEvents(listSensitiveAuditEvents());
    setFiscalDocuments(await fiscalContainer.fiscalDocumentRepository.list());
    setProducts(await productsContainer.productRepository.list());
  };

  useEffect(() => {
    void refresh();
  }, []);

  useEffect(() => {
    const refreshFiscalDocuments = () => {
      void fiscalContainer.fiscalDocumentRepository.list().then(setFiscalDocuments);
    };

    window.addEventListener('pdv.fiscal-documents-refresh', refreshFiscalDocuments);
    window.addEventListener('online', refreshFiscalDocuments);
    return () => {
      window.removeEventListener('pdv.fiscal-documents-refresh', refreshFiscalDocuments);
      window.removeEventListener('online', refreshFiscalDocuments);
    };
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
  const currentAdminStore = useMemo(
    () => (user?.storeId ? findStoreSettingById(user.storeId) : null),
    [user?.storeId]
  );
  const isPlatformAdmin = useMemo(() => {
    if (user?.role !== 'ADMIN') {
      return false;
    }

    return (
      isPlatformOwnerStore(currentAdminStore) ||
      isPlatformOwnerStore({
        id: user.storeId,
        name: user.storeName,
        legalName: user.storeName,
        tradeName: user.storeName
      })
    );
  }, [currentAdminStore, user?.role, user?.storeId, user?.storeName]);
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

  const fiscalSummary = useMemo(() => {
    const countByStatus = (status: FiscalDocument['status'], environment?: FiscalDocument['environment']) =>
      fiscalDocuments.filter((document) =>
        document.status === status && (!environment || document.environment === environment)
      ).length;

    return {
      total: fiscalDocuments.length,
      pending: countByStatus('PENDING') + countByStatus('OFFLINE'),
      authorized: countByStatus('AUTHORIZED'),
      rejected: countByStatus('REJECTED'),
      manualReview: countByStatus('MANUAL_REVIEW'),
      homologacao: {
        total: fiscalDocuments.filter((document) => document.environment === 'HOMOLOGACAO').length,
        pending: countByStatus('PENDING', 'HOMOLOGACAO') + countByStatus('OFFLINE', 'HOMOLOGACAO'),
        authorized: countByStatus('AUTHORIZED', 'HOMOLOGACAO'),
        rejected: countByStatus('REJECTED', 'HOMOLOGACAO')
      },
      producao: {
        total: fiscalDocuments.filter((document) => document.environment === 'PRODUCAO').length,
        pending: countByStatus('PENDING', 'PRODUCAO') + countByStatus('OFFLINE', 'PRODUCAO'),
        authorized: countByStatus('AUTHORIZED', 'PRODUCAO'),
        rejected: countByStatus('REJECTED', 'PRODUCAO')
      }
    };
  }, [fiscalDocuments]);

  const orderedFiscalDocuments = useMemo(() => {
    return [...fiscalDocuments]
      .filter((document) => sefazEnvironmentFilter === 'ALL' || document.environment === sefazEnvironmentFilter)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }, [fiscalDocuments, sefazEnvironmentFilter]);

  const sefazActiveEnvironment = savedCertificateSettings?.nfceEnvironment ?? certificateNfceEnvironment;

  const sefazProductionReadiness = useMemo(() => {
    const issues = [
      !certificateCompanyName.trim() ? 'Razão social não informada' : null,
      !isValidCnpj(certificateCnpj) ? 'CNPJ inválido ou ausente' : null,
      !certificateStateRegistration.trim() ? 'Inscrição estadual não informada' : null,
      !certificateCnae.trim() ? 'CNAE principal não selecionado' : null,
      !certificateTaxRegime.trim() ? 'Regime tributário não selecionado' : null,
      !certificateCscId.trim() ? 'CSC ID não informado' : null,
      !certificateCscCode.trim() ? 'CSC não informado' : null,
      !certificateFileName.trim() ? 'Certificado A1 não importado' : null
    ].filter(Boolean) as string[];

    const cscError = validateCscByUf({
      uf: certificateUf,
      cscId: certificateCscId,
      cscCode: certificateCscCode
    });

    if (cscError) {
      issues.push(cscError);
    }

    return {
      isReady: issues.length === 0,
      issues
    };
  }, [
    certificateCnae,
    certificateCnpj,
    certificateCompanyName,
    certificateCscCode,
    certificateCscId,
    certificateFileName,
    certificateStateRegistration,
    certificateTaxRegime,
    certificateUf
  ]);

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

  const onRefreshFiscalDocuments = async () => {
    setFiscalDocuments(await fiscalContainer.fiscalDocumentRepository.list());
    setMessage('Pdv_Sefaz atualizado.');
  };

  const onSelectSefazEnvironment = (environment: 'HOMOLOGACAO' | 'PRODUCAO') => {
    if (environment === 'PRODUCAO' && !SEFAZ_PRODUCTION_READY) {
      setMessage('Produção bloqueada: configure e valide o gateway real SEFAZ-SP/API fiscal antes de vender com NFC-e real.');
      return;
    }

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
      nfceEnvironment: environment,
      nfceSerie: certificateNfceSerie,
      nfceNextNumber: certificateNfceNextNumber,
      accountingEmail: certificateAccountingEmail,
      fileName: certificateFileName,
      fileSize: certificateFileSize ?? 0,
      fileExtension: certificateFileExtension,
      importSource: certificateImportSource,
      expirationDate: certificateExpirationDate,
      renewAlertDays: Number(certificateRenewAlertDays) || DEFAULT_CERTIFICATE_RENEW_ALERT_DAYS,
      importedAt: certificateImportedAt,
      updatedAt: new Date().toISOString()
    };

    localStorage.setItem(CERTIFICATE_SETTINGS_STORAGE_KEY, JSON.stringify(settings));
    setCertificateNfceEnvironment(environment);
    setSavedCertificateSettings(settings);
    setMessage(
      environment === 'PRODUCAO'
        ? 'Ambiente Produção selecionado. Confirme certificado, CSC e emissor real antes de venda fiscal.'
        : 'Ambiente Homologação selecionado para testes fiscais.'
    );
  };

  const updateFiscalGatewaySettings = <Field extends keyof FiscalGatewaySettings>(
    field: Field,
    value: FiscalGatewaySettings[Field]
  ) => {
    setFiscalGatewaySettings((current) => ({
      ...current,
      [field]: value
    }));
  };

  const onSaveFiscalGatewaySettings = () => {
    const savedSettings = saveFiscalGatewaySettings(fiscalGatewaySettings);
    setFiscalGatewaySettings(savedSettings);
    setMessage('Configuração do Gateway Fiscal PDVTouch salva no Pdv_Sefaz.');
  };

  const onRetryFiscalDocument = async (document: FiscalDocument) => {
    await fiscalContainer.fiscalDocumentRepository.save({
      ...document,
      status: document.status === 'AUTHORIZED' ? document.status : 'PENDING',
      nextRetryAt: new Date(),
      updatedAt: new Date()
    });

    const processed = await fiscalContainer.retryPendingFiscalDocuments.execute();
    setFiscalDocuments(await fiscalContainer.fiscalDocumentRepository.list());
    setMessage(
      processed.length > 0
        ? `Pdv_Sefaz processou ${processed.length} documento(s).`
        : 'Nenhum documento fiscal estava pronto para reenvio.'
    );
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

  const selectedCommercialStore =
    commercialStores.find((store) => store.id === selectedCommercialStoreId) ?? commercialStores[0] ?? null;

  const refreshCommercialStores = () => {
    const stores = readStoreSettings();
    setCommercialStores(stores);
    setSelectedCommercialStoreId((current) => (
      stores.some((store) => store.id === current) ? current : stores[0]?.id ?? ''
    ));
  };

  const updateCommercialStore = (field: keyof StoreSettings, value: string | boolean) => {
    if (!selectedCommercialStore) {
      return;
    }

    setCommercialStores((current) => current.map((store) => (
      store.id === selectedCommercialStore.id
        ? {
            ...store,
            [field]: value,
            accessNoticeEnabled:
              field === 'commercialStatus'
                ? value === 'AVISO_PAGAMENTO'
                : store.accessNoticeEnabled,
            accessNoticeDays:
              field === 'graceDays'
                ? String(value)
                : store.accessNoticeDays,
            updatedAt: new Date().toISOString()
          }
        : store
    )));
  };

  const saveCommercialStore = () => {
    const savedStores = saveStoreSettings(commercialStores);
    setCommercialStores(savedStores);
    setMessage('Controle comercial da loja salvo.');
  };

  const updateOwnerSettings = (field: keyof PlatformOwnerSettings, value: string) => {
    setOwnerSettings((current) => ({
      ...current,
      [field]: value
    }));
  };

  const saveOwnerSupportSettings = () => {
    const savedSettings = savePlatformOwnerSettings(ownerSettings);
    setOwnerSettings(savedSettings);
    setMessage('Dados de suporte da Alegre Sistemas salvos.');
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
                    {isPlatformAdmin
                      ? 'A gestão de PINs por usuário fica em Lojas e vínculos, junto ao cadastro da loja selecionada.'
                      : 'A gestão de lojas, contratos e PINs mestres é restrita à Alegre Sistemas. Este painel mostra apenas a operação da loja atual.'}
                  </p>
                </div>
              </section>
            </div>
          )}
        </article>

        {isPlatformAdmin && (
          <>
            <StoreSettingsPanel />

            <article className="card admin-config-card">
              <div className="admin-config-header">
                <div>
                  <h3>Controle comercial</h3>
                  <p className="admin-subtitle">
                    Acompanhe mensalidade, período de acesso e bloqueio comercial das lojas vendidas.
                  </p>
                </div>
                <span>Alegre Sistemas</span>
              </div>
              <div className="admin-config-toolbar admin-compact-toolbar">
                <button
                  type="button"
                  onClick={() => {
                    refreshCommercialStores();
                    setIsCommercialOpen(true);
                  }}
                >
                  Comercial
                </button>
              </div>
            </article>

            <article className="card admin-config-card">
              <div className="admin-config-header">
                <div>
                  <h3>Suporte</h3>
                  <p className="admin-subtitle">
                    Configure os contatos exibidos para clientes com aviso ou bloqueio de acesso.
                  </p>
                </div>
              </div>
              <div className="admin-config-toolbar admin-compact-toolbar">
                <button type="button" onClick={() => setIsSupportOpen(true)}>Suporte</button>
              </div>
            </article>
          </>
        )}

        <PeripheralSettingsPanel onOpenFiscalSettings={() => setIsFiscalSettingsOpen(true)} />

        <article className="card admin-config-card">
          <div className="admin-config-header">
            <div>
              <h3>Pdv_Sefaz</h3>
              <p className="admin-subtitle">
                Acompanhe NFC-e pendentes, offline, autorizadas e rejeitadas.
              </p>
            </div>
            <span>{fiscalSummary.pending} pend.</span>
          </div>
          <div className="admin-config-toolbar admin-compact-toolbar">
            <button type="button" onClick={() => setIsPdvSefazOpen(true)}>Abrir Pdv_Sefaz</button>
          </div>

          {isPdvSefazOpen && (
            <div className="fixed inset-0 z-50 bg-slate-950/75 p-3 md:p-6 flex items-center justify-center">
              <section className="w-full max-w-6xl max-h-[calc(100vh-3rem)] overflow-y-auto bg-white rounded-2xl border border-slate-200 shadow-2xl mx-auto">
                <div className="sticky top-0 z-10 bg-white px-4 py-4 border-b border-slate-200 flex items-center justify-between gap-3">
                  <div>
                    <p className="admin-eyebrow">Fiscal</p>
                    <h3>Pdv_Sefaz</h3>
                    <p className="admin-subtitle">
                      Controle de ambiente, pendências e reenvio automático das NFC-e.
                    </p>
                  </div>
                  <button type="button" className="button-muted" onClick={() => setIsPdvSefazOpen(false)}>Fechar</button>
                </div>

                <div className="p-4 space-y-4">
                  <section className="grid grid-cols-1 lg:grid-cols-3 gap-3">
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                      <p className="admin-eyebrow relative inline-flex group cursor-help">
                        Ambiente ativo
                        {!SEFAZ_PRODUCTION_READY && (
                          <span className="pointer-events-none absolute left-0 top-6 z-20 hidden w-80 max-w-[80vw] rounded-xl border border-amber-200 bg-white p-3 text-xs normal-case tracking-normal text-slate-700 shadow-2xl group-hover:block">
                            <strong className="block text-amber-700">Produção ainda bloqueada</strong>
                            {sefazProductionMissingItems.map((item) => (
                              <span key={item} className="mt-1 block">- {item}</span>
                            ))}
                          </span>
                        )}
                      </p>
                      <h4>{SEFAZ_PRODUCTION_READY ? sefazEnvironmentLabels[sefazActiveEnvironment] : 'Homologação (testes)'}</h4>
                      <p className="admin-subtitle">
                        Homologação é o ambiente disponível para testes fiscais até a integração real com a SEFAZ estar validada.
                      </p>
                      <div className="admin-config-toolbar admin-compact-toolbar mt-3">
                        <button
                          type="button"
                          className="bg-sky-600 text-white border-sky-700"
                          onClick={() => onSelectSefazEnvironment('HOMOLOGACAO')}
                        >
                          Homologação
                        </button>
                        <button
                          type="button"
                          disabled={!SEFAZ_PRODUCTION_READY}
                          title={
                            SEFAZ_PRODUCTION_READY
                              ? 'Usar ambiente de produção para venda real'
                              : `Produção bloqueada: ${sefazProductionMissingItems.join('; ')}`
                          }
                          className={
                            SEFAZ_PRODUCTION_READY && sefazActiveEnvironment === 'PRODUCAO'
                              ? 'bg-emerald-600 text-white border-emerald-700'
                              : 'button-muted opacity-60 cursor-not-allowed'
                          }
                          onClick={() => onSelectSefazEnvironment('PRODUCAO')}
                        >
                          Produção
                        </button>
                      </div>
                    </div>

                    <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
                      <p className="admin-eyebrow">Emissor</p>
                      <h4>Desenvolvimento / Simulador</h4>
                      <p className="admin-subtitle">
                        A fila, o offline e o reenvio estão prontos. Para venda real, conecte o gateway SEFAZ-SP direto ou uma API fiscal homologada.
                      </p>
                    </div>

                    <div className="rounded-xl border border-slate-200 bg-white p-4">
                      <p className="admin-eyebrow">Prontidão para produção</p>
                      <h4>{sefazProductionReadiness.isReady ? 'Cadastro fiscal completo' : `${sefazProductionReadiness.issues.length} pendência(s)`}</h4>
                      {sefazProductionReadiness.isReady ? (
                        <p className="admin-subtitle">Dados mínimos informados. Falta apenas validar o emissor real antes do go-live.</p>
                      ) : (
                        <ul className="mt-2 space-y-1 text-xs text-slate-600">
                          {sefazProductionReadiness.issues.slice(0, 5).map((issue) => (
                            <li key={issue}>- {issue}</li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </section>

                  <section className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="rounded-xl border border-sky-200 bg-sky-50 p-4">
                      <h4>Homologação (testes)</h4>
                      <div className="grid grid-cols-4 gap-2 text-center">
                        <span>Total<br /><strong>{fiscalSummary.homologacao.total}</strong></span>
                        <span>Pend.<br /><strong>{fiscalSummary.homologacao.pending}</strong></span>
                        <span>Aut.<br /><strong>{fiscalSummary.homologacao.authorized}</strong></span>
                        <span>Rej.<br /><strong>{fiscalSummary.homologacao.rejected}</strong></span>
                      </div>
                    </div>
                    <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                      <h4>Produção (venda real)</h4>
                      <div className="grid grid-cols-4 gap-2 text-center">
                        <span>Total<br /><strong>{fiscalSummary.producao.total}</strong></span>
                        <span>Pend.<br /><strong>{fiscalSummary.producao.pending}</strong></span>
                        <span>Aut.<br /><strong>{fiscalSummary.producao.authorized}</strong></span>
                        <span>Rej.<br /><strong>{fiscalSummary.producao.rejected}</strong></span>
                      </div>
                    </div>
                  </section>

                  <section className="rounded-xl border border-slate-200 bg-white p-4 space-y-4">
                    <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                      <div>
                        <p className="admin-eyebrow">Gateway Fiscal PDVTouch</p>
                        <h4>Nossa API fiscal assíncrona, webhooks e contingência</h4>
                        <p className="admin-subtitle">
                          O PDV enfileira a NFC-e, nossa API fiscal processa em segundo plano e retorna status por webhook ou consulta.
                        </p>
                      </div>
                      <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700">
                        {fiscalGatewaySettings.enabled ? 'Configurada' : 'Não configurada'}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <label>
                        Ambiente da API fiscal
                        <select
                          value={fiscalGatewaySettings.environment}
                          onChange={(event) => updateFiscalGatewaySettings('environment', event.target.value as FiscalGatewayEnvironment)}
                        >
                          <option value="SANDBOX">Sandbox - testes</option>
                          <option value="PRODUCTION">Produção - venda real</option>
                        </select>
                      </label>
                      <label>
                        URL base
                        <input value={FISCAL_GATEWAY_API_BASE_URLS[fiscalGatewaySettings.environment]} readOnly />
                      </label>
                      <label>
                        Endpoint NFC-e
                        <input value="/fiscal/nfce" readOnly />
                      </label>
                      <label>
                        API Key sandbox
                        <input
                          value={fiscalGatewaySettings.sandboxApiKey}
                          onChange={(event) => updateFiscalGatewaySettings('sandboxApiKey', event.target.value)}
                          placeholder="X-Api-Key do nosso sandbox"
                        />
                      </label>
                      <label>
                        API Key produção
                        <input
                          value={fiscalGatewaySettings.productionApiKey}
                          onChange={(event) => updateFiscalGatewaySettings('productionApiKey', event.target.value)}
                          placeholder="X-Api-Key da nossa produção"
                        />
                      </label>
                      <label>
                        Webhook URL
                        <input
                          value={fiscalGatewaySettings.webhookUrl}
                          onChange={(event) => updateFiscalGatewaySettings('webhookUrl', event.target.value)}
                          placeholder="https://seu-dominio.com/fiscal/webhooks/status"
                        />
                      </label>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
                      <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                        <strong>Autenticação</strong>
                        <p className="admin-subtitle">Enviar header `X-Api-Key` em todas as requisições.</p>
                        <p className="text-xs text-slate-600">Sandbox: {maskApiKey(fiscalGatewaySettings.sandboxApiKey)}</p>
                        <p className="text-xs text-slate-600">Produção: {maskApiKey(fiscalGatewaySettings.productionApiKey)}</p>
                      </div>
                      <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                        <strong>Rate limit</strong>
                        <p className="admin-subtitle">
                          {FISCAL_GATEWAY_RATE_LIMITS.requestsPerMinute} req/min e {FISCAL_GATEWAY_RATE_LIMITS.requestsPerSecond} req/s.
                        </p>
                        <p className="text-xs text-slate-600">Em HTTP 429, respeitar `x-rate-limit-reset` antes de tentar novamente.</p>
                      </div>
                      <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                        <strong>Contingência NFC-e</strong>
                        <label className="mt-2 flex items-center gap-2 text-xs">
                          <input
                            type="checkbox"
                            checked={fiscalGatewaySettings.allowOfflineContingency}
                            onChange={(event) => updateFiscalGatewaySettings('allowOfflineContingency', event.target.checked)}
                          />
                          Habilitar empresa para contingência offline quando nossa API fiscal e a SEFAZ permitirem.
                        </label>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                      <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                        <strong>Fluxo assíncrono</strong>
                        <ol className="mt-2 space-y-1 text-xs text-slate-700">
                          <li>1. PDV envia a NFC-e para nossa API fiscal.</li>
                          <li>2. A API valida, registra idempotência e retorna `enqueued`.</li>
                          <li>3. O worker fiscal transmite para a SEFAZ em segundo plano.</li>
                          <li>4. Webhook ou consulta atualiza para `authorized`, `rejected`, `canceled` ou `inContingent`.</li>
                        </ol>
                      </div>
                      <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                        <strong>Política de retry do webhook</strong>
                        <div className="mt-2 grid grid-cols-5 gap-2 text-center text-xs">
                          {FISCAL_GATEWAY_WEBHOOK_RETRY_POLICY.map((retry) => (
                            <span key={retry.attempt} className="rounded-lg bg-white p-2">
                              {retry.attempt}ª<br />
                              <strong>{retry.interval}</strong>
                            </span>
                          ))}
                        </div>
                        <p className="mt-2 text-xs text-slate-600">
                          Após 5 falhas consecutivas, o webhook pode ser desabilitado e será necessário reconciliar por consulta.
                        </p>
                      </div>
                    </div>

                    <div className="admin-config-toolbar admin-compact-toolbar">
                      <button
                        type="button"
                        onClick={() => updateFiscalGatewaySettings('enabled', !fiscalGatewaySettings.enabled)}
                        className={fiscalGatewaySettings.enabled ? undefined : 'button-muted'}
                      >
                        {fiscalGatewaySettings.enabled ? 'Gateway ativo' : 'Ativar gateway'}
                      </button>
                      <button type="button" onClick={onSaveFiscalGatewaySettings}>Salvar gateway</button>
                    </div>
                  </section>

                  <ul className="grid grid-cols-2 md:grid-cols-5 gap-3">
                    <li className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                      <span>Total</span>
                      <strong className="block text-xl">{fiscalSummary.total}</strong>
                    </li>
                    <li className="rounded-xl border border-amber-200 bg-amber-50 p-3">
                      <span>Pendentes/offline</span>
                      <strong className="block text-xl text-amber-700">{fiscalSummary.pending}</strong>
                    </li>
                    <li className="rounded-xl border border-emerald-200 bg-emerald-50 p-3">
                      <span>Autorizadas</span>
                      <strong className="block text-xl text-emerald-700">{fiscalSummary.authorized}</strong>
                    </li>
                    <li className="rounded-xl border border-red-200 bg-red-50 p-3">
                      <span>Rejeitadas</span>
                      <strong className="block text-xl text-red-700">{fiscalSummary.rejected}</strong>
                    </li>
                    <li className="rounded-xl border border-sky-200 bg-sky-50 p-3">
                      <span>Revisão manual</span>
                      <strong className="block text-xl text-sky-700">{fiscalSummary.manualReview}</strong>
                    </li>
                  </ul>

                  <div className="admin-actions">
                    <select
                      value={sefazEnvironmentFilter}
                      onChange={(event) => setSefazEnvironmentFilter(event.target.value as typeof sefazEnvironmentFilter)}
                    >
                      {(['ALL', 'HOMOLOGACAO', 'PRODUCAO'] as const).map((environment) => (
                        <option key={environment} value={environment}>
                          {sefazEnvironmentLabels[environment]}
                        </option>
                      ))}
                    </select>
                    <button type="button" onClick={() => void onRefreshFiscalDocuments()}>
                      Atualizar Pdv_Sefaz
                    </button>
                    <button
                      type="button"
                      className="button-muted"
                      onClick={() => void fiscalContainer.retryPendingFiscalDocuments.execute().then(onRefreshFiscalDocuments)}
                    >
                      Reenviar pendências
                    </button>
                  </div>

                  {orderedFiscalDocuments.length === 0 ? (
                    <p className="empty-state">
                      Nenhum documento fiscal registrado. As NFC-e aparecerão aqui após vendas fiscais no caixa.
                    </p>
                  ) : (
                    <div className="admin-table-wrap">
                      <table className="admin-table">
                        <thead>
                          <tr>
                            <th>Emissão</th>
                            <th>Venda</th>
                            <th>NFC-e</th>
                            <th>Status</th>
                            <th>Valor</th>
                            <th>Tent.</th>
                            <th>Motivo</th>
                            <th>Ações</th>
                          </tr>
                        </thead>
                        <tbody>
                          {orderedFiscalDocuments.map((document) => (
                            <tr key={document.id}>
                              <td>{new Date(document.createdAt).toLocaleString('pt-BR')}</td>
                              <td>{document.saleId}</td>
                              <td>
                                Série {document.series} nº {document.number}
                                <br />
                                <small>{document.environment}</small>
                              </td>
                              <td>{fiscalStatusLabels[document.status]}</td>
                              <td>{currency.format(document.payload.totalDocumento)}</td>
                              <td>{document.attempts}</td>
                              <td>{document.xmotivo ?? document.lastError ?? '-'}</td>
                              <td>
                                <button
                                  type="button"
                                  disabled={document.status === 'AUTHORIZED' || document.status === 'CANCELLED'}
                                  onClick={() => void onRetryFiscalDocument(document)}
                                >
                                  Reenviar agora
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  <p className="admin-message">
                    Produção exige certificado A1 válido, CSC/CSC ID, dados da empresa, produtos fiscais corretos e gateway real de autorização. O modo atual é seguro para desenvolvimento e homologação visual do fluxo.
                  </p>
                </div>
              </section>
            </div>
          )}
        </article>

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

        {isPlatformAdmin && isCommercialOpen && (
          <div className="fixed inset-0 z-50 bg-slate-950/75 p-3 md:p-6 flex items-center justify-center">
            <section className="w-full max-w-5xl max-h-[calc(100vh-3rem)] overflow-y-auto bg-white rounded-2xl border border-slate-200 shadow-2xl mx-auto">
              <div className="sticky top-0 z-10 bg-white px-4 py-4 border-b border-slate-200 flex items-center justify-between gap-3">
                <div>
                  <p className="admin-eyebrow">Alegre Sistemas</p>
                  <h3>Controle comercial de lojas</h3>
                  <p className="admin-subtitle">
                    Controle mensalidade, status de acesso e aviso de regularização sem alterar o cadastro operacional da loja.
                  </p>
                </div>
                <button type="button" className="button-muted" onClick={() => setIsCommercialOpen(false)}>Fechar</button>
              </div>

              <div className="p-4 space-y-4">
                <div className="admin-config-toolbar">
                  <label>
                    Loja
                    <select
                      value={selectedCommercialStore?.id ?? ''}
                      onChange={(event) => setSelectedCommercialStoreId(event.target.value)}
                    >
                      {commercialStores.map((store) => (
                        <option key={store.id} value={store.id}>
                          {store.tradeName || store.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <button type="button" className="button-muted" onClick={refreshCommercialStores}>Recarregar lojas</button>
                </div>

                {selectedCommercialStore ? (
                  <>
                    <section className="admin-config-section">
                      <h4>Contrato e acesso</h4>
                      <div className="admin-commercial-grid">
                        <label>
                          Status comercial
                          <select
                            value={selectedCommercialStore.commercialStatus}
                            onChange={(event) => updateCommercialStore('commercialStatus', event.target.value as StoreCommercialStatus)}
                          >
                            {commercialStatusOptions.map((status) => (
                              <option key={status} value={status}>
                                {commercialStatusLabels[status]}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label>
                          Mensalidade
                          <input
                            value={selectedCommercialStore.monthlyFee}
                            onChange={(event) => updateCommercialStore('monthlyFee', event.target.value)}
                            placeholder="Ex.: R$ 199,90"
                          />
                        </label>
                        <label>
                          Vencimento
                          <input
                            type="date"
                            value={selectedCommercialStore.paymentDueDate}
                            onChange={(event) => updateCommercialStore('paymentDueDate', event.target.value)}
                          />
                        </label>
                        <label>
                          Prazo do aviso
                          <input
                            value={selectedCommercialStore.graceDays}
                            onChange={(event) => updateCommercialStore('graceDays', event.target.value.replace(/\D/g, '').slice(0, 3))}
                            inputMode="numeric"
                            placeholder="10"
                          />
                        </label>
                        <label>
                          Bloqueio previsto
                          <input
                            type="date"
                            value={selectedCommercialStore.accessBlockedAt}
                            onChange={(event) => updateCommercialStore('accessBlockedAt', event.target.value)}
                          />
                        </label>
                      </div>
                    </section>

                    <section className="admin-config-section">
                      <h4>Observações comerciais</h4>
                      <textarea
                        className="admin-textarea"
                        value={selectedCommercialStore.commercialNotes}
                        onChange={(event) => updateCommercialStore('commercialNotes', event.target.value)}
                        placeholder="Ex.: cliente em negociação, boleto reenviado, liberar por cortesia até..."
                      />
                    </section>

                    <div className="admin-access-notice-preview">
                      <strong>Prévia exibida no login</strong>
                      <p>
                        {selectedCommercialStore.commercialStatus === 'SUSPENSA' ||
                        selectedCommercialStore.commercialStatus === 'CANCELADA'
                          ? 'O acesso desta loja está temporariamente bloqueado. Entre em contato com o suporte para regularização.'
                          : `Seu acesso será negado em ${selectedCommercialStore.graceDays || '10'} dia(s). Entre em contato com o suporte para regularização.`}
                      </p>
                      <span>{ownerSettings.companyName || 'Alegre Sistemas'}</span>
                      <span>
                        {ownerSettings.phone || 'Telefone não informado'} | WhatsApp: {ownerSettings.whatsapp || 'não informado'} | {ownerSettings.email || 'E-mail não informado'}
                      </span>
                    </div>

                    <div className="admin-actions">
                      <button type="button" onClick={saveCommercialStore}>Salvar controle comercial</button>
                    </div>
                  </>
                ) : (
                  <p className="empty-state">Nenhuma loja cadastrada para controle comercial.</p>
                )}
              </div>
            </section>
          </div>
        )}

        {isPlatformAdmin && isSupportOpen && (
          <div className="fixed inset-0 z-50 bg-slate-950/75 p-3 md:p-6 flex items-center justify-center">
            <section className="w-full max-w-4xl max-h-[calc(100vh-3rem)] overflow-y-auto bg-white rounded-2xl border border-slate-200 shadow-2xl mx-auto">
              <div className="sticky top-0 z-10 bg-white px-4 py-4 border-b border-slate-200 flex items-center justify-between gap-3">
                <div>
                  <p className="admin-eyebrow">Alegre Sistemas</p>
                  <h3>Dados de suporte</h3>
                  <p className="admin-subtitle">Informações exibidas nos avisos de regularização e na página Sobre.</p>
                </div>
                <button type="button" className="button-muted" onClick={() => setIsSupportOpen(false)}>Fechar</button>
              </div>

              <div className="p-4 space-y-4">
                <div className="admin-commercial-grid">
                  <label>
                    Nome da empresa
                    <input value={ownerSettings.companyName} onChange={(event) => updateOwnerSettings('companyName', event.target.value)} />
                  </label>
                  <label>
                    Responsável/desenvolvedor
                    <input value={ownerSettings.developerName} onChange={(event) => updateOwnerSettings('developerName', event.target.value)} />
                  </label>
                  <label>
                    Tempo de atuação
                    <input value={ownerSettings.yearsActive} onChange={(event) => updateOwnerSettings('yearsActive', event.target.value)} placeholder="Ex.: 5 anos" />
                  </label>
                  <label>
                    Telefone
                    <input value={ownerSettings.phone} onChange={(event) => updateOwnerSettings('phone', event.target.value)} />
                  </label>
                  <label>
                    WhatsApp
                    <input value={ownerSettings.whatsapp} onChange={(event) => updateOwnerSettings('whatsapp', event.target.value)} />
                  </label>
                  <label>
                    E-mail
                    <input value={ownerSettings.email} onChange={(event) => updateOwnerSettings('email', event.target.value)} />
                  </label>
                  <label>
                    Site
                    <input value={ownerSettings.website} onChange={(event) => updateOwnerSettings('website', event.target.value)} placeholder="https://..." />
                  </label>
                </div>

                <label className="admin-config-field">
                  Mensagem de suporte
                  <textarea
                    className="admin-textarea"
                    value={ownerSettings.supportMessage}
                    onChange={(event) => updateOwnerSettings('supportMessage', event.target.value)}
                  />
                </label>
                <label className="admin-config-field">
                  Texto sobre a empresa
                  <textarea
                    className="admin-textarea"
                    value={ownerSettings.aboutText}
                    onChange={(event) => updateOwnerSettings('aboutText', event.target.value)}
                  />
                </label>

                <div className="admin-actions">
                  <button type="button" onClick={saveOwnerSupportSettings}>Salvar suporte</button>
                </div>
              </div>
            </section>
          </div>
        )}

        <AboutSystemButton />

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
