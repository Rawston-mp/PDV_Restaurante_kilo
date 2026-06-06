import { SerialPort } from 'serialport';

type ScaleReaderOptions = {
  samplesToConfirm?: number;
  tolerance?: number;
  onStableWeight?: (peso: number) => void;
};

export const startScaleReader = (path: string, options: ScaleReaderOptions = {}) => {
  const samplesToConfirm = options.samplesToConfirm ?? 3;
  const tolerance = options.tolerance ?? 0.02;
  const onStableWeight = options.onStableWeight;

  const port = new SerialPort({ path, baudRate: 9600 });
  const window: number[] = [];

  port.on('data', (data) => {
    const peso = parseFloat(data.toString().trim().replace(',', '.'));

    if (!Number.isFinite(peso) || peso <= 0) {
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
