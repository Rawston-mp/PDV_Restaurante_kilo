import { useEffect, useRef } from 'react';
import { Search, X } from 'lucide-react';

type SmartInputProps = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
};

export function SmartInput({
  value,
  onChange,
  placeholder = 'Buscar produto por nome, código ou categoria…',
}: SmartInputProps) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => { ref.current?.focus(); }, []);

  return (
    <div className="relative flex items-center w-full">
      <Search className="absolute left-4 text-slate-400 pointer-events-none" size={20} />
      <input
        ref={ref}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete="off"
        spellCheck={false}
        className="
          w-full h-12 pl-11 pr-10 rounded-xl
          border border-slate-200 bg-white
          text-slate-800 text-base
          shadow-sm outline-none
          focus:border-blue-500 focus:ring-2 focus:ring-blue-100
          transition-all duration-150
          placeholder:text-slate-400
        "
      />
      {value && (
        <button
          type="button"
          onClick={() => { onChange(''); ref.current?.focus(); }}
          className="absolute right-3 p-1 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
        >
          <X size={16} />
        </button>
      )}
    </div>
  );
}
