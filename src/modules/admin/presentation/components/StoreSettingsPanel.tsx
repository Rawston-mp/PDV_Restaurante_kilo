import { useMemo, useState, type ChangeEvent } from 'react';

import { getRoleLabel, type Role } from '@/modules/auth/domain/types/Role';
import {
  defaultLoginPins,
  defaultSensitivePins,
  isPinFormatValid,
  readStorePins,
  saveStorePins
} from '@/modules/auth/infrastructure/local/pinPolicy';
import {
  readStoreSettings,
  saveStoreSettings,
  storeRoleOptions,
  type StoreSettings
} from '@/modules/admin/infrastructure/local/platformSettings';
import {
  formatCep,
  formatCnpj,
  formatCpf,
  isValidCep,
  isValidCnpj,
  isValidCpf,
  normalizeCep,
  normalizeCnpj,
  normalizeCpf
} from '@/shared/domain/services/documentValidation';
import { lookupCepAddress } from '@/shared/infrastructure/cep/viaCepLookup';

const getStoreRoleLabel = (role: Role) => (role === 'ADMIN' ? 'Admin da plataforma' : getRoleLabel(role));
const pinRoleOptions: Role[] = ['ADMIN', 'GERENTE', 'CAIXA', 'ATENDENTE', 'COMANDA_A', 'COMANDA_B'];

const nowIso = () => new Date().toISOString();

const createBlankStore = (): StoreSettings => {
  const timestamp = nowIso();
  return {
    id: `store-${crypto.randomUUID()}`,
    name: '',
    legalName: '',
    tradeName: '',
    logoUrl: '',
    welcomeTitle: 'Bem-vindo ao PDV!',
    welcomeSubtitle: 'Tudo pronto para você realizar ótimas vendas.',
    cnpj: '',
    stateRegistration: '',
    zipCode: '',
    address: '',
    number: '',
    complement: '',
    district: '',
    city: '',
    state: 'SP',
    foundingYear: '',
    responsibleName: '',
    responsibleCpf: '',
    active: true,
    accessNoticeEnabled: false,
    accessNoticeDays: '10',
    supportCompanyName: '',
    supportPhone: '',
    supportWhatsapp: '',
    supportEmail: '',
    allowedRoles: ['ADMIN', 'GERENTE', 'CAIXA', 'ATENDENTE', 'COMANDA_A', 'COMANDA_B'],
    createdAt: timestamp,
    updatedAt: timestamp
  };
};

