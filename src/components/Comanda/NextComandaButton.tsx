type NextComandaButtonProps = {
  onClick: () => void;
  label: string;
  helperText: string;
  disabled?: boolean;
};

export function NextComandaButton({
  onClick,
  label,
  helperText,
  disabled = false
}: NextComandaButtonProps) {
  return (
    <div className="comanda-primary-action">
      <button type="button" disabled={disabled} className="next-comanda-button" onClick={onClick}>
        {label}
      </button>
      <p>{helperText}</p>
    </div>
  );
}
