import { Hash, Keyboard } from 'lucide-react';

type KeyboardToggleProps = {
  active: 'NUMERICO' | 'VIRTUAL';
  onNumerico: () => void;
  onVirtual: () => void;
};

export function KeyboardToggle({ active, onNumerico, onVirtual }: KeyboardToggleProps) {
  return (
    <div className="comanda-keyboard-toggle" role="tablist" aria-label="Alternar teclado">
      <button type="button" className={active === 'NUMERICO' ? 'is-active' : ''} onClick={onNumerico}>
        <Hash size={18} />
        Numerico
      </button>
      <button type="button" className={active === 'VIRTUAL' ? 'is-active' : ''} onClick={onVirtual}>
        <Keyboard size={18} />
        Busca
      </button>
    </div>
  );
}
