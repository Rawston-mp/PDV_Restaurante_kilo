import { useMemo, useState } from 'react';
import { ArrowLeft, CheckCircle2, Delete } from 'lucide-react';
import { useClientsQuery } from '@/modules/clients/presentation/hooks/useClientsQuery';
import { type CashierCartItem } from './CartItem';
import {
  type PaymentDocumentMode,
  type PaymentEntry,
  type PaymentMethod,
  PAYMENT_METHODS,
  formatBRL
} from '../../types';

export type PaymentConfirmPayload = {
  payments: PaymentEntry[];
  discountAmount: number;
  documentMode: PaymentDocumentMode;
  fiadoClientId?: string;
};

type PaymentPanelProps = {
  total: number;
  items: CashierCartItem[];
  onConfirm: (payload: PaymentConfirmPayload) => Promise<void> | void;
  onBack: () => void;
};

function Numpad({ onKey }: { onKey: (k: string) => void }) {
  const keys = ['7', '8', '9', '4', '5', '6', '1', '2', '3', '0', ',', '⌫'];
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
  const [documentMode, setDocumentMode] = useState<PaymentDocumentMode>('NFCE');
  const [inputRaw, setInputRaw] = useState('');
  const [discountAmount, setDiscountAmount] = useState(0);
  const [selectedFiadoClientId, setSelectedFiadoClientId] = useState('');
  const [fiadoFeedback, setFiadoFeedback] = useState<string | null>(null);
  const [isLaunchingFiado, setIsLaunchingFiado] = useState(false);

  const activeClients = useMemo(
    () => clients.filter((client) => client.active).sort((a, b) => a.fullName.localeCompare(b.fullName, 'pt-BR')),
    [clients]
  );

  const payableTotal = Math.max(0, total - discountAmount);
  const totalPaid = entries.reduce((sum, entry) => sum + entry.amount, 0);
  const remaining = Math.max(0, payableTotal - totalPaid);
  const change = totalPaid > payableTotal ? totalPaid - payableTotal : 0;
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

  const parseAmount = (raw: string, fallback: number): number => {
    if (!raw) return fallback;
    const digits = raw.replace(/\D/g, '');
    if (!digits) return 0;
    return Number.parseInt(digits, 10) / 100;
  };

  const handleKey = (k: string) => {
    if (k === '⌫') {
      setInputRaw((prev) => prev.slice(0, -1));
    } else if (k === ',') {
      if (!inputRaw.includes(',')) setInputRaw((prev) => prev + ',');
    } else {
      setInputRaw((prev) => (prev.length >= 10 ? prev : prev + k));
    }
  };

  const displayValue = () => {
    if (!inputRaw) {
      return formatBRL(selectedMethod === 'DESCONTO' ? Math.max(0, total - discountAmount) : remaining);
    }

    const digits = inputRaw.replace(/\D/g, '');
    if (!digits) return 'R$ 0,00';
    const cents = Number.parseInt(digits, 10);
    return formatBRL(cents / 100);
  };

  const handleAddPayment = () => {
    if (selectedMethod === 'DESCONTO') {
      const amount = parseAmount(inputRaw, 0);
      if (amount <= 0) return;
      setDiscountAmount((current) => Math.min(total, current + amount));
      setInputRaw('');
      return;
    }

    const amount = parseAmount(inputRaw, remaining);
    if (amount <= 0) return;
    const label = PAYMENT_METHODS.find((method) => method.method === selectedMethod)?.label ?? selectedMethod;
    setEntries((prev) => [...prev, { method: selectedMethod, label, amount }]);
    setInputRaw('');
  };

  const handleRemoveEntry = (index: number) => {
    setEntries((prev) => prev.filter((_, i) => i !== index));
  };

  const handleLaunchFiado = async (clientId: string) => {
    if (!clientId || isLaunchingFiado || payableTotal <= 0) {
      return;
    }

    const fiadoLabel = PAYMENT_METHODS.find((method) => method.method === 'FIADO')?.label ?? 'Fiado';

    setIsLaunchingFiado(true);
    setFiadoFeedback(null);
    try {
      await onConfirm({
        payments: [{ method: 'FIADO', label: fiadoLabel, amount: payableTotal }],
        discountAmount,
        documentMode: 'ORCAMENTO',
        fiadoClientId: clientId
      });
    } catch {
      setFiadoFeedback('Não foi possível lançar o fiado neste momento.');
    } finally {
      setIsLaunchingFiado(false);
    }
  };

  const canConfirm = selectedMethod !== 'FIADO' && totalPaid >= payableTotal && (entries.length > 0 || payableTotal === 0);

  return (
    <div className="flex flex-col h-full bg-slate-50">
      <header className="flex items-center gap-3 px-4 py-3 bg-white border-b border-slate-200">
        <button
          type="button"
          onClick={onBack}
          className="p-2 rounded-lg hover:bg-slate-100 text-slate-500 transition-colors"
          aria-label="Voltar ao caixa"
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
        <div className="w-[42%] flex flex-col border-r border-slate-200 bg-white overflow-y-auto">
          <p className="px-3 pt-3 pb-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">
            Forma de Pagamento
          </p>
          {PAYMENT_METHODS.map(({ method, label, color }) => (
            <button
              key={method}
              type="button"
              onClick={() => {
                setSelectedMethod(method);
                setInputRaw('');
              }}
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
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">Documento</p>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setDocumentMode('NFCE')}
                className={`min-h-[48px] rounded-lg border px-3 text-sm font-bold ${documentMode === 'NFCE' ? 'border-emerald-400 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'}`}
              >
                NFC-e
              </button>
              <button
                type="button"
                onClick={() => setDocumentMode('ORCAMENTO')}
                className={`min-h-[48px] rounded-lg border px-3 text-sm font-bold ${documentMode === 'ORCAMENTO' ? 'border-orange-400 bg-orange-50 text-orange-700' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'}`}
              >
                Orçamento
              </button>
            </div>
          </div>

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
                <span>Subtotal</span>
                <strong className="text-slate-800">{formatBRL(total)}</strong>
              </div>
              <div className="flex justify-between gap-3">
                <span>Desconto</span>
                <strong className="text-red-600">-{formatBRL(discountAmount)}</strong>
              </div>
              <div className="flex justify-between gap-3 border-t border-slate-200 pt-2">
                <span>A pagar</span>
                <strong className="text-slate-900">{formatBRL(payableTotal)}</strong>
              </div>
            </div>
          </div>
        </div>

        <div className="flex-1 flex flex-col p-3 gap-3 overflow-y-auto">
          <div className="bg-white rounded-xl border border-slate-200 px-4 py-3 text-right">
            <p className="text-xs text-slate-400 mb-1">{selectedMethod === 'DESCONTO' ? 'Valor do desconto' : 'Valor'}</p>
            <p className="text-2xl font-extrabold text-slate-800">{displayValue()}</p>
          </div>

          {selectedMethod === 'FIADO' ? (
            <div className="bg-white rounded-xl border border-slate-200 p-3 space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Cliente do fiado</p>
              {activeClients.length === 0 ? (
                <p className="text-sm text-slate-500">Nenhum cliente ativo cadastrado para lançamento de fiado.</p>
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
                  className="w-full min-h-[48px] rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-700"
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
                Fiado fecha a comanda como orçamento não fiscal e mantém a cobrança para acerto futuro.
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
              {selectedMethod === 'DESCONTO' ? '+ Aplicar desconto' : '+ Adicionar pagamento'}
            </button>
          )}

          {discountAmount > 0 && (
            <div className="flex items-center justify-between rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm">
              <span className="font-semibold text-red-700">Desconto aplicado</span>
              <div className="flex items-center gap-2">
                <strong className="text-red-700">-{formatBRL(discountAmount)}</strong>
                <button
                  type="button"
                  onClick={() => setDiscountAmount(0)}
                  className="min-h-[48px] min-w-[48px] rounded-lg text-red-500 hover:bg-red-100"
                  aria-label="Remover desconto"
                >
                  ×
                </button>
              </div>
            </div>
          )}

          {entries.length > 0 && (
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <p className="px-3 py-2 text-xs font-semibold text-slate-500 uppercase border-b border-slate-100">
                Pagamentos
              </p>
              <ul>
                {entries.map((entry, index) => (
                  <li key={`${entry.method}-${index}`} className="flex justify-between items-center px-3 py-2 border-b border-slate-50 last:border-0">
                    <span className="text-sm text-slate-700">{entry.label}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-slate-800">{formatBRL(entry.amount)}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveEntry(index)}
                        className="min-h-[48px] min-w-[48px] rounded text-red-400 hover:bg-red-50 hover:text-red-600 transition-colors"
                        aria-label="Remover pagamento"
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
                          {item.fiscalType ?? 'Fiscal não informado'} · CST {item.taxSituationCode ?? '--'} · EAN {item.barcode ?? '--'}
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

      <div className="p-4 bg-white border-t border-slate-200">
        <button
          type="button"
          disabled={!canConfirm}
          onClick={() => onConfirm({ payments: entries, discountAmount, documentMode })}
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
