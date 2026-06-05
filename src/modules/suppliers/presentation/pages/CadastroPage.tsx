import { useEffect, useMemo, useState, type FormEvent } from 'react';

import type { ClientConsumptionEntry } from '@/modules/clients/domain/entities/Client';
import { clientsContainer } from '@/modules/clients/infrastructure/container/clientsContainer';
import { useClientsQuery } from '@/modules/clients/presentation/hooks/useClientsQuery';
import { useCreateClient } from '@/modules/clients/presentation/hooks/useCreateClient';
import { conveniosContainer } from '@/modules/convenios/infrastructure/container/conveniosContainer';
import { useConveniosQuery } from '@/modules/convenios/presentation/hooks/useConveniosQuery';
import { useCreateConvenio } from '@/modules/convenios/presentation/hooks/useCreateConvenio';
import { employeesContainer } from '@/modules/employees/infrastructure/container/employeesContainer';
import { suppliersContainer } from '@/modules/suppliers/infrastructure/container/suppliersContainer';
import { useCreateEmployee } from '@/modules/employees/presentation/hooks/useCreateEmployee';
import { useEmployeesQuery } from '@/modules/employees/presentation/hooks/useEmployeesQuery';
import { useCreateSupplier } from '@/modules/suppliers/presentation/hooks/useCreateSupplier';
import { useSuppliersQuery } from '@/modules/suppliers/presentation/hooks/useSuppliersQuery';

const stateOptions = [
  'AC', 'AL', 'AM', 'AP', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MG', 'MS', 'MT',
  'PA', 'PB', 'PE', 'PI', 'PR', 'RJ', 'RN', 'RO', 'RR', 'RS', 'SC', 'SE', 'SP', 'TO'
];

const employeeRoleOptions = ['GERENTE', 'CAIXA', 'ATENDENTE', 'BALANCA_A', 'BALANCA_B', 'ADMINISTRATIVO'];
const employeeGenderOptions = ['MASCULINO', 'FEMININO'] as const;
const convenioPaymentMethodOptions = ['PIX', 'DINHEIRO', 'TRANSFERENCIA', 'FIADO', 'CARTAO', 'OUTRO'] as const;
const convenioCashFlowOptions = ['ENTRADA', 'SAIDA', 'AMBOS'] as const;

const parseLegacySupplierCode = (legalName: string) => {
  const [firstChunk] = legalName.split(' - ');
  return /^\d{2,5}$/.test(firstChunk) ? firstChunk : null;
};

const parseLegacyEmployeeCode = (fullName: string) => {
  const [firstChunk] = fullName.split(' - ');
  return /^\d{2,5}$/.test(firstChunk) ? firstChunk : null;
};

const parseLegacyClientCode = (fullName: string) => {
  const [firstChunk] = fullName.split(' - ');
  return /^\d{2,5}$/.test(firstChunk) ? firstChunk : null;
};

