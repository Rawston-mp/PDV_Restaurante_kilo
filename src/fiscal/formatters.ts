export function onlyNumbers(value: string): string {
  return value.replace(/\D/g, "");
}

export function formatMoney(value: number): string {
  return value.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

export function formatQuantity(value: number): string {
  return value.toLocaleString("pt-BR", {
    minimumFractionDigits: 3,
    maximumFractionDigits: 3
  });
}

export function padLeft(value: string | number, size: number, char = "0"): string {
  return String(value).padStart(size, char);
}

export function padRight(value: string | number, size: number, char = " "): string {
  return String(value).padEnd(size, char);
}

export function limitText(value: string, size: number): string {
  if (value.length <= size) {
    return value;
  }

  return value.slice(0, size);
}

export function centerText(value: string, width = 48): string {
  if (value.length >= width) {
    return value.slice(0, width);
  }

  const left = Math.floor((width - value.length) / 2);
  return `${" ".repeat(left)}${value}`;
}

export function line(width = 48): string {
  return "=".repeat(width);
}

export function thinLine(width = 48): string {
  return "-".repeat(width);
}

export function formatCpfCnpj(value?: string): string {
  if (!value) {
    return "NÃO INFORMADO";
  }

  const numbers = onlyNumbers(value);

  if (numbers.length === 11) {
    return numbers.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
  }

  if (numbers.length === 14) {
    return numbers.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
  }

  return value;
}