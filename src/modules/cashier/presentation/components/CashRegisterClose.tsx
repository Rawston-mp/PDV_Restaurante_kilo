import { useMemo, useState } from 'react';
import { ArrowLeft, CheckCircle2, AlertCircle, TrendingUp, Delete } from 'lucide-react';
import { useClientsQuery } from '@/modules/clients/presentation/hooks/useClientsQuery';
import { formatBRL } from '../../types';

// ─── Types ────────────────────────────────────────────────────────────────────

type BlindRow = {
  method: string;
  label: string;
  counted: string;     // raw input
  expected: number;    // from system (revealed only after confirm)
};

type CloseStep = 'input' | 'result';
type AdminTab = 'MENU' | 'FECHAMENTO' | 'ADMINISTRATIVO';
type AdminSection = 'INICIO' | 'RECEBIMENTO_FIADO';
type ClientPeriodFilter = 'ALL' | 'CURRENT_MONTH' | 'CUSTOM';

const parsePtBrCurrency = (value: string) => {
  const normalized = value.replace(/\./g, '').replace(',', '.').trim();
  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
};

const extractEntryAmount = (description: string) => {
  const totalMatch = description.match(/total\s*r\$\s*([\d.,]+)/i);
  if (totalMatch) {
    return parsePtBrCurrency(totalMatch[1]);
  }

  const genericMatch = description.match(/r\$\s*([\d.,]+)/i);
  if (genericMatch) {
    return parsePtBrCurrency(genericMatch[1]);
  }

  return 0;
};

const parsePtBrDateTime = (value: string) => {
  const matched = value.match(/^(\d{2})\/(\d{2})\/(\d{4})(?:\s+(\d{2}):(\d{2}))?/);
  if (!matched) {
    return null;
  }

  const day = Number.parseInt(matched[1], 10);
  const month = Number.parseInt(matched[2], 10) - 1;
  const year = Number.parseInt(matched[3], 10);
  const hour = Number.parseInt(matched[4] ?? '0', 10);
  const minute = Number.parseInt(matched[5] ?? '0', 10);

  const parsedDate = new Date(year, month, day, hour, minute, 0, 0);
  return Number.isNaN(parsedDate.getTime()) ? null : parsedDate;
};

// ─── Pre-populated methods for the blind count ────────────────────────────────
const CLOSE_METHODS: Omit<BlindRow, 'counted' | 'expected'>[] = [
  { method: 'DINHEIRO',  label: 'Dinheiro' },
  { method: 'DEBITO',    label: 'Cartão Débito' },
  { method: 'CREDITO',   label: 'Cartão Crédito' },
  { method: 'PIX',       label: 'PIX' },
  { method: 'FIADO',     label: 'Fiado' },
  { method: 'TICKET',    label: 'Ticket' },
];


// ─── Simple numpad for cash close ─────────────────────────────────────────────
function MiniNumpad({ onKey }: { onKey: (k: string) => void }) {
  const keys = ['7','8','9','4','5','6','1','2','3','0',',','⌫'];
  return (
    <div className="grid grid-cols-3 gap-1.5">
      {keys.map((k) => (
        <button
          key={k}
          type="button"
          onClick={() => onKey(k)}
          className={`
            h-11 rounded-lg font-semibold text-base
            border transition-all duration-100 active:scale-95
            ${k === '⌫'
              ? 'border-red-200 bg-red-50 text-red-600 hover:bg-red-100'
              : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
            }
          `}
        >
          {k === '⌫' ? <Delete size={16} className="mx-auto" /> : k}
        </button>
      ))}
    </div>
  );
}

// ─── Status badge ─────────────────────────────────────────────────────────────
function StatusBadge({ diff }: { diff: number }) {
  if (Math.abs(diff) < 0.01) {
    return (
      <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-700">
        <CheckCircle2 size={12} /> Correto
      </span>
    );
  }
  if (diff > 0) {
    return (
      <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-orange-100 text-orange-700">
        <TrendingUp size={12} /> Sobra
      </span>
    );
  }
  return (
    <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-red-100 text-red-700">
      <AlertCircle size={12} /> Quebra
    </span>
  );
}

