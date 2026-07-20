import { fiscalContainer } from '@/modules/fiscal/infrastructure/container/fiscalContainer';

let running = false;

export const startFiscalRetryWorker = () => {
  if (typeof window === 'undefined') {
    return () => {};
  }

  const run = async () => {
    if (running) {
      return;
    }

    running = true;
    try {
      const processed = await fiscalContainer.retryPendingFiscalDocuments.execute();
      if (processed.length > 0) {
        window.dispatchEvent(new CustomEvent('pdv.fiscal-documents-refresh'));
      }
    } finally {
      running = false;
    }
  };

  const intervalId = window.setInterval(run, 60_000);
  window.addEventListener('online', run);
  void run();

  return () => {
    window.clearInterval(intervalId);
    window.removeEventListener('online', run);
  };
};