const parseLegacyConvenioCode = (name: string) => {
  const [firstChunk] = name.split(' - ');
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

const getUsedEmployeeCodes = (employees: Array<{ employeeCode?: string; fullName: string }>) => {
  const usedCodes = new Set<string>();

  for (const employee of employees) {
    const code = employee.employeeCode ?? parseLegacyEmployeeCode(employee.fullName);
    if (code) {
      usedCodes.add(code);
    }
  }

  return usedCodes;
};

const getUsedClientCodes = (clients: Array<{ clientCode?: string; fullName: string }>) => {
  const usedCodes = new Set<string>();

  for (const client of clients) {
    const code = client.clientCode ?? parseLegacyClientCode(client.fullName);
    if (code) {
      usedCodes.add(code);
    }
  }

  return usedCodes;
};

const getUsedConvenioCodes = (convenios: Array<{ convenioCode?: string; name: string }>) => {
  const usedCodes = new Set<string>();

  for (const convenio of convenios) {
    const code = convenio.convenioCode ?? parseLegacyConvenioCode(convenio.name);
    if (code) {
      usedCodes.add(code);
    }
  }

  return usedCodes;
};

const generateRandomCode = (usedCodes: Set<string>) => {
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

const formatConsumptionLaunchDate = (value: Date) => {
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

const parseConsumptionLaunchDate = (value: string) => {
  const [datePart, timePart = '00:00'] = value.split(' ');
  const [day, month, year] = datePart.split('/').map(Number);
  const [hours, minutes] = timePart.split(':').map(Number);

  if (!day || !month || !year) {
    return null;
  }

  return new Date(year, month - 1, day, hours || 0, minutes || 0);
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
  const { createSupplier, saving: savingSupplier } = useCreateSupplier();
  const { employees, setEmployees } = useEmployeesQuery();
  const { createEmployee, saving: savingEmployee } = useCreateEmployee();
  const { clients, setClients } = useClientsQuery();
  const { createClient, saving: savingClient } = useCreateClient();
  const { convenios, setConvenios } = useConveniosQuery();
  const { createConvenio, saving: savingConvenio } = useCreateConvenio();

  const [activeTab, setActiveTab] = useState<'FORNECEDORES' | 'FUNCIONARIOS' | 'CLIENTES' | 'CONVENIOS'>('FORNECEDORES');
  const [showCadastroSpan, setShowCadastroSpan] = useState(false);

  const [editingSupplierId, setEditingSupplierId] = useState<string | null>(null);
  const [supplierFormError, setSupplierFormError] = useState<string | null>(null);
  const [supplierCode, setSupplierCode] = useState('');
  const [cpfCnpj, setCpfCnpj] = useState('');
  const [stateRegistration, setStateRegistration] = useState('');
  const [legalName, setLegalName] = useState('');
  const [tradeName, setTradeName] = useState('');
  const [supplierCep, setSupplierCep] = useState('');
  const [supplierAddress, setSupplierAddress] = useState('');
  const [supplierNumber, setSupplierNumber] = useState('');
  const [supplierNeighborhood, setSupplierNeighborhood] = useState('');
  const [supplierState, setSupplierState] = useState('SP');
  const [supplierCity, setSupplierCity] = useState('');
  const [supplierComplement, setSupplierComplement] = useState('');
  const [serviceFee, setServiceFee] = useState('');
  const [supplierPhone, setSupplierPhone] = useState('');
  const [supplierMobile, setSupplierMobile] = useState('');
  const [supplierEmail, setSupplierEmail] = useState('');
  const [supplierCepSuggestionMessage, setSupplierCepSuggestionMessage] = useState<string | null>(null);
  const [isSupplierCepLookupLoading, setIsSupplierCepLookupLoading] = useState(false);

  const [editingEmployeeId, setEditingEmployeeId] = useState<string | null>(null);
  const [employeeFormError, setEmployeeFormError] = useState<string | null>(null);
  const [employeeCode, setEmployeeCode] = useState('');
  const [employeeFullName, setEmployeeFullName] = useState('');
  const [employeeCpf, setEmployeeCpf] = useState('');
  const [employeeRole, setEmployeeRole] = useState(employeeRoleOptions[0]);
  const [employeeBirthDate, setEmployeeBirthDate] = useState('');
  const [employeeGender, setEmployeeGender] = useState<(typeof employeeGenderOptions)[number]>('MASCULINO');
  const [employeeAdmissionDate, setEmployeeAdmissionDate] = useState('');
  const [employeeDismissalDate, setEmployeeDismissalDate] = useState('');
  const [employeeNotes, setEmployeeNotes] = useState('');
  const [employeeCep, setEmployeeCep] = useState('');
  const [employeeAddress, setEmployeeAddress] = useState('');
  const [employeeNumber, setEmployeeNumber] = useState('');
  const [employeeNeighborhood, setEmployeeNeighborhood] = useState('');
  const [employeeState, setEmployeeState] = useState('SP');
  const [employeeCity, setEmployeeCity] = useState('');
  const [employeeComplement, setEmployeeComplement] = useState('');
  const [employeePhone, setEmployeePhone] = useState('');
  const [employeeMobile, setEmployeeMobile] = useState('');
  const [employeeEmail, setEmployeeEmail] = useState('');
  const [employeeActive, setEmployeeActive] = useState(true);
  const [employeeCepSuggestionMessage, setEmployeeCepSuggestionMessage] = useState<string | null>(null);
  const [isEmployeeCepLookupLoading, setIsEmployeeCepLookupLoading] = useState(false);

  const [editingClientId, setEditingClientId] = useState<string | null>(null);
  const [clientFormError, setClientFormError] = useState<string | null>(null);
  const [clientCode, setClientCode] = useState('');
  const [clientFullName, setClientFullName] = useState('');
  const [clientCpf, setClientCpf] = useState('');
  const [clientCep, setClientCep] = useState('');
  const [clientAddress, setClientAddress] = useState('');
  const [clientNumber, setClientNumber] = useState('');
  const [clientNeighborhood, setClientNeighborhood] = useState('');
  const [clientState, setClientState] = useState('SP');
  const [clientCity, setClientCity] = useState('');
  const [clientComplement, setClientComplement] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [clientMobile, setClientMobile] = useState('');
  const [clientEmail, setClientEmail] = useState('');
  const [clientActive, setClientActive] = useState(true);
  const [clientConsumptionDescription, setClientConsumptionDescription] = useState('');
  const [clientConsumptionHistory, setClientConsumptionHistory] = useState<ClientConsumptionEntry[]>([]);
  const [clientCepSuggestionMessage, setClientCepSuggestionMessage] = useState<string | null>(null);
  const [isClientCepLookupLoading, setIsClientCepLookupLoading] = useState(false);
  const [clientHistoryPeriodStartInput, setClientHistoryPeriodStartInput] = useState('');
  const [clientHistoryPeriodEndInput, setClientHistoryPeriodEndInput] = useState('');
  const [clientHistoryPeriodStart, setClientHistoryPeriodStart] = useState('');
  const [clientHistoryPeriodEnd, setClientHistoryPeriodEnd] = useState('');

  const [editingConvenioId, setEditingConvenioId] = useState<string | null>(null);
  const [convenioFormError, setConvenioFormError] = useState<string | null>(null);
  const [convenioCode, setConvenioCode] = useState('');
  const [convenioName, setConvenioName] = useState('');
  const [convenioPaymentMethod, setConvenioPaymentMethod] = useState<(typeof convenioPaymentMethodOptions)[number]>('PIX');
  const [convenioCashFlow, setConvenioCashFlow] = useState<(typeof convenioCashFlowOptions)[number]>('ENTRADA');
  const [convenioBankName, setConvenioBankName] = useState('');
  const [convenioAccountName, setConvenioAccountName] = useState('');
  const [convenioActive, setConvenioActive] = useState(true);
  const [convenioNotes, setConvenioNotes] = useState('');

  useEffect(() => {
    const cepDigits = normalizeCepDigits(supplierCep);

    if (cepDigits.length < 8) {
      setIsSupplierCepLookupLoading(false);
      setSupplierCepSuggestionMessage(null);
      return;
    }

    const controller = new AbortController();

    const lookupTimer = window.setTimeout(async () => {
      try {
        setIsSupplierCepLookupLoading(true);

        const response = await fetch(`https://viacep.com.br/ws/${cepDigits}/json/`, {
          signal: controller.signal
        });

        if (!response.ok) {
          throw new Error('Falha na consulta de CEP.');
        }

        const data = (await response.json()) as ViaCepResponse;

        if (data.erro) {
          setSupplierCepSuggestionMessage('CEP nao encontrado para sugestao de endereco.');
          return;
        }

        setSupplierAddress((prev) => (isFilled(prev) ? prev : data.logradouro ?? ''));
        setSupplierNeighborhood((prev) => (isFilled(prev) ? prev : data.bairro ?? ''));
        setSupplierCity((prev) => (isFilled(prev) ? prev : data.localidade ?? ''));
        setSupplierState((prev) => (isFilled(prev) ? prev : data.uf ?? prev));

        const suggestedCity = data.localidade ?? supplierCity;
        const suggestedUf = data.uf ?? supplierState;
        setSupplierCepSuggestionMessage(`Sugestao aplicada: ${suggestedCity}/${suggestedUf}.`);
      } catch {
        if (!controller.signal.aborted) {
          setSupplierCepSuggestionMessage('Nao foi possivel consultar o CEP agora.');
        }
      } finally {
        if (!controller.signal.aborted) {
          setIsSupplierCepLookupLoading(false);
        }
      }
    }, 450);

    return () => {
      controller.abort();
      window.clearTimeout(lookupTimer);
    };
  }, [supplierCep, supplierCity, supplierState]);

  useEffect(() => {
    const cepDigits = normalizeCepDigits(employeeCep);

    if (cepDigits.length < 8) {
      setIsEmployeeCepLookupLoading(false);
      setEmployeeCepSuggestionMessage(null);
      return;
    }

    const controller = new AbortController();

    const lookupTimer = window.setTimeout(async () => {
      try {
        setIsEmployeeCepLookupLoading(true);

        const response = await fetch(`https://viacep.com.br/ws/${cepDigits}/json/`, {
          signal: controller.signal
        });

        if (!response.ok) {
          throw new Error('Falha na consulta de CEP.');
        }

        const data = (await response.json()) as ViaCepResponse;

        if (data.erro) {
          setEmployeeCepSuggestionMessage('CEP nao encontrado para sugestao de endereco.');
          return;
        }

        setEmployeeAddress((prev) => (isFilled(prev) ? prev : data.logradouro ?? ''));
        setEmployeeNeighborhood((prev) => (isFilled(prev) ? prev : data.bairro ?? ''));
        setEmployeeCity((prev) => (isFilled(prev) ? prev : data.localidade ?? ''));
        setEmployeeState((prev) => (isFilled(prev) ? prev : data.uf ?? prev));

        const suggestedCity = data.localidade ?? employeeCity;
        const suggestedUf = data.uf ?? employeeState;
        setEmployeeCepSuggestionMessage(`Sugestao aplicada: ${suggestedCity}/${suggestedUf}.`);
      } catch {
        if (!controller.signal.aborted) {
          setEmployeeCepSuggestionMessage('Nao foi possivel consultar o CEP agora.');
        }
      } finally {
        if (!controller.signal.aborted) {
          setIsEmployeeCepLookupLoading(false);
        }
      }
    }, 450);

    return () => {
      controller.abort();
      window.clearTimeout(lookupTimer);
    };
  }, [employeeCep, employeeCity, employeeState]);

  useEffect(() => {
    const cepDigits = normalizeCepDigits(clientCep);

    if (cepDigits.length < 8) {
      setIsClientCepLookupLoading(false);
      setClientCepSuggestionMessage(null);
      return;
    }

    const controller = new AbortController();

    const lookupTimer = window.setTimeout(async () => {
      try {
        setIsClientCepLookupLoading(true);

        const response = await fetch(`https://viacep.com.br/ws/${cepDigits}/json/`, {
          signal: controller.signal
        });

        if (!response.ok) {
          throw new Error('Falha na consulta de CEP.');
        }

        const data = (await response.json()) as ViaCepResponse;

        if (data.erro) {
          setClientCepSuggestionMessage('CEP nao encontrado para sugestao de endereco.');
          return;
        }

        setClientAddress((prev) => (isFilled(prev) ? prev : data.logradouro ?? ''));
        setClientNeighborhood((prev) => (isFilled(prev) ? prev : data.bairro ?? ''));
        setClientCity((prev) => (isFilled(prev) ? prev : data.localidade ?? ''));
        setClientState((prev) => (isFilled(prev) ? prev : data.uf ?? prev));

        const suggestedCity = data.localidade ?? clientCity;
        const suggestedUf = data.uf ?? clientState;
        setClientCepSuggestionMessage(`Sugestao aplicada: ${suggestedCity}/${suggestedUf}.`);
      } catch {
        if (!controller.signal.aborted) {
          setClientCepSuggestionMessage('Nao foi possivel consultar o CEP agora.');
        }
      } finally {
        if (!controller.signal.aborted) {
          setIsClientCepLookupLoading(false);
        }
      }
    }, 450);

    return () => {
      controller.abort();
      window.clearTimeout(lookupTimer);
    };
  }, [clientCep, clientCity, clientState]);

  const generateSupplierCodeForCurrentCatalog = () => {
    const usedCodes = getUsedSupplierCodes(suppliers);
    return generateRandomCode(usedCodes);
  };

  const generateEmployeeCodeForCurrentCatalog = () => {
    const usedCodes = getUsedEmployeeCodes(employees);
    return generateRandomCode(usedCodes);
  };

  const generateClientCodeForCurrentCatalog = () => {
    const usedCodes = getUsedClientCodes(clients);
    return generateRandomCode(usedCodes);
  };

  const generateConvenioCodeForCurrentCatalog = () => {
    const usedCodes = getUsedConvenioCodes(convenios);
    return generateRandomCode(usedCodes);
  };

  const clearSupplierForm = (nextCode?: string) => {
    setEditingSupplierId(null);
    setSupplierFormError(null);
    setSupplierCode(nextCode ?? generateSupplierCodeForCurrentCatalog());
    setCpfCnpj('');
    setStateRegistration('');
    setLegalName('');
    setTradeName('');
    setSupplierCep('');
    setSupplierAddress('');
    setSupplierNumber('');
    setSupplierNeighborhood('');
    setSupplierState('SP');
    setSupplierCity('');
    setSupplierComplement('');
    setServiceFee('');
    setSupplierPhone('');
    setSupplierMobile('');
    setSupplierEmail('');
    setSupplierCepSuggestionMessage(null);
    setIsSupplierCepLookupLoading(false);
  };

  const clearEmployeeForm = (nextCode?: string) => {
    setEditingEmployeeId(null);
    setEmployeeFormError(null);
    setEmployeeCode(nextCode ?? generateEmployeeCodeForCurrentCatalog());
    setEmployeeFullName('');
    setEmployeeCpf('');
    setEmployeeRole(employeeRoleOptions[0]);
    setEmployeeBirthDate('');
    setEmployeeGender('MASCULINO');
    setEmployeeAdmissionDate('');
    setEmployeeDismissalDate('');
    setEmployeeNotes('');
    setEmployeeCep('');
    setEmployeeAddress('');
    setEmployeeNumber('');
    setEmployeeNeighborhood('');
    setEmployeeState('SP');
    setEmployeeCity('');
    setEmployeeComplement('');
    setEmployeePhone('');
    setEmployeeMobile('');
    setEmployeeEmail('');
    setEmployeeActive(true);
    setEmployeeCepSuggestionMessage(null);
    setIsEmployeeCepLookupLoading(false);
  };

  const clearClientForm = (nextCode?: string) => {
    setEditingClientId(null);
    setClientFormError(null);
    setClientCode(nextCode ?? generateClientCodeForCurrentCatalog());
    setClientFullName('');
    setClientCpf('');
    setClientCep('');
    setClientAddress('');
    setClientNumber('');
    setClientNeighborhood('');
    setClientState('SP');
    setClientCity('');
    setClientComplement('');
    setClientPhone('');
    setClientMobile('');
    setClientEmail('');
    setClientActive(true);
    setClientConsumptionDescription('');
    setClientConsumptionHistory([]);
    setClientCepSuggestionMessage(null);
    setIsClientCepLookupLoading(false);
    setClientHistoryPeriodStartInput('');
    setClientHistoryPeriodEndInput('');
    setClientHistoryPeriodStart('');
    setClientHistoryPeriodEnd('');
  };

  const clearConvenioForm = (nextCode?: string) => {
    setEditingConvenioId(null);
    setConvenioFormError(null);
    setConvenioCode(nextCode ?? generateConvenioCodeForCurrentCatalog());
    setConvenioName('');
    setConvenioPaymentMethod('PIX');
    setConvenioCashFlow('ENTRADA');
    setConvenioBankName('');
    setConvenioAccountName('');
    setConvenioActive(true);
    setConvenioNotes('');
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

  const employeeRows = useMemo(
    () =>
      [...employees].sort((a, b) => {
        const aCode = Number(a.employeeCode ?? parseLegacyEmployeeCode(a.fullName) ?? '0');
        const bCode = Number(b.employeeCode ?? parseLegacyEmployeeCode(b.fullName) ?? '0');
        return aCode - bCode;
      }),
    [employees]
  );

  const clientRows = useMemo(
    () =>
      [...clients].sort((a, b) => {
        const aCode = Number(a.clientCode ?? parseLegacyClientCode(a.fullName) ?? '0');
        const bCode = Number(b.clientCode ?? parseLegacyClientCode(b.fullName) ?? '0');
        return aCode - bCode;
      }),
    [clients]
  );

  const convenioRows = useMemo(
    () =>
      [...convenios].sort((a, b) => {
        const aCode = Number(a.convenioCode ?? parseLegacyConvenioCode(a.name) ?? '0');
        const bCode = Number(b.convenioCode ?? parseLegacyConvenioCode(b.name) ?? '0');
        return aCode - bCode;
      }),
    [convenios]
  );

  const filteredClientConsumptionHistory = useMemo(() => {
    if (!clientHistoryPeriodStart && !clientHistoryPeriodEnd) {
      return clientConsumptionHistory;
    }

    const startDate = clientHistoryPeriodStart ? new Date(`${clientHistoryPeriodStart}T00:00:00`) : null;
    const endDate = clientHistoryPeriodEnd ? new Date(`${clientHistoryPeriodEnd}T23:59:59`) : null;

    return clientConsumptionHistory.filter((entry) => {
      const launchedAt = parseConsumptionLaunchDate(entry.launchedAt);
      if (!launchedAt) {
        return false;
      }

      if (startDate && launchedAt < startDate) {
        return false;
      }

      if (endDate && launchedAt > endDate) {
        return false;
      }

      return true;
    });
  }, [clientConsumptionHistory, clientHistoryPeriodEnd, clientHistoryPeriodStart]);

  const addClientConsumptionEntry = () => {
    const description = clientConsumptionDescription.trim();
    if (!description) {
      return;
    }

    const launchedAt = formatConsumptionLaunchDate(new Date());
    setClientConsumptionHistory((prev) => [
      {
        id: `entry-${crypto.randomUUID()}`,
        description,
        launchedAt
      },
      ...prev
    ]);
    setClientConsumptionDescription('');
  };

  const removeClientConsumptionEntry = (entryId: string) => {
    setClientConsumptionHistory((prev) => prev.filter((entry) => entry.id !== entryId));
  };

  const applyClientHistoryPeriodFilter = () => {
    setClientHistoryPeriodStart(clientHistoryPeriodStartInput);
    setClientHistoryPeriodEnd(clientHistoryPeriodEndInput);
  };

  const clearClientHistoryPeriodFilter = () => {
    setClientHistoryPeriodStartInput('');
    setClientHistoryPeriodEndInput('');
    setClientHistoryPeriodStart('');
    setClientHistoryPeriodEnd('');
  };

  const onSubmitConvenio = async (event: FormEvent) => {
    event.preventDefault();

    if (!isFilled(convenioName)) {
      setConvenioFormError('Preencha o nome do convenio antes de salvar.');
      return;
    }

    const usedCodes = getUsedConvenioCodes(convenios.filter((convenio) => convenio.id !== editingConvenioId));
    const generatedCode = convenioCode && !usedCodes.has(convenioCode)
      ? convenioCode
      : generateRandomCode(usedCodes);

    if (editingConvenioId) {
      const existingConvenio = convenios.find((convenio) => convenio.id === editingConvenioId);

      if (!existingConvenio) {
        setConvenioFormError('Convenio selecionado para edicao nao foi encontrado.');
        return;
      }

      const updatedConvenio = {
        ...existingConvenio,
        convenioCode: generatedCode,
        name: convenioName,
        paymentMethod: convenioPaymentMethod,
        cashFlow: convenioCashFlow,
        bankName: convenioBankName,
        accountName: convenioAccountName,
        active: convenioActive,
        notes: convenioNotes,
        updatedAt: new Date(),
        version: existingConvenio.version + 1
      };

      await conveniosContainer.convenioRepository.save(updatedConvenio);
      setConvenios((prev) => prev.map((convenio) => (convenio.id === editingConvenioId ? updatedConvenio : convenio)));
    } else {
      const convenio = await createConvenio({
        convenioCode: generatedCode,
        name: convenioName,
        paymentMethod: convenioPaymentMethod,
        cashFlow: convenioCashFlow,
        bankName: convenioBankName,
        accountName: convenioAccountName,
        active: convenioActive,
        notes: convenioNotes
      });

      setConvenios((prev) => [...prev, convenio]);
    }

    clearConvenioForm(generateRandomCode(new Set([...usedCodes, generatedCode])));
    setShowCadastroSpan(false);
  };

  const onEditConvenio = (convenioId: string) => {
    const convenio = convenios.find((item) => item.id === convenioId);
    if (!convenio) {
      return;
    }

    setEditingConvenioId(convenio.id);
    setShowCadastroSpan(true);
    setConvenioFormError(null);

    setConvenioCode(convenio.convenioCode ?? parseLegacyConvenioCode(convenio.name) ?? generateConvenioCodeForCurrentCatalog());
    setConvenioName(convenio.name);
    setConvenioPaymentMethod(convenio.paymentMethod);
    setConvenioCashFlow(convenio.cashFlow);
    setConvenioBankName(convenio.bankName);
    setConvenioAccountName(convenio.accountName);
    setConvenioActive(convenio.active);
    setConvenioNotes(convenio.notes);
  };

  const onDeleteConvenio = async (convenioId: string) => {
    const target = convenios.find((convenio) => convenio.id === convenioId);
    if (!target) {
      return;
    }

    const confirmed = window.confirm(`Deseja deletar o convenio "${target.name}"?`);
    if (!confirmed) {
      return;
    }

    await conveniosContainer.convenioRepository.delete(convenioId);
    setConvenios((prev) => prev.filter((convenio) => convenio.id !== convenioId));

    if (editingConvenioId === convenioId) {
      clearConvenioForm();
      setShowCadastroSpan(false);
    }
  };

  const onSubmitSupplier = async (event: FormEvent) => {
    event.preventDefault();

    if (!isFilled(cpfCnpj) || !isFilled(legalName) || !isFilled(supplierCity)) {
      setSupplierFormError('Preencha CPF/CNPJ, Razao social e Cidade antes de salvar.');
      return;
    }

    const usedCodes = getUsedSupplierCodes(suppliers.filter((supplier) => supplier.id !== editingSupplierId));
    const generatedCode = supplierCode && !usedCodes.has(supplierCode)
      ? supplierCode
      : generateRandomCode(usedCodes);

    if (editingSupplierId) {
      const existingSupplier = suppliers.find((supplier) => supplier.id === editingSupplierId);

      if (!existingSupplier) {
        setSupplierFormError('Fornecedor selecionado para edicao nao foi encontrado.');
        return;
      }

      const updatedSupplier = {
        ...existingSupplier,
        supplierCode: generatedCode,
        cpfCnpj,
        stateRegistration,
        legalName,
        tradeName,
        cep: supplierCep,
        address: supplierAddress,
        number: supplierNumber,
        neighborhood: supplierNeighborhood,
        state: supplierState,
        city: supplierCity,
        complement: supplierComplement,
        serviceFee,
        phone: supplierPhone,
        mobile: supplierMobile,
        email: supplierEmail,
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
        cep: supplierCep,
        address: supplierAddress,
        number: supplierNumber,
        neighborhood: supplierNeighborhood,
        state: supplierState,
        city: supplierCity,
        complement: supplierComplement,
        serviceFee,
        phone: supplierPhone,
        mobile: supplierMobile,
        email: supplierEmail
      });

      setSuppliers((prev) => [...prev, supplier]);
    }

    clearSupplierForm(generateRandomCode(new Set([...usedCodes, generatedCode])));
    setShowCadastroSpan(false);
  };

  const onSubmitEmployee = async (event: FormEvent) => {
    event.preventDefault();

    if (!isFilled(employeeCpf) || !isFilled(employeeFullName) || !isFilled(employeeCity)) {
      setEmployeeFormError('Preencha CPF, Nome completo e Cidade antes de salvar.');
      return;
    }

    const usedCodes = getUsedEmployeeCodes(employees.filter((employee) => employee.id !== editingEmployeeId));
    const generatedCode = employeeCode && !usedCodes.has(employeeCode)
      ? employeeCode
      : generateRandomCode(usedCodes);

    if (editingEmployeeId) {
      const existingEmployee = employees.find((employee) => employee.id === editingEmployeeId);

      if (!existingEmployee) {
        setEmployeeFormError('Funcionario selecionado para edicao nao foi encontrado.');
        return;
      }

      const updatedEmployee = {
        ...existingEmployee,
        employeeCode: generatedCode,
        fullName: employeeFullName,
        cpf: employeeCpf,
        role: employeeRole,
        admissionDate: employeeAdmissionDate,
        dismissalDate: employeeDismissalDate,
        notes: employeeNotes,
        birthDate: employeeBirthDate,
        gender: employeeGender,
        cep: employeeCep,
        address: employeeAddress,
        number: employeeNumber,
        neighborhood: employeeNeighborhood,
        state: employeeState,
        city: employeeCity,
        complement: employeeComplement,
        phone: employeePhone,
        mobile: employeeMobile,
        email: employeeEmail,
        active: employeeActive,
        updatedAt: new Date(),
        version: existingEmployee.version + 1
      };

      await employeesContainer.employeeRepository.save(updatedEmployee);
      setEmployees((prev) => prev.map((employee) => (employee.id === editingEmployeeId ? updatedEmployee : employee)));
    } else {
      const employee = await createEmployee({
        employeeCode: generatedCode,
        fullName: employeeFullName,
        cpf: employeeCpf,
        role: employeeRole,
        admissionDate: employeeAdmissionDate,
        dismissalDate: employeeDismissalDate,
        notes: employeeNotes,
        birthDate: employeeBirthDate,
        gender: employeeGender,
        cep: employeeCep,
        address: employeeAddress,
        number: employeeNumber,
        neighborhood: employeeNeighborhood,
        state: employeeState,
        city: employeeCity,
        complement: employeeComplement,
        phone: employeePhone,
        mobile: employeeMobile,
        email: employeeEmail,
        active: employeeActive
      });

      setEmployees((prev) => [...prev, employee]);
    }

    clearEmployeeForm(generateRandomCode(new Set([...usedCodes, generatedCode])));
    setShowCadastroSpan(false);
  };

  const onSubmitClient = async (event: FormEvent) => {
    event.preventDefault();

    if (!isFilled(clientFullName) || !isFilled(clientCpf)) {
      setClientFormError('Preencha Nome completo e CPF antes de salvar.');
      return;
    }

    const usedCodes = getUsedClientCodes(clients.filter((client) => client.id !== editingClientId));
    const generatedCode = clientCode && !usedCodes.has(clientCode)
      ? clientCode
      : generateRandomCode(usedCodes);

    if (editingClientId) {
      const existingClient = clients.find((client) => client.id === editingClientId);

      if (!existingClient) {
        setClientFormError('Cliente selecionado para edicao nao foi encontrado.');
        return;
      }

      const updatedClient = {
        ...existingClient,
        clientCode: generatedCode,
        fullName: clientFullName,
        cpf: clientCpf,
        cep: clientCep,
        address: clientAddress,
        number: clientNumber,
        neighborhood: clientNeighborhood,
        state: clientState,
        city: clientCity,
        complement: clientComplement,
        phone: clientPhone,
        mobile: clientMobile,
        email: clientEmail,
        active: clientActive,
        consumptionHistory: clientConsumptionHistory,
        updatedAt: new Date(),
        version: existingClient.version + 1
      };

      await clientsContainer.clientRepository.save(updatedClient);
      setClients((prev) => prev.map((client) => (client.id === editingClientId ? updatedClient : client)));
    } else {
      const client = await createClient({
        clientCode: generatedCode,
        fullName: clientFullName,
        cpf: clientCpf,
        cep: clientCep,
        address: clientAddress,
        number: clientNumber,
        neighborhood: clientNeighborhood,
        state: clientState,
        city: clientCity,
        complement: clientComplement,
        phone: clientPhone,
        mobile: clientMobile,
        email: clientEmail,
        active: clientActive,
        consumptionHistory: clientConsumptionHistory
      });

      setClients((prev) => [...prev, client]);
    }

    clearClientForm(generateRandomCode(new Set([...usedCodes, generatedCode])));
    setShowCadastroSpan(false);
  };

  const onEditSupplier = (supplierId: string) => {
    const supplier = suppliers.find((item) => item.id === supplierId);
    if (!supplier) {
      return;
    }

    setEditingSupplierId(supplier.id);
    setShowCadastroSpan(true);
    setSupplierFormError(null);

    setSupplierCode(supplier.supplierCode ?? parseLegacySupplierCode(supplier.legalName) ?? generateSupplierCodeForCurrentCatalog());
    setCpfCnpj(supplier.cpfCnpj);
    setStateRegistration(supplier.stateRegistration);
    setLegalName(supplier.legalName);
    setTradeName(supplier.tradeName);
    setSupplierCep(supplier.cep);
    setSupplierAddress(supplier.address);
    setSupplierNumber(supplier.number);
    setSupplierNeighborhood(supplier.neighborhood);
    setSupplierState(supplier.state || 'SP');
    setSupplierCity(supplier.city);
    setSupplierComplement(supplier.complement);
    setServiceFee(supplier.serviceFee);
    setSupplierPhone(supplier.phone);
    setSupplierMobile(supplier.mobile);
    setSupplierEmail(supplier.email);
    setSupplierCepSuggestionMessage(null);
    setIsSupplierCepLookupLoading(false);
  };

  const onEditEmployee = (employeeId: string) => {
    const employee = employees.find((item) => item.id === employeeId);
    if (!employee) {
      return;
    }

    setEditingEmployeeId(employee.id);
    setShowCadastroSpan(true);
    setEmployeeFormError(null);

    setEmployeeCode(employee.employeeCode ?? parseLegacyEmployeeCode(employee.fullName) ?? generateEmployeeCodeForCurrentCatalog());
    setEmployeeFullName(employee.fullName);
    setEmployeeCpf(employee.cpf);
    setEmployeeRole(employee.role || employeeRoleOptions[0]);
    setEmployeeBirthDate(employee.birthDate || '');
    setEmployeeGender(employee.gender || 'MASCULINO');
    setEmployeeAdmissionDate(employee.admissionDate || '');
    setEmployeeDismissalDate(employee.dismissalDate || '');
    setEmployeeNotes(employee.notes || '');
    setEmployeeCep(employee.cep);
    setEmployeeAddress(employee.address);
    setEmployeeNumber(employee.number);
    setEmployeeNeighborhood(employee.neighborhood);
    setEmployeeState(employee.state || 'SP');
    setEmployeeCity(employee.city);
    setEmployeeComplement(employee.complement);
    setEmployeePhone(employee.phone);
    setEmployeeMobile(employee.mobile);
    setEmployeeEmail(employee.email);
    setEmployeeActive(employee.active);
    setEmployeeCepSuggestionMessage(null);
    setIsEmployeeCepLookupLoading(false);
  };

  const onEditClient = (clientId: string) => {
    const client = clients.find((item) => item.id === clientId);
    if (!client) {
      return;
    }

    setEditingClientId(client.id);
    setShowCadastroSpan(true);
    setClientFormError(null);

    setClientCode(client.clientCode ?? parseLegacyClientCode(client.fullName) ?? generateClientCodeForCurrentCatalog());
    setClientFullName(client.fullName);
    setClientCpf(client.cpf);
    setClientCep(client.cep || '');
    setClientAddress(client.address || '');
    setClientNumber(client.number || '');
    setClientNeighborhood(client.neighborhood || '');
    setClientState(client.state || 'SP');
    setClientCity(client.city || '');
    setClientComplement(client.complement || '');
    setClientPhone(client.phone);
    setClientMobile(client.mobile);
    setClientEmail(client.email);
    setClientActive(client.active);
    setClientConsumptionDescription('');
    setClientConsumptionHistory(client.consumptionHistory ?? []);
    setClientCepSuggestionMessage(null);
    setIsClientCepLookupLoading(false);
    setClientHistoryPeriodStartInput('');
    setClientHistoryPeriodEndInput('');
    setClientHistoryPeriodStart('');
    setClientHistoryPeriodEnd('');
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
      clearSupplierForm();
      setShowCadastroSpan(false);
    }
  };

  const onDeleteEmployee = async (employeeId: string) => {
    const target = employees.find((employee) => employee.id === employeeId);
    if (!target) {
      return;
    }

    const confirmed = window.confirm(`Deseja deletar o funcionario "${target.fullName}"?`);
    if (!confirmed) {
      return;
    }

    await employeesContainer.employeeRepository.delete(employeeId);
    setEmployees((prev) => prev.filter((employee) => employee.id !== employeeId));

    if (editingEmployeeId === employeeId) {
      clearEmployeeForm();
      setShowCadastroSpan(false);
    }
  };

  const onDeleteClient = async (clientId: string) => {
    const target = clients.find((client) => client.id === clientId);
    if (!target) {
      return;
    }

    const confirmed = window.confirm(`Deseja deletar o cliente "${target.fullName}"?`);
    if (!confirmed) {
      return;
    }

    await clientsContainer.clientRepository.delete(clientId);
    setClients((prev) => prev.filter((client) => client.id !== clientId));

    if (editingClientId === clientId) {
      clearClientForm();
      setShowCadastroSpan(false);
    }
  };

  const currentCount = activeTab === 'FORNECEDORES'
    ? suppliers.length
    : activeTab === 'FUNCIONARIOS'
      ? employees.length
      : activeTab === 'CLIENTES'
        ? clients.length
        : convenios.length;

  return (
    <section className="cadastro-page">
      <header className="products-header card">
        <div>
          <p className="products-eyebrow">Cadastros e relacionamento</p>
          <h2>Cadastros</h2>
          <p className="products-subtitle">Gestao de fornecedores e funcionarios para operacao administrativa.</p>
        </div>
        <div className="products-kpi">
          <strong>{currentCount}</strong>
          <span>
            {activeTab === 'FORNECEDORES'
              ? 'fornecedores'
              : activeTab === 'FUNCIONARIOS'
                ? 'funcionarios'
                : activeTab === 'CLIENTES'
                  ? 'clientes'
                  : 'convenios'}
          </span>
        </div>
      </header>

      <article className="card cadastro-tabs-card">
        <div className="cadastro-tabs-nav">
          <button
            type="button"
            className={activeTab === 'FORNECEDORES' ? 'is-active' : ''}
            onClick={() => {
              setActiveTab('FORNECEDORES');
              setShowCadastroSpan(false);
            }}
          >
            Fornecedores
          </button>
          <button
            type="button"
            className={activeTab === 'FUNCIONARIOS' ? 'is-active' : ''}
            onClick={() => {
              setActiveTab('FUNCIONARIOS');
              setShowCadastroSpan(false);
            }}
          >
            Funcionarios
          </button>
          <button
            type="button"
            className={activeTab === 'CLIENTES' ? 'is-active' : ''}
            onClick={() => {
              setActiveTab('CLIENTES');
              setShowCadastroSpan(false);
            }}
          >
            Clientes
          </button>
          <button
            type="button"
            className={activeTab === 'CONVENIOS' ? 'is-active' : ''}
            onClick={() => {
              setActiveTab('CONVENIOS');
              setShowCadastroSpan(false);
            }}
          >
            Convênios
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
                if (activeTab === 'FORNECEDORES') {
                  clearSupplierForm();
                } else if (activeTab === 'FUNCIONARIOS') {
                  clearEmployeeForm();
                } else if (activeTab === 'CLIENTES') {
                  clearClientForm();
                } else {
                  clearConvenioForm();
                }
              }

              setShowCadastroSpan((prev) => !prev);
            }}
          >
            + Novo cadastro
          </button>
        </div>
      </article>

      {activeTab === 'FORNECEDORES' && showCadastroSpan && (
        <article className="card products-cadastro-span">
          <header className="products-cadastro-header">
            <h3>Cadastro rapido | Fornecedores</h3>
          </header>

          <form onSubmit={onSubmitSupplier} className="suppliers-form">
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
                  <input id="cep" value={supplierCep} onChange={(e) => setSupplierCep(formatCep(e.target.value))} />
                </div>
                <div>
                  <label htmlFor="address">Logradouro</label>
                  <input id="address" value={supplierAddress} onChange={(e) => setSupplierAddress(e.target.value)} />
                </div>
                <div>
                  <label htmlFor="number">Numero</label>
                  <input id="number" value={supplierNumber} onChange={(e) => setSupplierNumber(e.target.value)} />
                </div>
                <div>
                  <label htmlFor="neighborhood">Bairro</label>
                  <input id="neighborhood" value={supplierNeighborhood} onChange={(e) => setSupplierNeighborhood(e.target.value)} />
                </div>
              </div>

              {(isSupplierCepLookupLoading || supplierCepSuggestionMessage) && (
                <p className="suppliers-cep-feedback">
                  {isSupplierCepLookupLoading
                    ? 'Buscando sugestao de endereco pelo CEP...'
                    : supplierCepSuggestionMessage}
                </p>
              )}

              <div className="suppliers-row-address-bottom">
                <div>
                  <label htmlFor="state">UF</label>
                  <select id="state" value={supplierState} onChange={(e) => setSupplierState(e.target.value)}>
                    {stateOptions.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="city">Cidade</label>
                  <input id="city" value={supplierCity} onChange={(e) => setSupplierCity(e.target.value)} required />
                </div>
                <div>
                  <label htmlFor="complement">Complemento</label>
                  <input id="complement" value={supplierComplement} onChange={(e) => setSupplierComplement(e.target.value)} />
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
                  <input id="phone" value={supplierPhone} onChange={(e) => setSupplierPhone(formatPhone(e.target.value))} />
                </div>
                <div>
                  <label htmlFor="mobile">Celular</label>
                  <input id="mobile" value={supplierMobile} onChange={(e) => setSupplierMobile(formatPhone(e.target.value))} />
                </div>
                <div>
                  <label htmlFor="email">E-Mail</label>
                  <input id="email" type="email" value={supplierEmail} onChange={(e) => setSupplierEmail(e.target.value)} />
                </div>
              </div>
            </section>

            <div className="products-cadastro-footer">
              <button type="submit" disabled={savingSupplier}>
                {savingSupplier ? 'Salvando...' : editingSupplierId ? 'Salvar edicao' : 'Salvar dados'}
              </button>
              <button
                type="button"
                className="button-muted"
                onClick={() => {
                  setShowCadastroSpan(false);
                  clearSupplierForm();
                }}
              >
                Fechar cadastro
              </button>
            </div>

            {supplierFormError && <p className="products-form-warning">{supplierFormError}</p>}
          </form>
        </article>
      )}

      {activeTab === 'FUNCIONARIOS' && showCadastroSpan && (
        <article className="card products-cadastro-span">
          <header className="products-cadastro-header">
            <h3>Cadastro rapido | Funcionarios</h3>
          </header>

          <form onSubmit={onSubmitEmployee} className="suppliers-form">
            <section className="suppliers-section">
              <h4>Dados basicos</h4>

              <div className="suppliers-row-3">
                <div>
                  <label htmlFor="employee-code">ID funcionario (automatico)</label>
                  <input id="employee-code" value={employeeCode} readOnly />
                </div>
                <div>
                  <label htmlFor="employee-cpf">CPF</label>
                  <input
                    id="employee-cpf"
                    value={employeeCpf}
                    onChange={(e) => setEmployeeCpf(formatCpfCnpj(e.target.value))}
                    required
                  />
                </div>
                <div>
                  <label htmlFor="employee-role">Cargo</label>
                  <select
                    id="employee-role"
                    value={employeeRole}
                    onChange={(e) => setEmployeeRole(e.target.value)}
                  >
                    {employeeRoleOptions.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="suppliers-row-2-wide">
                <div>
                  <label htmlFor="employee-full-name">Nome completo</label>
                  <input
                    id="employee-full-name"
                    value={employeeFullName}
                    onChange={(e) => setEmployeeFullName(e.target.value)}
                    required
                  />
                </div>
                <div className="employee-status-field">
                  <label>Status do funcionario</label>
                  <div className="employee-status-toggle" role="group" aria-label="Status do funcionario">
                    <button
                      type="button"
                      className={employeeActive ? 'is-active' : ''}
                      onClick={() => setEmployeeActive(true)}
                    >
                      Ativo
                    </button>
                    <button
                      type="button"
                      className={!employeeActive ? 'is-active' : ''}
                      onClick={() => setEmployeeActive(false)}
                    >
                      Inativo
                    </button>
                  </div>
                </div>
              </div>

              <div className="suppliers-row-3">
                <div>
                  <label htmlFor="employee-birth-date">Data de nascimento</label>
                  <input
                    id="employee-birth-date"
                    type="date"
                    value={employeeBirthDate}
                    onChange={(e) => setEmployeeBirthDate(e.target.value)}
                  />
                </div>
                <div>
                  <label htmlFor="employee-gender">Genero</label>
                  <select
                    id="employee-gender"
                    value={employeeGender}
                    onChange={(e) => setEmployeeGender(e.target.value as (typeof employeeGenderOptions)[number])}
                  >
                    {employeeGenderOptions.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="employee-admission-date">Data de admissao</label>
                  <input
                    id="employee-admission-date"
                    type="date"
                    value={employeeAdmissionDate}
                    onChange={(e) => setEmployeeAdmissionDate(e.target.value)}
                  />
                </div>
              </div>

              <div className="suppliers-row-3">
                <div>
                  <label htmlFor="employee-dismissal-date">Data de demissao</label>
                  <input
                    id="employee-dismissal-date"
                    type="date"
                    value={employeeDismissalDate}
                    onChange={(e) => setEmployeeDismissalDate(e.target.value)}
                  />
                </div>
                <div>
                  <label htmlFor="employee-status">Status</label>
                  <input id="employee-status" value={employeeActive ? 'ATIVO' : 'INATIVO'} readOnly />
                </div>
              </div>

              <div className="suppliers-notes-field">
                <label htmlFor="employee-notes">Observacoes</label>
                <textarea
                  id="employee-notes"
                  value={employeeNotes}
                  onChange={(e) => setEmployeeNotes(e.target.value)}
                  rows={3}
                  placeholder="Informacoes adicionais sobre o funcionario"
                />
              </div>
            </section>

            <section className="suppliers-section">
              <h4>Endereco</h4>

              <div className="suppliers-row-address-top">
                <div>
                  <label htmlFor="employee-cep">CEP</label>
                  <input
                    id="employee-cep"
                    value={employeeCep}
                    onChange={(e) => setEmployeeCep(formatCep(e.target.value))}
                  />
                </div>
                <div>
                  <label htmlFor="employee-address">Logradouro</label>
                  <input
                    id="employee-address"
                    value={employeeAddress}
                    onChange={(e) => setEmployeeAddress(e.target.value)}
                  />
                </div>
                <div>
                  <label htmlFor="employee-number">Numero</label>
                  <input
                    id="employee-number"
                    value={employeeNumber}
                    onChange={(e) => setEmployeeNumber(e.target.value)}
                  />
                </div>
                <div>
                  <label htmlFor="employee-neighborhood">Bairro</label>
                  <input
                    id="employee-neighborhood"
                    value={employeeNeighborhood}
                    onChange={(e) => setEmployeeNeighborhood(e.target.value)}
                  />
                </div>
              </div>

              {(isEmployeeCepLookupLoading || employeeCepSuggestionMessage) && (
                <p className="suppliers-cep-feedback">
                  {isEmployeeCepLookupLoading
                    ? 'Buscando sugestao de endereco pelo CEP...'
                    : employeeCepSuggestionMessage}
                </p>
              )}

              <div className="suppliers-row-address-bottom">
                <div>
                  <label htmlFor="employee-state">UF</label>
                  <select id="employee-state" value={employeeState} onChange={(e) => setEmployeeState(e.target.value)}>
                    {stateOptions.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="employee-city">Cidade</label>
                  <input
                    id="employee-city"
                    value={employeeCity}
                    onChange={(e) => setEmployeeCity(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <label htmlFor="employee-complement">Complemento</label>
                  <input
                    id="employee-complement"
                    value={employeeComplement}
                    onChange={(e) => setEmployeeComplement(e.target.value)}
                  />
                </div>
                <div>
                  <label htmlFor="employee-role-readonly">Cargo</label>
                  <input id="employee-role-readonly" value={employeeRole} readOnly />
                </div>
              </div>
            </section>

            <section className="suppliers-section">
              <h4>Contato</h4>

              <div className="suppliers-row-3">
                <div>
                  <label htmlFor="employee-phone">Telefone</label>
                  <input
                    id="employee-phone"
                    value={employeePhone}
                    onChange={(e) => setEmployeePhone(formatPhone(e.target.value))}
                  />
                </div>
                <div>
                  <label htmlFor="employee-mobile">Celular</label>
                  <input
                    id="employee-mobile"
                    value={employeeMobile}
                    onChange={(e) => setEmployeeMobile(formatPhone(e.target.value))}
                  />
                </div>
                <div>
                  <label htmlFor="employee-email">E-Mail</label>
                  <input
                    id="employee-email"
                    type="email"
                    value={employeeEmail}
                    onChange={(e) => setEmployeeEmail(e.target.value)}
                  />
                </div>
              </div>
            </section>

            <div className="products-cadastro-footer">
              <button type="submit" disabled={savingEmployee}>
                {savingEmployee ? 'Salvando...' : editingEmployeeId ? 'Salvar edicao' : 'Salvar dados'}
              </button>
              <button
                type="button"
                className="button-muted"
                onClick={() => {
                  setShowCadastroSpan(false);
                  clearEmployeeForm();
                }}
              >
                Fechar cadastro
              </button>
            </div>

            {employeeFormError && <p className="products-form-warning">{employeeFormError}</p>}
          </form>
        </article>
      )}

      {activeTab === 'CLIENTES' && showCadastroSpan && (
        <article className="card products-cadastro-span">
          <header className="products-cadastro-header">
            <h3>Cadastro rapido | Clientes</h3>
          </header>

          <form onSubmit={onSubmitClient} className="suppliers-form">
            <section className="suppliers-section">
              <h4>Dados basicos</h4>

              <div className="suppliers-row-3">
                <div>
                  <label htmlFor="client-code">ID cliente (automatico)</label>
                  <input id="client-code" value={clientCode} readOnly />
                </div>
                <div>
                  <label htmlFor="client-cpf">CPF</label>
                  <input
                    id="client-cpf"
                    value={clientCpf}
                    onChange={(e) => setClientCpf(formatCpfCnpj(e.target.value))}
                    required
                  />
                </div>
                <div>
                  <label htmlFor="client-full-name">Nome completo</label>
                  <input
                    id="client-full-name"
                    value={clientFullName}
                    onChange={(e) => setClientFullName(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="employee-status-field">
                <label>Status do cliente</label>
                <div className="employee-status-toggle" role="group" aria-label="Status do cliente">
                  <button
                    type="button"
                    className={clientActive ? 'is-active' : ''}
                    onClick={() => setClientActive(true)}
                  >
                    Ativo
                  </button>
                  <button
                    type="button"
                    className={!clientActive ? 'is-active' : ''}
                    onClick={() => setClientActive(false)}
                  >
                    Inativo
                  </button>
                </div>
              </div>
            </section>

            <section className="suppliers-section">
              <h4>Contato</h4>

              <div className="suppliers-row-3">
                <div>
                  <label htmlFor="client-phone">Telefone</label>
                  <input
                    id="client-phone"
                    value={clientPhone}
                    onChange={(e) => setClientPhone(formatPhone(e.target.value))}
                  />
                </div>
                <div>
                  <label htmlFor="client-mobile">Celular</label>
                  <input
                    id="client-mobile"
                    value={clientMobile}
                    onChange={(e) => setClientMobile(formatPhone(e.target.value))}
                  />
                </div>
                <div>
                  <label htmlFor="client-email">E-Mail</label>
                  <input
                    id="client-email"
                    type="email"
                    value={clientEmail}
                    onChange={(e) => setClientEmail(e.target.value)}
                  />
                </div>
              </div>
            </section>

            <section className="suppliers-section">
              <h4>Endereco</h4>

              <div className="suppliers-row-address-top">
                <div>
                  <label htmlFor="client-cep">CEP</label>
                  <input
                    id="client-cep"
                    value={clientCep}
                    onChange={(e) => setClientCep(formatCep(e.target.value))}
                  />
                </div>
                <div>
                  <label htmlFor="client-address">Logradouro</label>
                  <input
                    id="client-address"
                    value={clientAddress}
                    onChange={(e) => setClientAddress(e.target.value)}
                  />
                </div>
                <div>
                  <label htmlFor="client-number">Numero</label>
                  <input
                    id="client-number"
                    value={clientNumber}
                    onChange={(e) => setClientNumber(e.target.value)}
                  />
                </div>
                <div>
                  <label htmlFor="client-neighborhood">Bairro</label>
                  <input
                    id="client-neighborhood"
                    value={clientNeighborhood}
                    onChange={(e) => setClientNeighborhood(e.target.value)}
                  />
                </div>
              </div>

              {(isClientCepLookupLoading || clientCepSuggestionMessage) && (
                <p className="suppliers-cep-feedback">
                  {isClientCepLookupLoading
                    ? 'Buscando sugestao de endereco pelo CEP...'
                    : clientCepSuggestionMessage}
                </p>
              )}

              <div className="suppliers-row-address-bottom">
                <div>
                  <label htmlFor="client-state">UF</label>
                  <select id="client-state" value={clientState} onChange={(e) => setClientState(e.target.value)}>
                    {stateOptions.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="client-city">Cidade</label>
                  <input
                    id="client-city"
                    value={clientCity}
                    onChange={(e) => setClientCity(e.target.value)}
                  />
                </div>
                <div>
                  <label htmlFor="client-complement">Complemento</label>
                  <input
                    id="client-complement"
                    value={clientComplement}
                    onChange={(e) => setClientComplement(e.target.value)}
                  />
                </div>
                <div>
                  <label htmlFor="client-status">Status</label>
                  <input id="client-status" value={clientActive ? 'ATIVO' : 'INATIVO'} readOnly />
                </div>
              </div>
            </section>

            <section className="suppliers-section">
              <h4>Historico de consumo (Fiado)</h4>

              <div className="client-history-filter-row">
                <div>
                  <label htmlFor="client-history-period-start">Periodo de</label>
                  <input
                    id="client-history-period-start"
                    type="date"
                    value={clientHistoryPeriodStartInput}
                    onChange={(e) => setClientHistoryPeriodStartInput(e.target.value)}
                  />
                </div>
                <div>
                  <label htmlFor="client-history-period-end">ate</label>
                  <input
                    id="client-history-period-end"
                    type="date"
                    value={clientHistoryPeriodEndInput}
                    onChange={(e) => setClientHistoryPeriodEndInput(e.target.value)}
                  />
                </div>
                <button type="button" onClick={applyClientHistoryPeriodFilter}>
                  Buscar
                </button>
                <button type="button" className="button-muted" onClick={clearClientHistoryPeriodFilter}>
                  Limpar
                </button>
              </div>

              <div className="client-history-input-row">
                <input
                  id="client-consumption-description"
                  value={clientConsumptionDescription}
                  onChange={(e) => setClientConsumptionDescription(e.target.value)}
                  placeholder="Descreva o lancamento de consumo fiado"
                />
                <button type="button" onClick={addClientConsumptionEntry}>
                  Lancar com data/hora
                </button>
              </div>

              {clientConsumptionHistory.length === 0 ? (
                <p className="client-history-empty">Nenhum consumo lancado para este cliente.</p>
              ) : filteredClientConsumptionHistory.length === 0 ? (
                <p className="client-history-empty">Nenhum consumo encontrado no periodo selecionado.</p>
              ) : (
                <ul className="client-history-list">
                  {filteredClientConsumptionHistory.map((entry) => (
                    <li key={entry.id}>
                      <div>
                        <strong>{entry.launchedAt}</strong>
                        <span>{entry.description}</span>
                      </div>
                      <button type="button" className="products-delete-button" onClick={() => removeClientConsumptionEntry(entry.id)}>
                        Remover
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <div className="products-cadastro-footer">
              <button type="submit" disabled={savingClient}>
                {savingClient ? 'Salvando...' : editingClientId ? 'Salvar edicao' : 'Salvar dados'}
              </button>
              <button
                type="button"
                className="button-muted"
                onClick={() => {
                  setShowCadastroSpan(false);
                  clearClientForm();
                }}
              >
                Fechar cadastro
              </button>
            </div>

            {clientFormError && <p className="products-form-warning">{clientFormError}</p>}
          </form>
        </article>
      )}

      {activeTab === 'CONVENIOS' && showCadastroSpan && (
        <article className="card products-cadastro-span">
          <header className="products-cadastro-header">
            <h3>Cadastro rapido | Convênios</h3>
          </header>

          <form onSubmit={onSubmitConvenio} className="suppliers-form">
            <section className="suppliers-section">
              <h4>Dados basicos</h4>

              <div className="suppliers-row-3">
                <div>
                  <label htmlFor="convenio-code">ID convenio (automatico)</label>
                  <input id="convenio-code" value={convenioCode} readOnly />
                </div>
                <div>
                  <label htmlFor="convenio-name">Nome do convenio</label>
                  <input
                    id="convenio-name"
                    value={convenioName}
                    onChange={(e) => setConvenioName(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <label htmlFor="convenio-payment-method">Meio de pagamento</label>
                  <select
                    id="convenio-payment-method"
                    value={convenioPaymentMethod}
                    onChange={(e) => setConvenioPaymentMethod(e.target.value as typeof convenioPaymentMethodOptions[number])}
                  >
                    {convenioPaymentMethodOptions.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="suppliers-row-3">
                <div>
                  <label htmlFor="convenio-cash-flow">Direcao</label>
                  <select
                    id="convenio-cash-flow"
                    value={convenioCashFlow}
                    onChange={(e) => setConvenioCashFlow(e.target.value as typeof convenioCashFlowOptions[number])}
                  >
                    {convenioCashFlowOptions.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="convenio-bank-name">Banco / Origem</label>
                  <input
                    id="convenio-bank-name"
                    value={convenioBankName}
                    onChange={(e) => setConvenioBankName(e.target.value)}
                    placeholder="Ex: Banco Z"
                  />
                </div>
                <div>
                  <label htmlFor="convenio-account-name">Conta / Destino</label>
                  <input
                    id="convenio-account-name"
                    value={convenioAccountName}
                    onChange={(e) => setConvenioAccountName(e.target.value)}
                    placeholder="Ex: Conta corrente"
                  />
                </div>
              </div>

              <div className="employee-status-field">
                <label>Status do convenio</label>
                <div className="employee-status-toggle" role="group" aria-label="Status do convenio">
                  <button type="button" className={convenioActive ? 'is-active' : ''} onClick={() => setConvenioActive(true)}>
                    Ativo
                  </button>
                  <button type="button" className={!convenioActive ? 'is-active' : ''} onClick={() => setConvenioActive(false)}>
                    Inativo
                  </button>
                </div>
              </div>
            </section>

            <section className="suppliers-section">
              <h4>Observacoes</h4>
              <div className="suppliers-notes-field">
                <label htmlFor="convenio-notes">Notas</label>
                <textarea
                  id="convenio-notes"
                  value={convenioNotes}
                  onChange={(e) => setConvenioNotes(e.target.value)}
                  rows={4}
                  placeholder="Ex: PIX Banco Z, dinheiro em especie, convenios de cartao, saidas e entradas"
                />
              </div>
            </section>

            <div className="products-cadastro-footer">
              <button type="submit" disabled={savingConvenio}>
                {savingConvenio ? 'Salvando...' : editingConvenioId ? 'Salvar edicao' : 'Salvar dados'}
              </button>
              <button
                type="button"
                className="button-muted"
                onClick={() => {
                  setShowCadastroSpan(false);
                  clearConvenioForm();
                }}
              >
                Fechar cadastro
              </button>
            </div>

            {convenioFormError && <p className="products-form-warning">{convenioFormError}</p>}
          </form>
        </article>
      )}

      {activeTab === 'FORNECEDORES' && (
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
      )}

      {activeTab === 'FUNCIONARIOS' && (
        <article className="card products-list-card">
          <h3>Funcionarios ativos</h3>

          {employeeRows.length === 0 ? (
            <p className="empty-state">Nenhum funcionario cadastrado ainda.</p>
          ) : (
            <ul className="products-list suppliers-list">
              {employeeRows.map((employee) => (
                <li key={employee.id}>
                  <div>
                    <strong>
                      <span className="products-id-tag">ID {employee.employeeCode ?? parseLegacyEmployeeCode(employee.fullName) ?? '--'}</span>{' '}
                      {employee.fullName}
                    </strong>
                    <span>{employee.role}</span>
                    <span>
                      {employee.city} - {employee.state} | CPF {employee.cpf}
                    </span>
                    <span>
                      Nascimento: {employee.birthDate || '-'} | Genero: {employee.gender || '-'}
                    </span>
                    <span>
                      Admissao: {employee.admissionDate || '-'} | Demissao: {employee.dismissalDate || '-'}
                    </span>
                  </div>
                  <div>
                    <span>
                      Contato: {employee.mobile || employee.phone || '-'}{' '}
                      {employee.mobile && (
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
                    <span>E-mail: {employee.email || '-'}</span>
                    <span>Status: {employee.active ? 'ATIVO' : 'INATIVO'}</span>
                    <div className="products-row-actions">
                      <button type="button" className="products-edit-button" onClick={() => onEditEmployee(employee.id)}>
                        Editar
                      </button>
                      <button
                        type="button"
                        className="products-delete-button"
                        onClick={() => void onDeleteEmployee(employee.id)}
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
      )}

      {activeTab === 'CLIENTES' && (
        <article className="card products-list-card">
          <h3>Clientes cadastrados</h3>

          {clientRows.length === 0 ? (
            <p className="empty-state">Nenhum cliente cadastrado ainda.</p>
          ) : (
            <ul className="products-list suppliers-list">
              {clientRows.map((client) => (
                <li key={client.id}>
                  <div>
                    <strong>
                      <span className="products-id-tag">ID {client.clientCode ?? parseLegacyClientCode(client.fullName) ?? '--'}</span>{' '}
                      {client.fullName}
                    </strong>
                    <span>CPF {client.cpf}</span>
                    <span>
                      {client.city || '-'} - {client.state || '-'}
                    </span>
                    <span>
                      Contato: {client.mobile || client.phone || '-'} | E-mail: {client.email || '-'}
                    </span>
                    <span>Status: {client.active ? 'ATIVO' : 'INATIVO'}</span>
                    <span>Historico fiado: {client.consumptionHistory.length} lancamento(s)</span>
                  </div>
                  <div>
                    {client.consumptionHistory.length > 0 && (
                      <div className="client-history-list-preview">
                        <strong>Ultimo lancamento</strong>
                        <span>{client.consumptionHistory[0]?.launchedAt}</span>
                        <span>{client.consumptionHistory[0]?.description}</span>
                      </div>
                    )}
                    <div className="products-row-actions">
                      <button type="button" className="products-edit-button" onClick={() => onEditClient(client.id)}>
                        Editar
                      </button>
                      <button
                        type="button"
                        className="products-delete-button"
                        onClick={() => void onDeleteClient(client.id)}
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
      )}

      {activeTab === 'CONVENIOS' && (
        <article className="card products-list-card">
          <h3>Convênios cadastrados</h3>

          {convenioRows.length === 0 ? (
            <p className="empty-state">Nenhum convênio cadastrado ainda.</p>
          ) : (
            <ul className="products-list suppliers-list">
              {convenioRows.map((convenio) => (
                <li key={convenio.id}>
                  <div>
                    <strong>
                      <span className="products-id-tag">ID {convenio.convenioCode ?? parseLegacyConvenioCode(convenio.name) ?? '--'}</span>{' '}
                      {convenio.name}
                    </strong>
                    <span>
                      {convenio.paymentMethod} | {convenio.cashFlow}
                    </span>
                    <span>
                      {convenio.bankName || 'Sem banco informado'}
                      {convenio.accountName ? ` | ${convenio.accountName}` : ''}
                    </span>
                    <span>Status: {convenio.active ? 'ATIVO' : 'INATIVO'}</span>
                  </div>
                  <div>
                    <span>{convenio.notes || 'Sem observacoes'}</span>
                    <div className="products-row-actions">
                      <button type="button" className="products-edit-button" onClick={() => onEditConvenio(convenio.id)}>
                        Editar
                      </button>
                      <button
                        type="button"
                        className="products-delete-button"
                        onClick={() => void onDeleteConvenio(convenio.id)}
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
      )}
    </section>
  );
}