// ─── Mini bar chart ───────────────────────────────────────────────────────────
function BarChart({ rows }: { rows: BlindRow[] }) {
  const maxExpected = Math.max(...rows.map((r) => r.expected), 1);
  return (
    <div className="space-y-2">
      {rows
        .filter((r) => r.expected > 0 || parseFloat(r.counted.replace(',', '.')) > 0)
        .map((r) => {
          const counted = parseFloat(r.counted.replace(',', '.')) || 0;
          const pctExpected = (r.expected / maxExpected) * 100;
          const pctCounted  = (counted    / maxExpected) * 100;
          return (
            <div key={r.method} className="text-xs text-slate-600">
              <div className="flex justify-between mb-0.5">
                <span className="font-medium">{r.label}</span>
                <span className="text-slate-500">{formatBRL(r.expected)}</span>
              </div>
              {/* Expected bar */}
              <div className="h-2 rounded-full bg-slate-100 mb-0.5 overflow-hidden">
                <div
                  className="h-full rounded-full bg-blue-300 transition-all duration-500"
                  style={{ width: `${pctExpected}%` }}
                />
              </div>
              {/* Counted bar */}
              <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                <div
                  className="h-full rounded-full bg-emerald-400 transition-all duration-500"
                  style={{ width: `${pctCounted}%` }}
                />
              </div>
            </div>
          );
        })}
      <div className="flex gap-4 pt-1">
        <span className="flex items-center gap-1 text-xs text-slate-500">
          <span className="inline-block w-3 h-2 rounded-full bg-blue-300" /> Esperado
        </span>
        <span className="flex items-center gap-1 text-xs text-slate-500">
          <span className="inline-block w-3 h-2 rounded-full bg-emerald-400" /> Contado
        </span>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

type CashRegisterCloseProps = {
  onBack: () => void;
  onClose: () => void;
  onGoToProductSearch: () => void;
  onReprintReceipt: () => void;
  onSendFiscalFiles: () => void;
  onConsultStock: () => void;
  onCancelLastSale: () => void;
  onCancelCoupons: () => void;
  onClearComandaCache: () => void;
  loadExpectedTotals?: () => Promise<Record<string, number>> | Record<string, number>;
  initialTab?: AdminTab;
  initialSection?: AdminSection;
  items?: Array<{
    id: string;
    name: string;
    quantity: number;
    unit: 'KG' | 'UN';
    productCode?: string;
    barcode?: string;
    ncm?: string;
    cfop?: string;
    taxSituationCode?: string;
    fiscalType?: string;
  }>;
};

export function CashRegisterClose({
  onBack,
  onClose,
  onGoToProductSearch,
  onReprintReceipt,
  onSendFiscalFiles,
  onConsultStock,
  onCancelLastSale,
  onCancelCoupons,
  onClearComandaCache,
  loadExpectedTotals,
  initialTab = 'MENU',
  initialSection = 'INICIO',
  items = []
}: CashRegisterCloseProps) {
  const { clients } = useClientsQuery();
  const [step, setStep] = useState<CloseStep>('input');
  const [adminTab, setAdminTab] = useState<AdminTab>(initialTab);
  const [adminSection, setAdminSection] = useState<AdminSection>(initialSection);
  const [clientQuery, setClientQuery] = useState('');
  const [selectedClientId, setSelectedClientId] = useState<string>('');
  const [clientPeriodFilter, setClientPeriodFilter] = useState<ClientPeriodFilter>('ALL');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [rows, setRows] = useState<BlindRow[]>(
    CLOSE_METHODS.map((m) => ({ ...m, counted: '', expected: 0 }))
  );
  const [activeRow, setActiveRow] = useState<string>('DINHEIRO');
  const [isLoadingExpected, setIsLoadingExpected] = useState(false);
  const [expectedError, setExpectedError] = useState<string | null>(null);

  const filteredClients = useMemo(() => {
    const normalizedQuery = clientQuery.trim().toLowerCase();

    return clients
      .filter((client) => client.active)
      .filter((client) => {
        if (!normalizedQuery) {
          return true;
        }

        const haystack = `${client.fullName} ${client.clientCode} ${client.cpf}`.toLowerCase();
        return haystack.includes(normalizedQuery);
      })
      .sort((a, b) => a.fullName.localeCompare(b.fullName, 'pt-BR'));
  }, [clientQuery, clients]);

  const selectedClient = useMemo(() => {
    if (!selectedClientId) {
      return null;
    }

    return filteredClients.find((client) => client.id === selectedClientId) ?? null;
  }, [filteredClients, selectedClientId]);

  const enterAdministrative = () => {
    setAdminTab('ADMINISTRATIVO');
    setAdminSection('INICIO');
    setSelectedClientId('');
  };

  const enterRecebimentoFiado = () => {
    setAdminTab('ADMINISTRATIVO');
    setAdminSection('RECEBIMENTO_FIADO');
    setSelectedClientId('');
  };

  const enterFechamento = () => {
    setAdminTab('FECHAMENTO');
    setStep('input');
    setSelectedClientId('');
  };

  const selectedClientEntries = useMemo(() => {
    return selectedClient?.consumptionHistory ?? [];
  }, [selectedClient]);

  const filteredClientEntries = useMemo(() => {
    if (clientPeriodFilter === 'ALL') {
      return selectedClientEntries;
    }

    const now = new Date();
    if (clientPeriodFilter === 'CURRENT_MONTH') {
      return selectedClientEntries.filter((entry) => {
        const parsedDate = parsePtBrDateTime(entry.launchedAt);
        if (!parsedDate) {
          return false;
        }

        return parsedDate.getMonth() === now.getMonth() && parsedDate.getFullYear() === now.getFullYear();
      });
    }

    const start = customStartDate ? new Date(`${customStartDate}T00:00:00`) : null;
    const end = customEndDate ? new Date(`${customEndDate}T23:59:59`) : null;

    return selectedClientEntries.filter((entry) => {
      const parsedDate = parsePtBrDateTime(entry.launchedAt);
      if (!parsedDate) {
        return false;
      }

      if (start && parsedDate < start) {
        return false;
      }

      if (end && parsedDate > end) {
        return false;
      }

      return true;
    });
  }, [clientPeriodFilter, customEndDate, customStartDate, selectedClientEntries]);

  const totalClientHistory = useMemo(
    () => selectedClientEntries.reduce((sum, entry) => sum + extractEntryAmount(entry.description), 0),
    [selectedClientEntries]
  );

  const totalFilteredHistory = useMemo(
    () => filteredClientEntries.reduce((sum, entry) => sum + extractEntryAmount(entry.description), 0),
    [filteredClientEntries]
  );

  const exportPeriodLabel = useMemo(() => {
    if (clientPeriodFilter === 'ALL') {
      return 'Todo o historico';
    }

    if (clientPeriodFilter === 'CURRENT_MONTH') {
      return 'Mes atual';
    }

    const from = customStartDate || '--';
    const to = customEndDate || '--';
    return `Intervalo ${from} a ${to}`;
  }, [clientPeriodFilter, customEndDate, customStartDate]);

  // ── Numpad ────────────────────────────────────────────────────────────────
  const handleKey = (k: string) => {
    setRows((prev) =>
      prev.map((r) => {
        if (r.method !== activeRow) return r;
        if (k === '⌫') return { ...r, counted: r.counted.slice(0, -1) };
        if (k === ',' && r.counted.includes(',')) return r;
        if (r.counted.length >= 10) return r;
        return { ...r, counted: r.counted + k };
      })
    );
  };

  const parseCounted = (raw: string) => parseFloat(raw.replace(',', '.')) || 0;

  const handleConfirmBlindClose = async () => {
    setIsLoadingExpected(true);
    setExpectedError(null);

    try {
      const expectedTotals = loadExpectedTotals ? await loadExpectedTotals() : {};
      setRows((currentRows) =>
        currentRows.map((row) => ({
          ...row,
          expected: expectedTotals[row.method] ?? 0
        }))
      );
      setStep('result');
    } catch {
      setExpectedError('Nao foi possivel carregar os valores esperados do caixa. Confira a conexao e tente novamente.');
    } finally {
      setIsLoadingExpected(false);
    }
  };

  const exportClientHistoryToPdf = (clientId: string, periodEntries: typeof filteredClientEntries, periodLabel: string) => {
    const targetClient = clients.find((client) => client.id === clientId);
    if (!targetClient) {
      return;
    }

    const opened = window.open('', '_blank', 'width=820,height=900');
    if (!opened) {
      return;
    }

    const rowsHtml = periodEntries.length === 0
      ? '<tr><td colspan="3" style="padding:12px;text-align:center;color:#64748b;">Nenhum lancamento de fiado no periodo selecionado.</td></tr>'
      : periodEntries
          .map((entry) => {
            const escapedDescription = entry.description
              .replaceAll('&', '&amp;')
              .replaceAll('<', '&lt;')
              .replaceAll('>', '&gt;');
            const amount = extractEntryAmount(entry.description);
            return `<tr><td style="padding:10px;border-bottom:1px solid #e2e8f0;">${entry.launchedAt}</td><td style="padding:10px;border-bottom:1px solid #e2e8f0;">${escapedDescription}</td><td style="padding:10px;border-bottom:1px solid #e2e8f0; text-align:right;">${amount > 0 ? formatBRL(amount) : '-'}</td></tr>`;
          })
          .join('');

    const totalPeriod = periodEntries.reduce((sum, entry) => sum + extractEntryAmount(entry.description), 0);

    opened.document.write(`
      <html>
        <head>
          <title>Fatura de fiado - ${targetClient.fullName}</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 24px; color: #0f172a; }
            h1 { margin: 0 0 6px; font-size: 22px; }
            p { margin: 0 0 8px; color: #475569; }
            .meta { margin: 14px 0 20px; padding: 12px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; }
            table { width: 100%; border-collapse: collapse; font-size: 13px; }
            th { text-align: left; padding: 10px; background: #e2e8f0; color: #1e293b; border-bottom: 1px solid #cbd5e1; }
            @media print { body { margin: 12px; } }
          </style>
        </head>
        <body>
          <h1>Extrato de Fiado</h1>
          <p>Documento para envio ao cliente.</p>
          <div class="meta">
            <p><strong>Cliente:</strong> ${targetClient.fullName}</p>
            <p><strong>ID:</strong> ${targetClient.clientCode || '--'}</p>
            <p><strong>CPF:</strong> ${targetClient.cpf || '--'}</p>
            <p><strong>Periodo:</strong> ${periodLabel}</p>
            <p><strong>Data de emissao:</strong> ${new Date().toLocaleString('pt-BR')}</p>
            <p><strong>Total do periodo:</strong> ${formatBRL(totalPeriod)}</p>
          </div>
          <table>
            <thead>
              <tr>
                <th style="width: 28%;">Data</th>
                <th>Descricao</th>
                <th style="width: 18%; text-align:right;">Valor</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml}
            </tbody>
          </table>
          <script>
            window.onload = function () {
              window.print();
            };
          </script>
        </body>
      </html>
    `);
    opened.document.close();
  };

  const totalCounted  = rows.reduce((s, r) => s + parseCounted(r.counted), 0);
  const totalExpected = rows.reduce((s, r) => s + r.expected, 0);
  const totalDiff     = totalCounted - totalExpected;
  const fiscalItems = items.map((item) => item);

  if (adminTab === 'MENU') {
    const menuTileBase = 'rounded-xl border border-slate-300 bg-white px-4 py-3 text-left transition-colors';

    return (
      <div className="flex flex-col h-full bg-slate-100">
        <header className="flex items-center justify-between gap-3 px-4 py-3 bg-white border-b border-slate-200">
          <div className="flex items-center gap-3">
            <button type="button" onClick={onBack} className="p-2 rounded-lg border border-slate-300 hover:bg-slate-50 text-slate-600">
              <ArrowLeft size={18} />
            </button>
            <div>
              <h2 className="font-bold text-slate-800">Outras funções</h2>
              <p className="text-xs text-slate-500">Menu operacional do caixa</p>
            </div>
          </div>
        </header>

        <div className="flex-1 min-h-0 overflow-y-auto p-4">
          <div className="grid grid-cols-1 xl:grid-cols-[2.1fr_1fr_1fr] gap-4">
            <section className="bg-slate-200/40 rounded-xl p-3 border border-slate-300/60">
              <h3 className="text-base font-bold text-slate-700 mb-3">Caixa</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                <button type="button" onClick={enterFechamento} className={`${menuTileBase} hover:bg-sky-50 hover:border-sky-300`}>
                  <p className="text-sm font-semibold text-slate-800">Fechamento de caixa (F11)</p>
                  <p className="text-xs text-slate-500">Fechamento de caixa e conferência</p>
                </button>
                <button type="button" onClick={onGoToProductSearch} className={`${menuTileBase} hover:bg-sky-50 hover:border-sky-300`}>
                  <p className="text-sm font-semibold text-slate-800">Pesquisa de produtos (F7)</p>
                  <p className="text-xs text-slate-500">Consultar catálogo rápido</p>
                </button>
                <button type="button" onClick={onReprintReceipt} className={`${menuTileBase} hover:bg-sky-50 hover:border-sky-300`}>
                  <p className="text-sm font-semibold text-slate-800">Reimprimir cupom</p>
                  <p className="text-xs text-slate-500">Gerar nova via do comprovante</p>
                </button>
                <button type="button" onClick={onConsultStock} className={`${menuTileBase} hover:bg-sky-50 hover:border-sky-300`}>
                  <p className="text-sm font-semibold text-slate-800">Consultar estoque</p>
                  <p className="text-xs text-slate-500">Consulta rápida de disponibilidade</p>
                </button>
                <button type="button" onClick={onCancelLastSale} className={`${menuTileBase} hover:bg-red-50 hover:border-red-300`}>
                  <p className="text-sm font-semibold text-slate-800">Cancelar última venda (F8)</p>
                  <p className="text-xs text-slate-500">Desfaz a venda atual no caixa</p>
                </button>
                <button type="button" onClick={onCancelCoupons} className={`${menuTileBase} hover:bg-red-50 hover:border-red-300`}>
                  <p className="text-sm font-semibold text-slate-800">Cancelar cupons (Alt+C)</p>
                  <p className="text-xs text-slate-500">Cancela o cupom fiscal em andamento</p>
                </button>
                <button type="button" onClick={onClearComandaCache} className={`${menuTileBase} hover:bg-amber-50 hover:border-amber-300`}>
                  <p className="text-sm font-semibold text-slate-800">Limpar cache de comandas</p>
                  <p className="text-xs text-slate-500">Remove snapshots locais de comandas no caixa</p>
                </button>
              </div>
            </section>

            <section className="bg-slate-200/40 rounded-xl p-3 border border-slate-300/60">
              <h3 className="text-base font-bold text-slate-700 mb-3">Cliente</h3>
              <div className="grid grid-cols-1 gap-2">
                <button type="button" onClick={enterAdministrative} className={`${menuTileBase} hover:bg-sky-50 hover:border-sky-300`}>
                  <p className="text-sm font-semibold text-slate-800">Administrativos</p>
                  <p className="text-xs text-slate-500">Área administrativa geral</p>
                </button>
                <button type="button" onClick={enterRecebimentoFiado} className={`${menuTileBase} hover:bg-sky-50 hover:border-sky-300`}>
                  <p className="text-sm font-semibold">Recebimento de fiado (F4)</p>
                  <p className="text-xs text-slate-500">Acessar clientes e histórico de fiado</p>
                </button>
              </div>
            </section>

            <section className="bg-slate-200/40 rounded-xl p-3 border border-slate-300/60">
              <h3 className="text-base font-bold text-slate-700 mb-3">Fiscal / Outros</h3>
              <div className="grid grid-cols-1 gap-2">
                <button type="button" onClick={onSendFiscalFiles} className={`${menuTileBase} hover:bg-sky-50 hover:border-sky-300`}>
                  <p className="text-sm font-semibold text-slate-800">Enviar arquivos fiscais</p>
                  <p className="text-xs text-slate-500">Sincronizar arquivos fiscais pendentes</p>
                </button>
                <button type="button" className="rounded-xl border border-slate-200 bg-slate-100 px-4 py-3 text-left text-slate-400 cursor-not-allowed" disabled>
                  <p className="text-sm font-semibold">Relatórios gerenciais</p>
                  <p className="text-xs">(em breve)</p>
                </button>
                <button type="button" onClick={onBack} className={`${menuTileBase} hover:bg-emerald-50 hover:border-emerald-300`}>
                  <p className="text-sm font-semibold text-slate-800">Voltar</p>
                  <p className="text-xs text-slate-500">Retornar ao caixa</p>
                </button>
              </div>
            </section>
          </div>
        </div>
      </div>
    );
  }

  if (adminTab === 'ADMINISTRATIVO') {
    return (
      <div className="flex flex-col h-full bg-slate-50">
        <header className="flex items-center justify-between gap-3 px-4 py-3 bg-white border-b border-slate-200">
          <div className="flex items-center gap-3">
            <button type="button" onClick={onBack} className="p-2 rounded-lg hover:bg-slate-100 text-slate-500">
              <ArrowLeft size={20} />
            </button>
            <div>
              <h2 className="font-bold text-slate-800">Área Administrativa</h2>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setAdminTab('MENU')}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-slate-300 text-slate-600 hover:bg-slate-100"
            >
              Menu
            </button>
            <button
              type="button"
              onClick={() => setAdminTab('ADMINISTRATIVO')}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-sky-300 bg-sky-50 text-sky-700"
            >
              Administrativos
            </button>
          </div>
        </header>

        {adminSection === 'INICIO' ? (
          <div className="flex-1 grid place-items-center p-4">
            <p className="text-sm text-slate-500">Selecione um módulo no menu principal.</p>
          </div>
        ) : (
          <div className="flex-1 min-h-0 grid grid-cols-[320px_1fr] gap-3 p-3 overflow-hidden">
            <section className="bg-white border border-slate-200 rounded-xl p-3 overflow-y-auto">
            <label htmlFor="admin-client-search" className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Buscar cliente
            </label>
            <input
              id="admin-client-search"
              value={clientQuery}
              onChange={(event) => setClientQuery(event.target.value)}
              placeholder="Nome, ID ou CPF"
              className="mt-2 mb-3 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />

            <div className="space-y-2">
              {filteredClients.length === 0 ? (
                <p className="text-sm text-slate-500">Nenhum cliente ativo encontrado.</p>
              ) : (
                filteredClients.map((client) => {
                  const isActive = client.id === (selectedClient?.id ?? '');
                  return (
                    <button
                      key={client.id}
                      type="button"
                      onClick={() => setSelectedClientId(client.id)}
                      className={`w-full rounded-lg border px-3 py-2 text-left transition-colors ${isActive ? 'border-sky-300 bg-sky-50' : 'border-slate-200 hover:bg-slate-50'}`}
                    >
                      <p className="text-sm font-semibold text-slate-800">{client.fullName}</p>
                      <p className="text-xs text-slate-500">ID {client.clientCode || '--'} · CPF {client.cpf || '--'}</p>
                    </button>
                  );
                })
              )}
            </div>
            </section>

            <section className="bg-white border border-slate-200 rounded-xl p-3 flex flex-col min-h-0">
            {selectedClient ? (
              <>
                <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-100">
                  <div>
                    <h3 className="text-lg font-bold text-slate-800">{selectedClient.fullName}</h3>
                    <p className="text-xs text-slate-500">Recebimento de fiado e historico de lancamentos</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => exportClientHistoryToPdf(selectedClient.id, filteredClientEntries, exportPeriodLabel)}
                    className="px-3 py-2 rounded-lg border border-sky-300 bg-sky-50 text-sky-700 text-sm font-semibold hover:bg-sky-100"
                  >
                    Exportar PDF
                  </button>
                </div>

                <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="rounded-lg border border-slate-200 p-3 bg-slate-50">
                    <p className="text-xs uppercase tracking-wide text-slate-500">Saldo fiado (periodo)</p>
                    <p className="text-2xl font-extrabold text-slate-800">{formatBRL(totalFilteredHistory)}</p>
                    <p className="text-xs text-slate-500 mt-1">{exportPeriodLabel}</p>
                  </div>
                  <div className="rounded-lg border border-slate-200 p-3 bg-slate-50">
                    <p className="text-xs uppercase tracking-wide text-slate-500">Saldo fiado (historico total)</p>
                    <p className="text-2xl font-extrabold text-slate-800">{formatBRL(totalClientHistory)}</p>
                    <p className="text-xs text-slate-500 mt-1">Todos os lancamentos do cliente</p>
                  </div>
                </div>

                <div className="mt-3 rounded-lg border border-slate-100 p-3 bg-white">
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">Filtro de periodo</p>
                  <div className="flex flex-wrap gap-2 mb-3">
                    <button
                      type="button"
                      onClick={() => setClientPeriodFilter('ALL')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold border ${clientPeriodFilter === 'ALL' ? 'border-sky-300 bg-sky-50 text-sky-700' : 'border-slate-300 text-slate-600 hover:bg-slate-50'}`}
                    >
                      Todo historico
                    </button>
                    <button
                      type="button"
                      onClick={() => setClientPeriodFilter('CURRENT_MONTH')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold border ${clientPeriodFilter === 'CURRENT_MONTH' ? 'border-sky-300 bg-sky-50 text-sky-700' : 'border-slate-300 text-slate-600 hover:bg-slate-50'}`}
                    >
                      Mes atual
                    </button>
                    <button
                      type="button"
                      onClick={() => setClientPeriodFilter('CUSTOM')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold border ${clientPeriodFilter === 'CUSTOM' ? 'border-sky-300 bg-sky-50 text-sky-700' : 'border-slate-300 text-slate-600 hover:bg-slate-50'}`}
                    >
                      Intervalo
                    </button>
                  </div>

                  {clientPeriodFilter === 'CUSTOM' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      <label className="text-xs text-slate-600">
                        De
                        <input
                          type="date"
                          value={customStartDate}
                          onChange={(event) => setCustomStartDate(event.target.value)}
                          className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
                        />
                      </label>
                      <label className="text-xs text-slate-600">
                        Ate
                        <input
                          type="date"
                          value={customEndDate}
                          onChange={(event) => setCustomEndDate(event.target.value)}
                          className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
                        />
                      </label>
                    </div>
                  )}
                </div>

                <div className="mt-3 flex-1 min-h-0 overflow-y-auto rounded-lg border border-slate-100">
                  {filteredClientEntries.length === 0 ? (
                    <p className="p-4 text-sm text-slate-500">Nenhum historico de fiado para o periodo selecionado.</p>
                  ) : (
                    <table className="w-full text-sm">
                      <thead className="bg-slate-50 text-slate-600 text-xs uppercase tracking-wider">
                        <tr>
                          <th className="text-left px-3 py-2">Data</th>
                          <th className="text-left px-3 py-2">Descricao</th>
                          <th className="text-right px-3 py-2">Valor</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredClientEntries.map((entry) => (
                          <tr key={entry.id} className="border-t border-slate-100">
                            <td className="px-3 py-2 text-slate-600 whitespace-nowrap">{entry.launchedAt}</td>
                            <td className="px-3 py-2 text-slate-700">{entry.description}</td>
                            <td className="px-3 py-2 text-right text-slate-800 font-semibold">{extractEntryAmount(entry.description) > 0 ? formatBRL(extractEntryAmount(entry.description)) : '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </>
            ) : (
              <p className="text-sm text-slate-500">Selecione um cliente para visualizar o historico.</p>
            )}
            </section>
          </div>
        )}
      </div>
    );
  }

  // ── INPUT step ─────────────────────────────────────────────────────────────
  if (step === 'input') {
    return (
      <div className="flex flex-col h-full bg-slate-50">
        <header className="flex items-center gap-3 px-4 py-3 bg-white border-b border-slate-200">
          <button type="button" onClick={() => setAdminTab('MENU')} className="p-2 rounded-lg hover:bg-slate-100 text-slate-500">
            <ArrowLeft size={20} />
          </button>
          <div className="flex-1">
            <h2 className="font-bold text-slate-800">Fechamento de Caixa</h2>
            <p className="text-xs text-slate-500">Digite os valores contados na gaveta</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setAdminTab('MENU')}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-sky-300 bg-sky-50 text-sky-700"
            >
              Menu
            </button>
            <button
              type="button"
              onClick={enterAdministrative}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-slate-300 text-slate-600 hover:bg-slate-100"
            >
              Administrativos
            </button>
          </div>
        </header>

        <div className="flex flex-1 overflow-hidden">
          {/* Left: rows */}
          <div className="w-[55%] overflow-y-auto border-r border-slate-200 bg-white">
            {rows.map((r) => (
              <button
                key={r.method}
                type="button"
                onClick={() => setActiveRow(r.method)}
                className={`
                  w-full flex justify-between items-center px-4 py-3
                  border-b border-slate-100 text-left transition-colors
                  ${activeRow === r.method ? 'bg-blue-50 border-l-4 border-l-blue-500' : 'hover:bg-slate-50'}
                `}
              >
                <span className={`text-sm font-medium ${activeRow === r.method ? 'text-blue-700' : 'text-slate-700'}`}>
                  {r.label}
                </span>
                <span className={`text-sm font-bold ${r.counted ? 'text-slate-800' : 'text-slate-300'}`}>
                  {r.counted ? formatBRL(parseCounted(r.counted)) : '—'}
                </span>
              </button>
            ))}
          </div>

          {/* Right: numpad */}
          <div className="flex-1 p-3 flex flex-col gap-3">
            {/* Display */}
            <div className="bg-white border border-slate-200 rounded-xl px-4 py-3 text-right">
              <p className="text-xs text-slate-400 mb-0.5">
                {rows.find((r) => r.method === activeRow)?.label}
              </p>
              <p className="text-2xl font-extrabold text-slate-800">
                {rows.find((r) => r.method === activeRow)?.counted
                  ? formatBRL(parseCounted(rows.find((r) => r.method === activeRow)!.counted))
                  : 'R$ 0,00'}
              </p>
            </div>
            <MiniNumpad onKey={handleKey} />
            <p className="text-center text-xs text-slate-400">Total contado: {formatBRL(totalCounted)}</p>
            {expectedError && (
              <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                {expectedError}
              </p>
            )}
          </div>
        </div>

        <div className="p-4 bg-white border-t border-slate-200">
          <button
            type="button"
            onClick={() => void handleConfirmBlindClose()}
            disabled={isLoadingExpected}
            className="w-full h-14 rounded-xl bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold text-base transition-colors active:scale-95"
          >
            {isLoadingExpected ? 'Carregando conferência...' : 'Confirmar Fechamento'}
          </button>
        </div>
      </div>
    );
  }

  // ── RESULT step ────────────────────────────────────────────────────────────
  const statusColor =
    Math.abs(totalDiff) < 0.01 ? 'bg-emerald-50 border-emerald-200'
    : totalDiff > 0            ? 'bg-orange-50 border-orange-200'
    :                            'bg-red-50 border-red-200';

  const statusLabel =
    Math.abs(totalDiff) < 0.01 ? 'Caixa Correto'
    : totalDiff > 0            ? `Sobra de ${formatBRL(Math.abs(totalDiff))}`
    :                            `Quebra de ${formatBRL(Math.abs(totalDiff))}`;

  return (
    <div className="flex flex-col h-full bg-slate-50 overflow-y-auto">
      <header className="flex items-center gap-3 px-4 py-3 bg-white border-b border-slate-200">
        <button type="button" onClick={() => setStep('input')} className="p-2 rounded-lg hover:bg-slate-100 text-slate-500">
          <ArrowLeft size={20} />
        </button>
        <h2 className="font-bold text-slate-800 flex-1">Resultado do Fechamento</h2>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setAdminTab('MENU')}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-sky-300 bg-sky-50 text-sky-700"
          >
            Menu
          </button>
          <button
            type="button"
            onClick={enterAdministrative}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-slate-300 text-slate-600 hover:bg-slate-100"
          >
            Administrativos
          </button>
        </div>
      </header>

      <div className="flex-1 p-4 space-y-4 overflow-y-auto">
        {/* Global status card */}
        <div className={`rounded-xl border p-4 ${statusColor}`}>
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-semibold text-slate-700">Status do Caixa</p>
            <StatusBadge diff={totalDiff} />
          </div>
          <div className="grid grid-cols-3 gap-3 text-center mt-2">
            <div>
              <p className="text-xs text-slate-500">Esperado</p>
              <p className="font-bold text-slate-800">{formatBRL(totalExpected)}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Contado</p>
              <p className="font-bold text-slate-800">{formatBRL(totalCounted)}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Diferença</p>
              <p className={`font-bold ${totalDiff >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                {totalDiff >= 0 ? '+' : ''}{formatBRL(totalDiff)}
              </p>
            </div>
          </div>
        </div>

        {fiscalItems.length > 0 && (
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <p className="px-4 py-2 text-xs font-semibold text-slate-500 uppercase border-b border-slate-100">
              Resumo fiscal dos itens
            </p>
            <div className="divide-y divide-slate-100">
              {fiscalItems.map((item) => (
                <div key={item.id} className="px-4 py-3 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-800 truncate">{item.name}</p>
                    <p className="text-[11px] text-slate-500">
                      ID {item.productCode ?? '--'} · NCM {item.ncm ?? '--'} · CFOP {item.cfop ?? '--'}
                    </p>
                    <p className="text-[11px] text-slate-500">
                      {item.fiscalType ?? 'Fiscal nao informado'} · CST {item.taxSituationCode ?? '--'} · EAN {item.barcode ?? '--'}
                    </p>
                  </div>
                  <p className="text-xs font-semibold text-slate-700 shrink-0">
                    {item.quantity.toLocaleString('pt-BR', {
                      minimumFractionDigits: item.unit === 'KG' ? 3 : 0,
                      maximumFractionDigits: item.unit === 'KG' ? 3 : 0
                    })} {item.unit === 'KG' ? 'kg' : 'un'}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Per-method breakdown */}
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <p className="px-4 py-2 text-xs font-semibold text-slate-500 uppercase border-b border-slate-100">
            Detalhamento por Forma
          </p>
          {rows
            .filter((r) => r.expected > 0 || parseCounted(r.counted) > 0)
            .map((r) => {
              const counted = parseCounted(r.counted);
              const diff    = counted - r.expected;
              return (
                <div key={r.method} className="flex items-center justify-between px-4 py-3 border-b border-slate-50 last:border-0">
                  <span className="text-sm text-slate-700 font-medium">{r.label}</span>
                  <div className="flex items-center gap-3 text-right">
                    <div>
                      <p className="text-xs text-slate-400">Esperado</p>
                      <p className="text-sm font-semibold text-slate-700">{formatBRL(r.expected)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-400">Contado</p>
                      <p className="text-sm font-semibold text-slate-800">{formatBRL(counted)}</p>
                    </div>
                    <StatusBadge diff={diff} />
                  </div>
                </div>
              );
            })}
        </div>

        {/* Bar chart */}
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-xs font-semibold text-slate-500 uppercase mb-3">Proporção por Forma</p>
          <BarChart rows={rows} />
        </div>
      </div>

      <div className="p-4 bg-white border-t border-slate-200 flex gap-2">
        <button
          type="button"
          onClick={() => setStep('input')}
          className="flex-1 h-12 rounded-xl border border-slate-300 text-slate-700 font-semibold hover:bg-slate-50 transition-colors"
        >
          Corrigir
        </button>
        <button
          type="button"
          onClick={onClose}
          className="flex-1 h-12 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold transition-colors active:scale-95"
        >
          Fechar Caixa
        </button>
      </div>
    </div>
  );
}
