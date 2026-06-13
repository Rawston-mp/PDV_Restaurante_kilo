import { useMemo, useState } from 'react';
import { ArrowLeft, CheckCircle2, Delete } from 'lucide-react';
import { useClientsQuery } from '@/modules/clients/presentation/hooks/useClientsQuery';
import { type CashierCartItem } from './CartItem';
import { type PaymentEntry, type PaymentMethod, PAYMENT_METHODS, formatBRL } from '../../types';

export type PaymentConfirmPayload = {
  payments: PaymentEntry[];
  fiadoClientId?: string;
};

type PaymentPanelProps = {
  total: number;
  items: CashierCartItem[];
  onConfirm: (payload: PaymentConfirmPayload) => Promise<void> | void;
  onBack: () => void;
};

// ─── Simple numpad ─────────────────────────────────────────────────────────────
function Numpad({ onKey }: { onKey: (k: string) => void }) {
  const keys = ['7','8','9','4','5','6','1','2','3','0',',','⌫'];
  return (
    <div className="grid grid-cols-3 gap-2">
      {keys.map((k) => (
        <button
          key={k}
          type="button"
          onClick={() => onKey(k)}
          className={`
            h-12 rounded-xl font-semibold text-lg
            border transition-all duration-100 active:scale-95
            ${k === '⌫'
              ? 'border-red-200 bg-red-50 text-red-600 hover:bg-red-100'
              : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50 hover:border-slate-300'
            }
          `}
        >
          {k === '⌫' ? <Delete size={18} className="mx-auto" /> : k}
        </button>
      ))}
    </div>
  );
}

