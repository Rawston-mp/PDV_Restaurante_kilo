import { CornerDownLeft, Delete, Space, X } from 'lucide-react';
import type { MouseEvent } from 'react';

type CashierVirtualKeyboardProps = {
  onKeyPress: (key: string) => void;
  onClose: () => void;
  enterLabel?: string;
};

const numericRows = [
  ['1', '2', '3'],
  ['4', '5', '6'],
  ['7', '8', '9'],
  ['0', '.', 'Backspace']
] as const;

const alphaRows = [
  ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
  ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L'],
  ['Z', 'X', 'C', 'V', 'B', 'N', 'M']
] as const;

export function CashierVirtualKeyboard({ onKeyPress, onClose, enterLabel = 'Enter' }: CashierVirtualKeyboardProps) {
  const keepInputFocused = (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
  };

  return (
    <section
      className="absolute left-5 right-5 top-[5.25rem] z-[100] rounded-2xl border border-sky-200 bg-slate-950 p-4 shadow-2xl ring-1 ring-sky-500/20"
      aria-label="Teclado virtual do caixa"
    >
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-wide text-sky-300">Teclado virtual do caixa</p>
          <p className="text-[11px] font-semibold text-slate-300">Use para buscar produtos ou ler/digitar comandas.</p>
        </div>

        <button
          type="button"
          onMouseDown={keepInputFocused}
          onClick={onClose}
          className="flex min-h-[48px] items-center gap-2 rounded-xl border border-slate-700 bg-slate-900 px-4 text-xs font-black uppercase text-white hover:border-sky-400 hover:bg-slate-800"
          aria-label="Fechar teclado virtual"
        >
          <X size={16} />
          Esc
        </button>
      </div>

      <div className="grid gap-3 xl:grid-cols-[0.42fr_0.58fr]">
        <div className="rounded-xl border border-slate-800 bg-slate-900 p-3">
          <p className="mb-2 text-[11px] font-black uppercase tracking-wide text-sky-300">Numérico</p>
          <div className="grid grid-cols-3 gap-2">
            {numericRows.flat().map((key) => (
              <button
                key={key}
                type="button"
                onMouseDown={keepInputFocused}
                onClick={() => onKeyPress(key)}
                className="min-h-[48px] rounded-xl border border-slate-700 bg-slate-950 text-sm font-black text-white transition hover:border-sky-400 hover:bg-sky-950"
              >
                {key === 'Backspace' ? <Delete className="mx-auto" size={18} /> : key}
              </button>
            ))}
            <button
              type="button"
              onMouseDown={keepInputFocused}
              onClick={() => onKeyPress('Clear')}
              className="min-h-[48px] rounded-xl border border-orange-500/50 bg-orange-950/60 text-xs font-black uppercase text-orange-100 transition hover:bg-orange-900"
            >
              Limpar
            </button>
            <button
              type="button"
              onMouseDown={keepInputFocused}
              onClick={() => onKeyPress('Enter')}
              className="col-span-2 flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-emerald-500 text-xs font-black uppercase text-white transition hover:bg-emerald-600"
            >
              <CornerDownLeft size={18} />
              {enterLabel}
            </button>
          </div>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-900 p-3">
          <p className="mb-2 text-[11px] font-black uppercase tracking-wide text-sky-300">Busca</p>
          <div className="space-y-2">
            {alphaRows.map((row) => (
              <div key={row.join('')} className="grid gap-2" style={{ gridTemplateColumns: `repeat(${row.length}, minmax(0, 1fr))` }}>
                {row.map((key) => (
                  <button
                    key={key}
                    type="button"
                    onMouseDown={keepInputFocused}
                    onClick={() => onKeyPress(key.toLowerCase())}
                    className="min-h-[48px] rounded-xl border border-slate-700 bg-slate-950 text-xs font-black text-white transition hover:border-sky-400 hover:bg-sky-950"
                  >
                    {key}
                  </button>
                ))}
              </div>
            ))}

            <div className="grid grid-cols-[1fr_2fr_1fr] gap-2">
              <button
                type="button"
                onMouseDown={keepInputFocused}
                onClick={() => onKeyPress('Backspace')}
                className="flex min-h-[48px] items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-950 text-xs font-black uppercase text-white transition hover:border-sky-400 hover:bg-sky-950"
              >
                <Delete size={18} />
                Apagar
              </button>
              <button
                type="button"
                onMouseDown={keepInputFocused}
                onClick={() => onKeyPress(' ')}
                className="flex min-h-[48px] items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-950 text-xs font-black uppercase text-white transition hover:border-sky-400 hover:bg-sky-950"
              >
                <Space size={18} />
                Espaço
              </button>
              <button
                type="button"
                onMouseDown={keepInputFocused}
                onClick={() => onKeyPress('Enter')}
                className="flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-emerald-500 text-xs font-black uppercase text-white transition hover:bg-emerald-600"
              >
                <CornerDownLeft size={18} />
                {enterLabel}
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
