import { useState } from 'react';
import { ArrowLeft, CheckCircle2, AlertCircle, TrendingUp, Delete } from 'lucide-react';
import { formatBRL } from '../../types';

// ─── Types ────────────────────────────────────────────────────────────────────

type BlindRow = {
  method: string;
  label: string;
  counted: string;     // raw input
  expected: number;    // from system (revealed only after confirm)
};

type CloseStep = 'input' | 'result';

// ─── Pre-populated methods for the blind count ────────────────────────────────
const CLOSE_METHODS: Omit<BlindRow, 'counted' | 'expected'>[] = [
  { method: 'DINHEIRO',  label: 'Dinheiro' },
  { method: 'DEBITO',    label: 'Cartão Débito' },
  { method: 'CREDITO',   label: 'Cartão Crédito' },
  { method: 'PIX',       label: 'PIX' },
  { method: 'FIADO',     label: 'Fiado' },
  { method: 'TICKET',    label: 'Ticket' },
];

// ─── Mock expected values (would come from backend in real use) ───────────────
const MOCK_EXPECTED: Record<string, number> = {
  DINHEIRO: 6110.40,
  DEBITO:    890.00,
  CREDITO:  1540.00,
  PIX:       725.80,
  FIADO:     130.39,
  TICKET:      0.00,
};

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

export function CashRegisterClose({ onBack, onClose, items = [] }: CashRegisterCloseProps) {
  const [step, setStep] = useState<CloseStep>('input');
  const [rows, setRows] = useState<BlindRow[]>(
    CLOSE_METHODS.map((m) => ({ ...m, counted: '', expected: MOCK_EXPECTED[m.method] ?? 0 }))
  );
  const [activeRow, setActiveRow] = useState<string>('DINHEIRO');

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

  const totalCounted  = rows.reduce((s, r) => s + parseCounted(r.counted), 0);
  const totalExpected = rows.reduce((s, r) => s + r.expected, 0);
  const totalDiff     = totalCounted - totalExpected;
  const fiscalItems = items.map((item) => item);

  // ── INPUT step ─────────────────────────────────────────────────────────────
  if (step === 'input') {
    return (
      <div className="flex flex-col h-full bg-slate-50">
        <header className="flex items-center gap-3 px-4 py-3 bg-white border-b border-slate-200">
          <button type="button" onClick={onBack} className="p-2 rounded-lg hover:bg-slate-100 text-slate-500">
            <ArrowLeft size={20} />
          </button>
          <div>
            <h2 className="font-bold text-slate-800">Fechamento de Caixa</h2>
            <p className="text-xs text-slate-500">Digite os valores contados na gaveta</p>
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
          </div>
        </div>

        <div className="p-4 bg-white border-t border-slate-200">
          <button
            type="button"
            onClick={() => setStep('result')}
            className="w-full h-14 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-base transition-colors active:scale-95"
          >
            Confirmar Fechamento
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
        <h2 className="font-bold text-slate-800">Resultado do Fechamento</h2>
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
