type WeightDisplayProps = {
  value: number;
  manualValue: number | null;
  isEditing: boolean;
  draftValue: string;
  error: string | null;
  onStartEdit: () => void;
  onDraftChange: (nextValue: string) => void;
  onApply: () => void;
  onConfirmEnter?: () => void;
  onCancel: () => void;
  onClearManual: () => void;
};

export function WeightDisplay({
  value,
  manualValue,
  isEditing,
  draftValue,
  error,
  onStartEdit,
  onDraftChange,
  onApply,
  onConfirmEnter,
  onCancel,
  onClearManual
}: WeightDisplayProps) {
  return (
    <section className="comanda-panel weight-panel">
      <div className="weight-panel-head">
        <p className="panel-label">Peso atual</p>
        <small className={manualValue !== null ? 'weight-panel-mode is-manual' : 'weight-panel-mode'}>
          {manualValue !== null ? 'Manual' : 'Sensor'}
        </small>
      </div>

      {isEditing ? (
        <input
          type="number"
          min="0"
          step="0.001"
          value={draftValue}
          onChange={(event) => {
            onDraftChange(event.target.value);
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              if (onConfirmEnter) {
                onConfirmEnter();
                return;
              }

              onApply();
            }

            if (event.key === 'Escape') {
              event.preventDefault();
              onCancel();
            }
          }}
          className="panel-value-input panel-value-warning"
          aria-label="Peso manual em quilogramas"
          autoComplete="off"
          autoFocus
        />
      ) : (
        <button type="button" className="panel-value-button panel-value panel-value-warning" onClick={onStartEdit}>
          {value.toFixed(3)} kg
        </button>
      )}

      {isEditing ? (
        <div className="weight-panel-edit-actions">
          <button type="button" onClick={onApply}>Aplicar</button>
          <button type="button" className="button-muted" onClick={onCancel}>Cancelar</button>
        </div>
      ) : (
        <div className="weight-panel-status">
          <small>Clique no peso para informar manualmente.</small>
          {manualValue !== null && (
            <button type="button" className="button-muted" onClick={onClearManual}>Voltar ao sensor</button>
          )}
        </div>
      )}

      {error && <small className="weight-panel-error">{error}</small>}
    </section>
  );
}
