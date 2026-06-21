import { CornerDownLeft, Delete, Space } from 'lucide-react';

type VirtualKeyboardProps = {
  onKeyPress: (key: string) => void;
};

const rows = [
  ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
  ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L'],
  ['Z', 'X', 'C', 'V', 'B', 'N', 'M']
] as const;

export function VirtualKeyboard({ onKeyPress }: VirtualKeyboardProps) {
  return (
    <section className="comanda-panel">
      <p className="panel-label">Teclado de busca</p>
      <div className="virtual-keyboard-grid">
        {rows.map((row, index) => (
          <div key={`row-${index}`} className="virtual-row">
            {row.map((key) => (
              <button key={key} type="button" onClick={() => onKeyPress(key.toLowerCase())}>
                {key}
              </button>
            ))}
          </div>
        ))}
        <div className="virtual-row-actions">
          <button type="button" className="is-clear" onClick={() => onKeyPress('Clear')}>
            Limpar
          </button>
          <button type="button" className="is-space" onClick={() => onKeyPress(' ')}>
            <Space size={18} />
            Espaco
          </button>
          <button type="button" className="is-backspace" onClick={() => onKeyPress('Backspace')}>
            <Delete size={18} />
            Apagar
          </button>
          <button type="button" className="is-enter" onClick={() => onKeyPress('Enter')}>
            <CornerDownLeft size={18} />
            Enter
          </button>
        </div>
      </div>
    </section>
  );
}
