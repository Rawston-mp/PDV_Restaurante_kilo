type NumericKeypadProps = {
  onKeyPress: (key: string) => void;
};

const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0', '.', 'Backspace', 'Clear'];

export function NumericKeypad({ onKeyPress }: NumericKeypadProps) {
  return (
    <section className="comanda-panel">
      <p className="panel-label">Teclado numerico</p>
      <div className="numeric-keypad-grid">
        {keys.map((key) => (
          <button key={key} type="button" onClick={() => onKeyPress(key)}>
            {key === 'Clear' ? 'Limpar' : key === 'Backspace' ? 'Apagar' : key}
          </button>
        ))}
        <button type="button" className="is-enter" onClick={() => onKeyPress('Enter')}>
          ENTER
        </button>
      </div>
    </section>
  );
}
