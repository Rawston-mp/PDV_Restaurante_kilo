type NextComandaButtonProps = {
  onClick: () => void;
  disabled?: boolean;
};

export function NextComandaButton({ onClick, disabled = false }: NextComandaButtonProps) {
  return (
    <button type="button" disabled={disabled} className="next-comanda-button" onClick={onClick}>
      PROXIMA COMANDA
    </button>
  );
}
