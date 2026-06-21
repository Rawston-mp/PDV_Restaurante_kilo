import { describe, expect, it, vi } from 'vitest';

import { executeWithRetry } from '@/shared/sync/application/services/executeWithRetry';

describe('executeWithRetry', () => {
  it('reexecuta até obter sucesso com backoff', async () => {
    const wait = vi.fn().mockResolvedValue(undefined);
    const operation = vi
      .fn<() => Promise<string>>()
      .mockRejectedValueOnce(new Error('temporario'))
      .mockRejectedValueOnce(new Error('temporario'))
      .mockResolvedValue('ok');

    const result = await executeWithRetry(operation, {
      maxAttempts: 3,
      baseDelayMs: 10,
      wait
    });

    expect(result).toBe('ok');
    expect(operation).toHaveBeenCalledTimes(3);
    expect(wait).toHaveBeenNthCalledWith(1, 10);
    expect(wait).toHaveBeenNthCalledWith(2, 20);
  });

  it('lanca erro final quando excede tentativas', async () => {
    const operation = vi.fn<() => Promise<void>>().mockRejectedValue(new Error('falhou'));

    await expect(
      executeWithRetry(operation, {
        maxAttempts: 2,
        baseDelayMs: 5,
        wait: async () => undefined
      })
    ).rejects.toThrow('falhou');

    expect(operation).toHaveBeenCalledTimes(2);
  });
});
