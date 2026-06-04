import { useEffect, useMemo, useState, type FormEvent } from 'react';

import { suppliersContainer } from '@/modules/suppliers/infrastructure/container/suppliersContainer';
import { useCreateSupplier } from '@/modules/suppliers/presentation/hooks/useCreateSupplier';
import { useSuppliersQuery } from '@/modules/suppliers/presentation/hooks/useSuppliersQuery';

const stateOptions = [
  'AC', 'AL', 'AM', 'AP', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MG', 'MS', 'MT',
  'PA', 'PB', 'PE', 'PI', 'PR', 'RJ', 'RN', 'RO', 'RR', 'RS', 'SC', 'SE', 'SP', 'TO'
];

const parseLegacySupplierCode = (legalName: string) => {
  const [firstChunk] = legalName.split(' - ');
  return /^\d{2,5}$/.test(firstChunk) ? firstChunk : null;
};

const getUsedSupplierCodes = (suppliers: Array<{ supplierCode?: string; legalName: string }>) => {
  const usedCodes = new Set<string>();

  for (const supplier of suppliers) {
    const code = supplier.supplierCode ?? parseLegacySupplierCode(supplier.legalName);
    if (code) {
      usedCodes.add(code);
    }
  }

  return usedCodes;
};

const generateRandomSupplierCode = (usedCodes: Set<string>) => {
  for (let attempts = 0; attempts < 300; attempts += 1) {
    const candidate = String(Math.floor(Math.random() * 999) + 1).padStart(3, '0');
    if (!usedCodes.has(candidate)) {
      return candidate;
    }
  }

  for (let fallback = 1000; fallback <= 99999; fallback += 1) {
    const candidate = String(fallback);
    if (!usedCodes.has(candidate)) {
      return candidate;
    }
  }

  return String(Date.now()).slice(-5);
};

const isFilled = (value: string) => value.trim().length > 0;

const normalizeDigits = (value: string) => value.replace(/\D/g, '');

const normalizeCepDigits = (value: string) => value.replace(/\D/g, '').slice(0, 8);

const formatCep = (value: string) => {
  const digits = normalizeCepDigits(value);

  if (digits.length <= 5) {
    return digits;
  }

  return `${digits.slice(0, 5)}-${digits.slice(5, 8)}`;
};

const formatCpfCnpj = (value: string) => {
  const digits = normalizeDigits(value).slice(0, 14);

  if (digits.length <= 11) {
    if (digits.length <= 3) {
      return digits;
    }

    if (digits.length <= 6) {
      return `${digits.slice(0, 3)}.${digits.slice(3)}`;
    }

    if (digits.length <= 9) {
      return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
    }

    return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9, 11)}`;
  }

  if (digits.length <= 2) {
    return digits;
  }

  if (digits.length <= 5) {
    return `${digits.slice(0, 2)}.${digits.slice(2)}`;
  }

  if (digits.length <= 8) {
    return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5)}`;
  }

  if (digits.length <= 12) {
    return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8)}`;
  }

  return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(12, 14)}`;
};

const formatPhone = (value: string) => {
  const digits = normalizeDigits(value).slice(0, 11);

  if (digits.length <= 2) {
    return digits;
  }

  const ddd = digits.slice(0, 2);

  if (digits.length <= 6) {
    return `(${ddd}) ${digits.slice(2)}`;
  }

  if (digits.length <= 10) {
    return `(${ddd}) ${digits.slice(2, 6)}-${digits.slice(6, 10)}`;
  }

  return `(${ddd}) ${digits.slice(2, 7)}-${digits.slice(7, 11)}`;
};

type ViaCepResponse = {
  cep?: string;
  logradouro?: string;
  bairro?: string;
  localidade?: string;
  uf?: string;
  erro?: boolean;
};

