import { SerialPort } from 'serialport';

type ScaleReaderOptions = {
  samplesToConfirm?: number;
  tolerance?: number;
  onStableWeight?: (peso: number) => void;
};

export const parseScaleData = (dataStr: string): number | null => {
  const cleanStr = dataStr.replace(/[\x02\x03\r\n]/g, '').trim();

  // Protocolo Toledo STX/ETX com 5 dígitos numéricos em gramas (ex: "00455" -> 0.455 kg)
  if (/^\d{5}$/.test(cleanStr)) {
    const grams = parseInt(cleanStr, 10);
    const weight = Number((grams / 1000).toFixed(3));
    return weight > 0 ? weight : null;
  }

  // Protocolo Toledo P03 ou formato padrão com ponto/vírgula (ex: "0.455" ou "0,455")
  const match = cleanStr.match(/(\d+[.,]?\d*)/);
  if (match) {
    const peso = parseFloat(match[1].replace(',', '.'));
    if (Number.isFinite(peso) && peso > 0) {
      // Se o peso vier maior que 100 sem ponto decimal, trata como gramas (ex: 455 -> 0.455)
      if (peso > 100 && !match[1].includes('.') && !match[1].includes(',')) {
        return Number((peso / 1000).toFixed(3));
      }
      return Number(peso.toFixed(3));
    }
  }

  return null;
};

export const startScaleReader = (path: string, options: ScaleReaderOptions = {}) => {
  const samplesToConfirm = options.samplesToConfirm ?? 3;
  const tolerance = options.tolerance ?? 0.02;
  const onStableWeight = options.onStableWeight;

  const port = new SerialPort({ path, baudRate: 9600 });
  const window: number[] = [];

  port.on('data', (data) => {
    const peso = parseScaleData(data.toString());

    if (peso === null || peso <= 0) {
      return;
    }

    window.push(peso);
    if (window.length > samplesToConfirm) {
      window.shift();
    }

    if (window.length < samplesToConfirm) {
      return;
    }

    const min = Math.min(...window);
    const max = Math.max(...window);
    const stable = max - min <= tolerance;

    if (stable) {
      const media = window.reduce((acc, value) => acc + value, 0) / window.length;
      const stableWeight = Number(media.toFixed(3));

      onStableWeight?.(stableWeight);
      // eslint-disable-next-line no-console
      console.log('Peso estavel:', stableWeight);
    }
  });

  return port;
};
