export type RetryOptions = {
  maxAttempts: number;
  baseDelayMs: number;
  wait?: (ms: number) => Promise<void>;
  onRetry?: (attempt: number, error: unknown, nextDelayMs: number) => void;
};

const defaultWait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export async function executeWithRetry<T>(
  operation: () => Promise<T>,
  options: RetryOptions
): Promise<T> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= options.maxAttempts; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;

      if (attempt >= options.maxAttempts) {
        break;
      }

      const nextDelayMs = options.baseDelayMs * 2 ** (attempt - 1);
      options.onRetry?.(attempt, error, nextDelayMs);
      await (options.wait ?? defaultWait)(nextDelayMs);
    }
  }

  throw lastError;
}