export function PaymentPanel({ total, items, onConfirm, onBack }: PaymentPanelProps) {
  const { clients } = useClientsQuery();
  const [entries, setEntries] = useState<PaymentEntry[]>([]);
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod>('DINHEIRO');
  const [inputRaw, setInputRaw] = useState('');
  const [selectedFiadoClientId, setSelectedFiadoClientId] = useState('');
  const [fiadoFeedback, setFiadoFeedback] = useState<string | null>(null);
  const [isLaunchingFiado, setIsLaunchingFiado] = useState(false);

  const activeClients = useMemo(
    () => clients.filter((client) => client.active).sort((a, b) => a.fullName.localeCompare(b.fullName, 'pt-BR')),
    [clients]
  );

  const totalPaid = entries.reduce((s, e) => s + e.amount, 0);
  const remaining = Math.max(0, total - totalPaid);
  const change = totalPaid > total ? totalPaid - total : 0;
  const fiscalSummary = items.map((item) => ({
    id: item.id,
    name: item.name,
    quantity: item.quantity,
    unit: item.unit,
    total: item.quantity * item.unitPrice,
    productCode: item.productCode,
    barcode: item.barcode,
    ncm: item.ncm,
    cfop: item.cfop,
    taxSituationCode: item.taxSituationCode,
    fiscalType: item.fiscalType
  }));
  const totalWeightItems = items.filter((item) => item.unit === 'KG').length;
  const totalUnitQuantity = items.filter((item) => item.unit === 'UN').reduce((acc, item) => acc + item.quantity, 0);

  // Parse the raw string input (e.g. "5990" → 59.90)
  const parseAmount = (raw: string): number => {
    if (!raw) return remaining; // empty = remaining balance
    const digits = raw.replace(',', '');
    return parseFloat(digits) / 100;
  };

  const handleKey = (k: string) => {
    if (k === '⌫') {
      setInputRaw((prev) => prev.slice(0, -1));
    } else if (k === ',') {
      // comma is the decimal separator; only allow once
      if (!inputRaw.includes(',')) setInputRaw((prev) => prev + ',');
    } else {
      setInputRaw((prev) => (prev.length >= 10 ? prev : prev + k));
    }
  };

  const displayValue = () => {
    if (!inputRaw) return formatBRL(remaining);
    const digits = inputRaw.replace(/\D/g, '');
    if (!digits) return 'R$ 0,00';
    const cents = parseInt(digits, 10);
    return formatBRL(cents / 100);
  };

  const handleAddPayment = () => {
    const amount = inputRaw ? parseAmount(inputRaw) : remaining;
    if (amount <= 0) return;
    const label = PAYMENT_METHODS.find((m) => m.method === selectedMethod)?.label ?? selectedMethod;
    setEntries((prev) => [...prev, { method: selectedMethod, label, amount }]);
    setInputRaw('');
  };

  const handleRemoveEntry = (index: number) => {
    setEntries((prev) => prev.filter((_, i) => i !== index));
  };

  const handleLaunchFiado = async (clientId: string) => {
    if (!clientId || isLaunchingFiado) {
      return;
    }

    const fiadoLabel = PAYMENT_METHODS.find((m) => m.method === 'FIADO')?.label ?? 'Fiado';

    setIsLaunchingFiado(true);
    setFiadoFeedback(null);
    try {
      await onConfirm({
        payments: [{ method: 'FIADO', label: fiadoLabel, amount: total }],
        fiadoClientId: clientId
      });
    } catch {
      setFiadoFeedback('Nao foi possivel lancar o fiado neste momento.');
    } finally {
      setIsLaunchingFiado(false);
    }
  };

  const canConfirm = totalPaid >= total;

  return (
    <div className="flex flex-col h-full bg-slate-50">

      {/* ── Header ──────────────────────────────────────────────── */}
      <header className="flex items-center gap-3 px-4 py-3 bg-white border-b border-slate-200">
        <button
          type="button"
          onClick={onBack}
          className="p-2 rounded-lg hover:bg-slate-100 text-slate-500 transition-colors"
        >
          <ArrowLeft size={20} />
        </button>
        <div className="flex-1">
          <h2 className="font-bold text-slate-800 text-base">Recebimento</h2>
          <p className="text-xs text-slate-500">Total da compra: {formatBRL(total)}</p>
        </div>
        <span className="text-xl font-extrabold text-orange-500">{formatBRL(remaining)}</span>
      </header>

      <div className="flex flex-1 gap-0 overflow-hidden">

        {/* ── Left: payment methods list ──────────────────────── */}
        <div className="w-[42%] flex flex-col border-r border-slate-200 bg-white overflow-y-auto">
          <p className="px-3 pt-3 pb-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">
            Forma de Pagamento
          </p>
          {PAYMENT_METHODS.map(({ method, label, color }) => (
            <button
              key={method}
              type="button"
              onClick={() => setSelectedMethod(method)}
              className={`
                mx-2 mb-1 px-4 py-3 rounded-lg border text-sm font-semibold
                text-left transition-all duration-100 active:scale-95
                ${selectedMethod === method
                  ? 'ring-2 ring-emerald-400 border-emerald-400 bg-emerald-50 text-emerald-800'
                  : color
                }
              `}
            >
              {label}
            </button>
          ))}

          <div className="mx-2 mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">Resumo fiscal</p>
            <div className="space-y-2 text-xs text-slate-600">
              <div className="flex justify-between gap-3">
                <span>Itens por peso</span>
                <strong className="text-slate-800">{totalWeightItems}</strong>
              </div>
              <div className="flex justify-between gap-3">
                <span>Itens por unidade</span>
                <strong className="text-slate-800">{totalUnitQuantity}</strong>
              </div>
              <div className="flex justify-between gap-3">
                <span>Subtotal fiscal</span>
                <strong className="text-slate-800">{formatBRL(total)}</strong>
              </div>
            </div>
          </div>
        </div>

        {/* ── Right: numpad + applied payments ──────────────────── */}
        <div className="flex-1 flex flex-col p-3 gap-3 overflow-y-auto">

          {/* Display value */}
          <div className="bg-white rounded-xl border border-slate-200 px-4 py-3 text-right">
            <p className="text-xs text-slate-400 mb-1">Valor</p>
            <p className="text-2xl font-extrabold text-slate-800">{displayValue()}</p>
          </div>

          {/* Numpad */}
          {selectedMethod === 'FIADO' ? (
            <div className="bg-white rounded-xl border border-slate-200 p-3 space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Cliente do fiado</p>
              {activeClients.length === 0 ? (
                <p className="text-sm text-slate-500">Nenhum cliente ativo cadastrado para lancamento de fiado.</p>
              ) : (
                <select
                  value={selectedFiadoClientId}
                  onChange={(event) => {
                    const clientId = event.target.value;
                    setSelectedFiadoClientId(clientId);
                    if (clientId) {
                      void handleLaunchFiado(clientId);
                    }
                  }}
                  className="w-full min-h-[44px] rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-700"
                  disabled={isLaunchingFiado}
                >
                  <option value="">Selecione um cliente</option>
                  {activeClients.map((client) => (
                    <option key={client.id} value={client.id}>
                      {client.fullName} {client.clientCode ? `- ID ${client.clientCode}` : ''}
                    </option>
                  ))}
                </select>
              )}

              <p className="text-xs text-slate-500">
                Ao selecionar o cliente, o valor sera lancado como fiado sem emissao fiscal. A definicao Fiscal ou Orcamento sera feita no pagamento futuro.
              </p>

              {fiadoFeedback && (
                <p className="text-xs rounded-md border border-red-200 bg-red-50 px-2 py-1 text-red-700">
                  {fiadoFeedback}
                </p>
              )}
            </div>
          ) : (
            <Numpad onKey={handleKey} />
          )}

          {/* Add payment button */}
          {selectedMethod !== 'FIADO' && (
            <button
              type="button"
              onClick={handleAddPayment}
              className="
                w-full h-12 rounded-xl
                bg-blue-600 hover:bg-blue-700
                text-white font-bold text-sm
                transition-colors active:scale-95
              "
            >
              + Adicionar pagamento
            </button>
          )}

          {/* Applied payments */}
          {entries.length > 0 && (
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <p className="px-3 py-2 text-xs font-semibold text-slate-500 uppercase border-b border-slate-100">
                Pagamentos
              </p>
              <ul>
                {entries.map((e, i) => (
                  <li key={i} className="flex justify-between items-center px-3 py-2 border-b border-slate-50 last:border-0">
                    <span className="text-sm text-slate-700">{e.label}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-slate-800">{formatBRL(e.amount)}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveEntry(i)}
                        className="p-1 rounded text-red-400 hover:bg-red-50 hover:text-red-600 transition-colors"
                      >
                        ×
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
              {change > 0 && (
                <div className="flex justify-between px-3 py-2 bg-amber-50 text-amber-700">
                  <span className="text-sm font-semibold">Troco</span>
                  <span className="text-sm font-bold">{formatBRL(change)}</span>
                </div>
              )}
            </div>
          )}

          {fiscalSummary.length > 0 && (
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <p className="px-3 py-2 text-xs font-semibold text-slate-500 uppercase border-b border-slate-100">
                Itens fiscais da venda
              </p>
              <ul className="divide-y divide-slate-100">
                {fiscalSummary.map((item) => (
                  <li key={item.id} className="px-3 py-2">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-slate-800 truncate">{item.name}</p>
                        <p className="text-[11px] text-slate-500">
                          ID {item.productCode ?? '--'} · NCM {item.ncm ?? '--'} · CFOP {item.cfop ?? '--'}
                        </p>
                        <p className="text-[11px] text-slate-500">
                          {item.fiscalType ?? 'Fiscal nao informado'} · CST {item.taxSituationCode ?? '--'} · EAN {item.barcode ?? '--'}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-sm font-semibold text-slate-800">{formatBRL(item.total)}</p>
                        <p className="text-[11px] text-slate-500">
                          {item.quantity.toLocaleString('pt-BR', {
                            minimumFractionDigits: item.unit === 'KG' ? 3 : 0,
                            maximumFractionDigits: item.unit === 'KG' ? 3 : 0
                          })} {item.unit === 'KG' ? 'kg' : 'un'}
                        </p>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>

      {/* ── Confirm ──────────────────────────────────────────────── */}
      <div className="p-4 bg-white border-t border-slate-200">
        <button
          type="button"
          disabled={!canConfirm}
          onClick={() => onConfirm({ payments: entries })}
          className="
            w-full h-14 rounded-xl flex items-center justify-center gap-2
            bg-emerald-500 hover:bg-emerald-600
            disabled:opacity-40 disabled:cursor-not-allowed
            text-white text-lg font-bold
            transition-colors active:scale-95
          "
        >
          <CheckCircle2 size={22} />
          Confirmar e Fechar
        </button>
      </div>
    </div>
  );
}