export function CadastroPage() {
  const { suppliers, setSuppliers } = useSuppliersQuery();
  const { createSupplier, saving } = useCreateSupplier();

  const [activeTab, setActiveTab] = useState<'FORNECEDORES'>('FORNECEDORES');
  const [showCadastroSpan, setShowCadastroSpan] = useState(false);
  const [editingSupplierId, setEditingSupplierId] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const [supplierCode, setSupplierCode] = useState('');
  const [cpfCnpj, setCpfCnpj] = useState('');
  const [stateRegistration, setStateRegistration] = useState('');
  const [legalName, setLegalName] = useState('');
  const [tradeName, setTradeName] = useState('');
  const [cep, setCep] = useState('');
  const [address, setAddress] = useState('');
  const [number, setNumber] = useState('');
  const [neighborhood, setNeighborhood] = useState('');
  const [state, setState] = useState('SP');
  const [city, setCity] = useState('');
  const [complement, setComplement] = useState('');
  const [serviceFee, setServiceFee] = useState('');
  const [phone, setPhone] = useState('');
  const [mobile, setMobile] = useState('');
  const [email, setEmail] = useState('');
  const [cepSuggestionMessage, setCepSuggestionMessage] = useState<string | null>(null);
  const [isCepLookupLoading, setIsCepLookupLoading] = useState(false);

  useEffect(() => {
    const cepDigits = normalizeCepDigits(cep);

    if (cepDigits.length < 8) {
      setIsCepLookupLoading(false);
      setCepSuggestionMessage(null);
      return;
    }

    const controller = new AbortController();

    const lookupTimer = window.setTimeout(async () => {
      try {
        setIsCepLookupLoading(true);

        const response = await fetch(`https://viacep.com.br/ws/${cepDigits}/json/`, {
          signal: controller.signal
        });

        if (!response.ok) {
          throw new Error('Falha na consulta de CEP.');
        }

        const data = (await response.json()) as ViaCepResponse;

        if (data.erro) {
          setCepSuggestionMessage('CEP nao encontrado para sugestao de endereco.');
          return;
        }

        setAddress((prev) => (isFilled(prev) ? prev : data.logradouro ?? ''));
        setNeighborhood((prev) => (isFilled(prev) ? prev : data.bairro ?? ''));
        setCity((prev) => (isFilled(prev) ? prev : data.localidade ?? ''));
        setState((prev) => (isFilled(prev) ? prev : data.uf ?? prev));

        const suggestedCity = data.localidade ?? city;
        const suggestedUf = data.uf ?? state;
        setCepSuggestionMessage(`Sugestao aplicada: ${suggestedCity}/${suggestedUf}.`);
      } catch (error) {
        if (!controller.signal.aborted) {
          setCepSuggestionMessage('Nao foi possivel consultar o CEP agora.');
        }
      } finally {
        if (!controller.signal.aborted) {
          setIsCepLookupLoading(false);
        }
      }
    }, 450);

    return () => {
      controller.abort();
      window.clearTimeout(lookupTimer);
    };
  }, [cep, city, state]);

  const generateCodeForCurrentCatalog = () => {
    const usedCodes = getUsedSupplierCodes(suppliers);
    return generateRandomSupplierCode(usedCodes);
  };

  const clearForm = (nextCode?: string) => {
    setEditingSupplierId(null);
    setFormError(null);
    setSupplierCode(nextCode ?? generateCodeForCurrentCatalog());
    setCpfCnpj('');
    setStateRegistration('');
    setLegalName('');
    setTradeName('');
    setCep('');
    setAddress('');
    setNumber('');
    setNeighborhood('');
    setState('SP');
    setCity('');
    setComplement('');
    setServiceFee('');
    setPhone('');
    setMobile('');
    setEmail('');
    setCepSuggestionMessage(null);
    setIsCepLookupLoading(false);
  };

  const supplierRows = useMemo(
    () =>
      [...suppliers].sort((a, b) => {
        const aCode = Number(a.supplierCode ?? parseLegacySupplierCode(a.legalName) ?? '0');
        const bCode = Number(b.supplierCode ?? parseLegacySupplierCode(b.legalName) ?? '0');
        return aCode - bCode;
      }),
    [suppliers]
  );

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();

    if (!isFilled(cpfCnpj) || !isFilled(legalName) || !isFilled(city)) {
      setFormError('Preencha CPF/CNPJ, Razao social e Cidade antes de salvar.');
      return;
    }

    const usedCodes = getUsedSupplierCodes(suppliers.filter((supplier) => supplier.id !== editingSupplierId));
    const generatedCode = supplierCode && !usedCodes.has(supplierCode)
      ? supplierCode
      : generateRandomSupplierCode(usedCodes);

    if (editingSupplierId) {
      const existingSupplier = suppliers.find((supplier) => supplier.id === editingSupplierId);

      if (!existingSupplier) {
        setFormError('Fornecedor selecionado para edicao nao foi encontrado.');
        return;
      }

      const updatedSupplier = {
        ...existingSupplier,
        supplierCode: generatedCode,
        cpfCnpj,
        stateRegistration,
        legalName,
        tradeName,
        cep,
        address,
        number,
        neighborhood,
        state,
        city,
        complement,
        serviceFee,
        phone,
        mobile,
        email,
        updatedAt: new Date(),
        version: existingSupplier.version + 1
      };

      await suppliersContainer.supplierRepository.save(updatedSupplier);
      setSuppliers((prev) => prev.map((supplier) => (supplier.id === editingSupplierId ? updatedSupplier : supplier)));
    } else {
      const supplier = await createSupplier({
        supplierCode: generatedCode,
        cpfCnpj,
        stateRegistration,
        legalName,
        tradeName,
        cep,
        address,
        number,
        neighborhood,
        state,
        city,
        complement,
        serviceFee,
        phone,
        mobile,
        email
      });

      setSuppliers((prev) => [...prev, supplier]);
    }

    clearForm(generateRandomSupplierCode(new Set([...usedCodes, generatedCode])));
    setShowCadastroSpan(false);
  };

  const onEditSupplier = (supplierId: string) => {
    const supplier = suppliers.find((item) => item.id === supplierId);
    if (!supplier) {
      return;
    }

    setEditingSupplierId(supplier.id);
    setShowCadastroSpan(true);
    setFormError(null);

    setSupplierCode(supplier.supplierCode ?? parseLegacySupplierCode(supplier.legalName) ?? generateCodeForCurrentCatalog());
    setCpfCnpj(supplier.cpfCnpj);
    setStateRegistration(supplier.stateRegistration);
    setLegalName(supplier.legalName);
    setTradeName(supplier.tradeName);
    setCep(supplier.cep);
    setAddress(supplier.address);
    setNumber(supplier.number);
    setNeighborhood(supplier.neighborhood);
    setState(supplier.state || 'SP');
    setCity(supplier.city);
    setComplement(supplier.complement);
    setServiceFee(supplier.serviceFee);
    setPhone(supplier.phone);
    setMobile(supplier.mobile);
    setEmail(supplier.email);
    setCepSuggestionMessage(null);
    setIsCepLookupLoading(false);
  };

  const onDeleteSupplier = async (supplierId: string) => {
    const target = suppliers.find((supplier) => supplier.id === supplierId);
    if (!target) {
      return;
    }

    const confirmed = window.confirm(`Deseja deletar o fornecedor "${target.legalName}"?`);
    if (!confirmed) {
      return;
    }

    await suppliersContainer.supplierRepository.delete(supplierId);
    setSuppliers((prev) => prev.filter((supplier) => supplier.id !== supplierId));

    if (editingSupplierId === supplierId) {
      clearForm();
      setShowCadastroSpan(false);
    }
  };

  return (
    <section className="cadastro-page">
      <header className="products-header card">
        <div>
          <p className="products-eyebrow">Cadastro e relacionamento</p>
          <h2>Cadastro</h2>
          <p className="products-subtitle">Gestao de fornecedores para operacao administrativa, gerencial e caixa.</p>
        </div>
        <div className="products-kpi">
          <strong>{suppliers.length}</strong>
          <span>fornecedores</span>
        </div>
      </header>

      <article className="card cadastro-tabs-card">
        <div className="cadastro-tabs-nav">
          <button
            type="button"
            className={activeTab === 'FORNECEDORES' ? 'is-active' : ''}
            onClick={() => setActiveTab('FORNECEDORES')}
          >
            Fornecedores
          </button>
        </div>
      </article>

      <article className="card products-toolbar">
        <div className="products-toolbar-actions">
          <button
            type="button"
            className="products-new-button"
            onClick={() => {
              if (!showCadastroSpan) {
                clearForm();
              }

              setShowCadastroSpan((prev) => !prev);
            }}
          >
            + Novo cadastro
          </button>
        </div>
      </article>

      {showCadastroSpan && (
        <article className="card products-cadastro-span">
          <header className="products-cadastro-header">
            <h3>Cadastro rapido | Fornecedores</h3>
          </header>

          <form onSubmit={onSubmit} className="suppliers-form">
            <section className="suppliers-section">
              <h4>Dados basicos</h4>

              <div className="suppliers-row-3">
                <div>
                  <label htmlFor="supplier-code">ID fornecedor (automatico)</label>
                  <input id="supplier-code" value={supplierCode} readOnly />
                </div>
                <div>
                  <label htmlFor="cpf-cnpj">CPF/CNPJ</label>
                  <input
                    id="cpf-cnpj"
                    value={cpfCnpj}
                    onChange={(e) => setCpfCnpj(formatCpfCnpj(e.target.value))}
                    required
                  />
                </div>
                <div>
                  <label htmlFor="state-registration">Inscricao estadual</label>
                  <input
                    id="state-registration"
                    value={stateRegistration}
                    onChange={(e) => setStateRegistration(e.target.value)}
                  />
                </div>
              </div>

              <div className="suppliers-row-2-wide">
                <div>
                  <label htmlFor="legal-name">Nome completo/Razao social</label>
                  <input id="legal-name" value={legalName} onChange={(e) => setLegalName(e.target.value)} required />
                </div>
                <div>
                  <label htmlFor="trade-name">Nome fantasia</label>
                  <input id="trade-name" value={tradeName} onChange={(e) => setTradeName(e.target.value)} />
                </div>
              </div>
            </section>

            <section className="suppliers-section">
              <h4>Endereco</h4>

              <div className="suppliers-row-address-top">
                <div>
                  <label htmlFor="cep">CEP</label>
                  <input id="cep" value={cep} onChange={(e) => setCep(formatCep(e.target.value))} />
                </div>
                <div>
                  <label htmlFor="address">Logradouro</label>
                  <input id="address" value={address} onChange={(e) => setAddress(e.target.value)} />
                </div>
                <div>
                  <label htmlFor="number">Numero</label>
                  <input id="number" value={number} onChange={(e) => setNumber(e.target.value)} />
                </div>
                <div>
                  <label htmlFor="neighborhood">Bairro</label>
                  <input id="neighborhood" value={neighborhood} onChange={(e) => setNeighborhood(e.target.value)} />
                </div>
              </div>

              {(isCepLookupLoading || cepSuggestionMessage) && (
                <p className="suppliers-cep-feedback">
                  {isCepLookupLoading
                    ? 'Buscando sugestao de endereco pelo CEP...'
                    : cepSuggestionMessage}
                </p>
              )}

              <div className="suppliers-row-address-bottom">
                <div>
                  <label htmlFor="state">UF</label>
                  <select id="state" value={state} onChange={(e) => setState(e.target.value)}>
                    {stateOptions.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="city">Cidade</label>
                  <input id="city" value={city} onChange={(e) => setCity(e.target.value)} required />
                </div>
                <div>
                  <label htmlFor="complement">Complemento</label>
                  <input id="complement" value={complement} onChange={(e) => setComplement(e.target.value)} />
                </div>
                <div>
                  <label htmlFor="service-fee">Taxa entrega/servico</label>
                  <input id="service-fee" value={serviceFee} onChange={(e) => setServiceFee(e.target.value)} />
                </div>
              </div>
            </section>

            <section className="suppliers-section">
              <h4>Contato</h4>

              <div className="suppliers-row-3">
                <div>
                  <label htmlFor="phone">Telefone</label>
                  <input id="phone" value={phone} onChange={(e) => setPhone(formatPhone(e.target.value))} />
                </div>
                <div>
                  <label htmlFor="mobile">Celular</label>
                  <input id="mobile" value={mobile} onChange={(e) => setMobile(formatPhone(e.target.value))} />
                </div>
                <div>
                  <label htmlFor="email">E-Mail</label>
                  <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
                </div>
              </div>
            </section>

            <div className="products-cadastro-footer">
              <button type="submit" disabled={saving}>
                {saving ? 'Salvando...' : editingSupplierId ? 'Salvar edicao' : 'Salvar dados'}
              </button>
              <button
                type="button"
                className="button-muted"
                onClick={() => {
                  setShowCadastroSpan(false);
                  clearForm();
                }}
              >
                Fechar cadastro
              </button>
            </div>

            {formError && <p className="products-form-warning">{formError}</p>}
          </form>
        </article>
      )}

      <article className="card products-list-card">
        <h3>Fornecedores ativos</h3>

        {supplierRows.length === 0 ? (
          <p className="empty-state">Nenhum fornecedor cadastrado ainda.</p>
        ) : (
          <ul className="products-list suppliers-list">
            {supplierRows.map((supplier) => (
              <li key={supplier.id}>
                <div>
                  <strong>
                    <span className="products-id-tag">ID {supplier.supplierCode ?? parseLegacySupplierCode(supplier.legalName) ?? '--'}</span>{' '}
                    {supplier.legalName}
                  </strong>
                  <span>{supplier.tradeName || 'Sem nome fantasia'}</span>
                  <span>
                    {supplier.city} - {supplier.state} | CPF/CNPJ {supplier.cpfCnpj}
                  </span>
                </div>
                <div>
                  <span>
                    Contato: {supplier.mobile || supplier.phone || '-'}{' '}
                    {supplier.mobile && (
                      <span className="whatsapp-badge" title="Numero com WhatsApp" aria-label="Numero com WhatsApp">
                        <svg
                          className="whatsapp-icon"
                          viewBox="0 0 24 24"
                          role="img"
                          aria-label="WhatsApp"
                        >
                          <path
                            d="M12 3.2a8.8 8.8 0 0 0-7.58 13.26L3.2 20.8l4.45-1.17A8.8 8.8 0 1 0 12 3.2Zm0 15.98a7.15 7.15 0 0 1-3.65-1l-.26-.15-2.64.69.7-2.57-.17-.27a7.17 7.17 0 1 1 6.02 3.3Zm3.93-5.34c-.22-.11-1.28-.63-1.48-.7-.2-.07-.34-.11-.49.11-.14.22-.56.7-.69.84-.13.14-.25.16-.47.05a5.87 5.87 0 0 1-2.9-2.54c-.12-.2 0-.31.1-.42.1-.1.22-.25.33-.38.1-.12.14-.22.22-.36.07-.14.04-.27-.02-.38-.06-.11-.5-1.21-.7-1.66-.18-.44-.36-.38-.5-.38h-.43c-.14 0-.37.05-.56.27-.2.22-.75.73-.75 1.79 0 1.06.77 2.08.87 2.22.11.14 1.5 2.29 3.63 3.21.5.22.9.35 1.2.45.5.16.95.13 1.31.08.4-.06 1.28-.52 1.46-1.02.18-.5.18-.94.13-1.03-.05-.09-.2-.14-.41-.25Z"
                            fill="currentColor"
                          />
                        </svg>
                      </span>
                    )}
                  </span>
                  <span>E-mail: {supplier.email || '-'}</span>
                  <div className="products-row-actions">
                    <button type="button" className="products-edit-button" onClick={() => onEditSupplier(supplier.id)}>
                      Editar
                    </button>
                    <button
                      type="button"
                      className="products-delete-button"
                      onClick={() => void onDeleteSupplier(supplier.id)}
                    >
                      Deletar
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </article>
    </section>
  );
}