export function StoreSettingsPanel() {
  const [stores, setStores] = useState<StoreSettings[]>(readStoreSettings);
  const [selectedStoreId, setSelectedStoreId] = useState(stores[0]?.id ?? '');
  const [storeSearch, setStoreSearch] = useState('');
  const [form, setForm] = useState<StoreSettings>(() => stores[0] ?? createBlankStore());
  const [message, setMessage] = useState<string | null>(null);
  const [cepMessage, setCepMessage] = useState<string | null>(null);
  const [isCepLoading, setIsCepLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [isAccessNoticeOpen, setIsAccessNoticeOpen] = useState(false);
  const [loginPins, setLoginPins] = useState<Record<Role, string>>(() => readStorePins('LOGIN', stores[0]?.id));
  const [sensitivePins, setSensitivePins] = useState<Record<Role, string>>(() => readStorePins('SENSITIVE', stores[0]?.id));

  const filteredStores = useMemo(() => {
    const query = storeSearch
      .normalize('NFD')
      .replace(/[^\x00-\x7F]/g, '')
      .toLowerCase()
      .trim();

    if (!query) {
      return stores;
    }

    return stores.filter((store) =>
      `${store.tradeName || store.name} ${store.legalName || ''}`
        .normalize('NFD')
        .replace(/[^\x00-\x7F]/g, '')
        .toLowerCase()
        .includes(query)
    );
  }, [storeSearch, stores]);

  const updateField = (field: keyof StoreSettings, value: string | boolean | Role[]) => {
    setForm((current) => ({
      ...current,
      [field]: value
    }));
  };

  const handleCepChange = async (value: string) => {
    const formattedCep = formatCep(value);
    updateField('zipCode', formattedCep);
    setCepMessage(null);

    const cep = normalizeCep(formattedCep);
    if (cep.length < 8) {
      return;
    }

    setIsCepLoading(true);
    try {
      const address = await lookupCepAddress(cep);
      if (!address) {
        setCepMessage('CEP não encontrado. Verifique o número informado.');
        return;
      }

      setForm((current) => ({
        ...current,
        zipCode: formatCep(address.cep),
        address: current.address || address.street,
        district: current.district || address.district,
        city: current.city || address.city,
        state: address.state || current.state
      }));
      setCepMessage('Endereço preenchido pelo CEP.');
    } catch {
      setCepMessage('Não foi possível consultar o CEP agora.');
    } finally {
      setIsCepLoading(false);
    }
  };

  const onLogoFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    if (!file.type.startsWith('image/')) {
      setMessage('Selecione um arquivo de imagem para o logo.');
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      setMessage('O logo deve ter no máximo 2 MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      updateField('logoUrl', String(reader.result ?? ''));
      setMessage(`Logo ${file.name} carregado do computador.`);
    };
    reader.readAsDataURL(file);
  };

  const selectStore = (store: StoreSettings) => {
    setSelectedStoreId(store.id);
    setForm({ ...store });
    setLoginPins(readStorePins('LOGIN', store.id));
    setSensitivePins(readStorePins('SENSITIVE', store.id));
    setMessage(null);
  };

  const startNewStore = () => {
    const blank = createBlankStore();
    setSelectedStoreId(blank.id);
    setForm(blank);
    setLoginPins({ ...defaultLoginPins });
    setSensitivePins({ ...defaultSensitivePins });
    setStoreSearch('');
    setMessage(null);
  };

  const reloadStores = () => {
    const loadedStores = readStoreSettings();
    setStores(loadedStores);
    const selectedStore = loadedStores.find((store) => store.id === selectedStoreId) ?? loadedStores[0];
    if (selectedStore) {
      selectStore(selectedStore);
    }
  };

  const toggleRole = (role: Role) => {
    setForm((current) => {
      const hasRole = current.allowedRoles.includes(role);
      const nextRoles = hasRole
        ? current.allowedRoles.filter((item) => item !== role)
        : [...current.allowedRoles, role];

      return {
        ...current,
        allowedRoles: nextRoles.length > 0 ? nextRoles : ['ADMIN']
      };
    });
  };

  const updateLoginPin = (role: Role, pin: string) => {
    const normalizedPin = pin.replace(/\D/g, '').slice(0, 8);
    setLoginPins((current) => ({
      ...current,
      [role]: normalizedPin
    }));
  };

  const updateSensitivePin = (role: Role, pin: string) => {
    const normalizedPin = pin.replace(/\D/g, '').slice(0, 8);
    setSensitivePins((current) => ({
      ...current,
      [role]: normalizedPin
    }));
  };

  const onSaveStore = (event: React.FormEvent) => {
    event.preventDefault();

    const legalName = form.legalName.trim();
    const tradeName = form.tradeName.trim();
    if (!legalName) {
      setMessage('Informe a razão social.');
      return;
    }

    if (!tradeName) {
      setMessage('Informe o nome fantasia.');
      return;
    }

    if (form.cnpj && !isValidCnpj(form.cnpj)) {
      setMessage('CNPJ inválido. Verifique os 14 dígitos informados.');
      return;
    }

    if (form.responsibleCpf && !isValidCpf(form.responsibleCpf)) {
      setMessage('CPF do responsável inválido. Verifique os 11 dígitos informados.');
      return;
    }

    if (form.zipCode && !isValidCep(form.zipCode)) {
      setMessage('CEP deve conter 8 dígitos.');
      return;
    }

    const invalidPinRole = pinRoleOptions.find((role) => (
      !isPinFormatValid(loginPins[role] ?? '') || !isPinFormatValid(sensitivePins[role] ?? '')
    ));
    if (invalidPinRole) {
      setMessage(`Informe PIN de login e PIN sensível com 4 a 8 dígitos para ${getRoleLabel(invalidPinRole)}.`);
      return;
    }

    const nextStore: StoreSettings = {
      ...form,
      name: tradeName,
      legalName,
      tradeName,
      cnpj: normalizeCnpj(form.cnpj),
      responsibleCpf: normalizeCpf(form.responsibleCpf),
      zipCode: normalizeCep(form.zipCode),
      updatedAt: nowIso()
    };
    const exists = stores.some((store) => store.id === nextStore.id);
    const savedStores = saveStoreSettings(
      exists
        ? stores.map((store) => (store.id === nextStore.id ? nextStore : store))
        : [...stores, nextStore]
    );

    setStores(savedStores);
    setSelectedStoreId(nextStore.id);
    setForm(nextStore);
    setLoginPins(saveStorePins('LOGIN', nextStore.id, loginPins));
    setSensitivePins(saveStorePins('SENSITIVE', nextStore.id, sensitivePins));
    setMessage(`Loja ${nextStore.tradeName} salva com vínculos e PINs de acesso.`);
  };

  return (
    <article className="card admin-config-card">
      <div className="admin-config-header">
        <div>
          <h3>Lojas e vínculos</h3>
          <p className="admin-subtitle">Cadastre lojas e defina perfis autorizados para login.</p>
        </div>
        <span>{stores.length} {stores.length === 1 ? 'loja' : 'lojas'}</span>
      </div>

      <div className="admin-config-toolbar admin-compact-toolbar">
        <button type="button" onClick={() => setIsOpen(true)}>Lojas</button>
      </div>

      {message && <p className="admin-message">{message}</p>}

      {isOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/75 p-3 md:p-6 flex items-center justify-center">
          <section className="w-full max-w-6xl max-h-[calc(100vh-3rem)] overflow-y-auto bg-white rounded-2xl border border-slate-200 shadow-2xl mx-auto">
            <div className="sticky top-0 z-10 bg-white px-4 py-4 border-b border-slate-200 flex items-center justify-between gap-3">
              <div>
                <p className="admin-eyebrow">Admin</p>
                <h3>Lojas e vínculos</h3>
                <p className="admin-subtitle">Cadastro usado no login multi-loja e no contexto operacional.</p>
              </div>
              <button type="button" className="button-muted" onClick={() => setIsOpen(false)}>Fechar</button>
            </div>

            <div className="p-4 space-y-4">
              <div className="admin-config-toolbar">
        <input
          value={storeSearch}
          onChange={(event) => setStoreSearch(event.target.value)}
          placeholder="Buscar loja por nome"
          autoComplete="off"
        />
        <select
          value={selectedStoreId}
          onChange={(event) => {
            const selectedStore = stores.find((store) => store.id === event.target.value);
            if (selectedStore) {
              selectStore(selectedStore);
            }
          }}
        >
          {stores.map((store) => (
            <option key={store.id} value={store.id}>
              {store.tradeName || store.name}
            </option>
          ))}
        </select>
        <button type="button" onClick={startNewStore}>Nova loja</button>
        <button type="button" className="button-muted" onClick={reloadStores}>Recarregar lojas</button>
              </div>

      {filteredStores.length > 0 && (
        <div className="admin-store-pills">
          {filteredStores.slice(0, 8).map((store) => (
            <button
              type="button"
              key={store.id}
              className={store.id === selectedStoreId ? 'is-selected' : ''}
              onClick={() => selectStore(store)}
            >
              {store.tradeName || store.name}
            </button>
          ))}
        </div>
      )}

      <form onSubmit={onSaveStore} className="admin-config-form" autoComplete="off">
        <section className="admin-config-section">
          <h4>Dados do estabelecimento</h4>
          <div className="admin-config-grid">
            <label>
              Razão social
              <input value={form.legalName} onChange={(event) => updateField('legalName', event.target.value)} />
            </label>
            <label>
              Nome fantasia
              <input value={form.tradeName} onChange={(event) => updateField('tradeName', event.target.value)} />
            </label>
            <label>
              Título da página inicial
              <input value={form.welcomeTitle} onChange={(event) => updateField('welcomeTitle', event.target.value)} />
            </label>
            <label>
              Subtítulo da página inicial
              <input value={form.welcomeSubtitle} onChange={(event) => updateField('welcomeSubtitle', event.target.value)} />
            </label>
            <label>
              Logo da loja
              <input value={form.logoUrl} onChange={(event) => updateField('logoUrl', event.target.value)} placeholder="URL da imagem do logo" />
              <input type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" onChange={onLogoFileChange} />
            </label>
            <label>
              CNPJ
              <input value={form.cnpj} onChange={(event) => updateField('cnpj', formatCnpj(event.target.value))} inputMode="numeric" />
            </label>
            <label>
              Inscrição estadual
              <input value={form.stateRegistration} onChange={(event) => updateField('stateRegistration', event.target.value)} />
            </label>
            <label>
              Ano de fundação
              <input value={form.foundingYear} onChange={(event) => updateField('foundingYear', event.target.value)} inputMode="numeric" />
            </label>
            <label>
              Nome do responsável
              <input value={form.responsibleName} onChange={(event) => updateField('responsibleName', event.target.value)} />
            </label>
            <label>
              CPF do responsável
              <input value={form.responsibleCpf} onChange={(event) => updateField('responsibleCpf', formatCpf(event.target.value))} inputMode="numeric" />
            </label>
          </div>
        </section>

        <section className="admin-config-section">
          <h4>Endereço completo</h4>
          <div className="admin-config-grid admin-address-grid">
            <label>
              CEP
              <input value={form.zipCode} onChange={(event) => void handleCepChange(event.target.value)} inputMode="numeric" />
            </label>
            {(isCepLoading || cepMessage) && (
              <p className="suppliers-cep-feedback">
                {isCepLoading ? 'Buscando endereço pelo CEP...' : cepMessage}
              </p>
            )}
            <label>
              Endereço
              <input value={form.address} onChange={(event) => updateField('address', event.target.value)} />
            </label>
            <label>
              Número
              <input value={form.number} onChange={(event) => updateField('number', event.target.value)} />
            </label>
            <label>
              Complemento
              <input value={form.complement} onChange={(event) => updateField('complement', event.target.value)} />
            </label>
            <label>
              Bairro
              <input value={form.district} onChange={(event) => updateField('district', event.target.value)} />
            </label>
            <label>
              Cidade
              <input value={form.city} onChange={(event) => updateField('city', event.target.value)} />
            </label>
            <label>
              UF
              <input value={form.state} onChange={(event) => updateField('state', event.target.value.toUpperCase().slice(0, 2))} />
            </label>
          </div>
        </section>

        <section className="admin-config-section">
          <div className="admin-config-section-title">
            <h4>Usuários vinculados</h4>
            <label className="admin-inline-check">
              <input
                type="checkbox"
                checked={form.active}
                onChange={(event) => updateField('active', event.target.checked)}
              />
              Loja ativa para login
            </label>
            <button type="button" className="button-muted" onClick={() => setIsAccessNoticeOpen(true)}>
              Aviso de acesso
            </button>
          </div>

          <div className="admin-role-grid">
            {storeRoleOptions.map((roleOption) => (
              <label key={roleOption}>
                <input
                  type="checkbox"
                  checked={form.allowedRoles.includes(roleOption)}
                  onChange={() => toggleRole(roleOption)}
                />
                {getStoreRoleLabel(roleOption)}
              </label>
            ))}
          </div>
          <p className="admin-help-text">Admin da plataforma mantém acesso total às lojas ativas. Os demais perfis dependem deste vínculo.</p>
        </section>

        {isAccessNoticeOpen && (
          <div className="fixed inset-0 z-50 bg-slate-950/75 p-3 md:p-6 flex items-center justify-center">
            <section className="w-full max-w-3xl max-h-[calc(100vh-3rem)] overflow-y-auto bg-white rounded-2xl border border-slate-200 shadow-2xl mx-auto">
              <div className="sticky top-0 z-10 bg-white px-4 py-4 border-b border-slate-200 flex items-center justify-between gap-3">
                <div>
                  <p className="admin-eyebrow">Lojas e vínculos</p>
                  <h3>Aviso de regularização de acesso</h3>
                  <p className="admin-subtitle">Configure a mensagem exibida para a loja antes de negar o acesso.</p>
                </div>
                <button type="button" className="button-muted" onClick={() => setIsAccessNoticeOpen(false)}>Fechar</button>
              </div>

              <div className="p-4 space-y-4">
                <label className="admin-inline-check">
                  <input
                    type="checkbox"
                    checked={form.accessNoticeEnabled}
                    onChange={(event) => updateField('accessNoticeEnabled', event.target.checked)}
                  />
                  Exibir aviso para esta loja
                </label>

                <div className="admin-config-grid">
                  <label>
                    Prazo para regularização
                    <input
                      value={form.accessNoticeDays}
                      onChange={(event) => updateField('accessNoticeDays', event.target.value.replace(/\D/g, '').slice(0, 3))}
                      inputMode="numeric"
                      placeholder="10"
                    />
                  </label>
                  <label>
                    Nome da empresa de suporte
                    <input
                      value={form.supportCompanyName}
                      onChange={(event) => updateField('supportCompanyName', event.target.value)}
                      placeholder="Ex.: Alegre Sistemas"
                    />
                  </label>
                  <label>
                    Telefone
                    <input
                      value={form.supportPhone}
                      onChange={(event) => updateField('supportPhone', event.target.value)}
                      placeholder="(00) 0000-0000"
                    />
                  </label>
                  <label>
                    WhatsApp
                    <input
                      value={form.supportWhatsapp}
                      onChange={(event) => updateField('supportWhatsapp', event.target.value)}
                      placeholder="(00) 00000-0000"
                    />
                  </label>
                  <label>
                    E-mail
                    <input
                      value={form.supportEmail}
                      onChange={(event) => updateField('supportEmail', event.target.value)}
                      placeholder="suporte@empresa.com.br"
                    />
                  </label>
                </div>

                <div className="admin-access-notice-preview">
                  <strong>Prévia do aviso</strong>
                  <p>
                    Seu acesso será negado em {form.accessNoticeDays || '10'} dia(s). Entre em contato com o suporte para regularização.
                  </p>
                  <span>{form.supportCompanyName || 'Empresa de suporte'}</span>
                  <span>{form.supportPhone || 'Telefone não informado'} | WhatsApp: {form.supportWhatsapp || 'não informado'} | {form.supportEmail || 'E-mail não informado'}</span>
                </div>
              </div>
            </section>
          </div>
        )}

        <section className="admin-config-section">
          <h4>Usuários e PINs da loja</h4>
          <p className="admin-help-text">
            Cadastre os PINs que serão usados no login desta loja. Use estes campos ao vender o sistema e configurar as senhas com o dono.
          </p>

          <div className="admin-store-pin-grid">
            {pinRoleOptions.map((roleOption) => (
              <div key={roleOption} className="admin-store-pin-card">
                <strong>{getRoleLabel(roleOption)}</strong>
                <label>
                  PIN de login
                  <input
                    value={loginPins[roleOption] ?? ''}
                    onChange={(event) => updateLoginPin(roleOption, event.target.value)}
                    inputMode="numeric"
                    placeholder="4 a 8 dígitos"
                  />
                </label>
                <label>
                  PIN sensível
                  <input
                    value={sensitivePins[roleOption] ?? ''}
                    onChange={(event) => updateSensitivePin(roleOption, event.target.value)}
                    inputMode="numeric"
                    placeholder="4 a 8 dígitos"
                  />
                </label>
              </div>
            ))}
          </div>
        </section>

        <div className="admin-actions">
          <button type="submit">Salvar loja</button>
        </div>
      </form>

      {message && <p className="admin-message">{message}</p>}
            </div>
          </section>
        </div>
      )}
    </article>
  );
}
