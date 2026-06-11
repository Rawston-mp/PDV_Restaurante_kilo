import { useState } from 'react';
import { ArrowLeft, CheckCircle2, Delete } from 'lucide-react';
import { type PaymentEntry, type PaymentMethod, PAYMENT_METHODS, formatBRL } from '../../types';

type PaymentPanelProps = {
  total: number;
  onConfirm: (payments: PaymentEntry[]) => void;
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

export function PaymentPanel({ total, onConfirm, onBack }: PaymentPanelProps) {
  const [entries, setEntries] = useState<PaymentEntry[]>([]);
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod>('DINHEIRO');
  const [inputRaw, setInputRaw] = useState('');

  const totalPaid = entries.reduce((s, e) => s + e.amount, 0);
  const remaining = Math.max(0, total - totalPaid);
  const change = totalPaid > total ? totalPaid - total : 0;

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
        </div>

        {/* ── Right: numpad + applied payments ──────────────────── */}
        <div className="flex-1 flex flex-col p-3 gap-3 overflow-y-auto">

          {/* Display value */}
          <div className="bg-white rounded-xl border border-slate-200 px-4 py-3 text-right">
            <p className="text-xs text-slate-400 mb-1">Valor</p>
            <p className="text-2xl font-extrabold text-slate-800">{displayValue()}</p>
          </div>

          {/* Numpad */}
          <Numpad onKey={handleKey} />

          {/* Add payment button */}
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
        </div>
      </div>

      {/* ── Confirm ──────────────────────────────────────────────── */}
      <div className="p-4 bg-white border-t border-slate-200">
        <button
          type="button"
          disabled={!canConfirm}
          onClick={() => onConfirm(entries)}
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
