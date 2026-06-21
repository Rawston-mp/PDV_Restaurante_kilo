import { describe, expect, it } from 'vitest';

import { resolveByVersionAndTime } from '@/shared/sync/domain/services/resolveByVersionAndTime';

describe('resolveByVersionAndTime', () => {
  it('prioriza a maior versão', () => {
    const local = { version: 1, updatedAt: new Date('2026-06-04T10:00:00Z'), value: 'local' };
    const remote = { version: 2, updatedAt: new Date('2026-06-04T09:00:00Z'), value: 'remote' };

    expect(resolveByVersionAndTime(local, remote)).toEqual(remote);
  });

  it('em caso de empate de versão, prioriza o updatedAt mais recente', () => {
    const local = { version: 3, updatedAt: new Date('2026-06-04T10:00:00Z'), value: 'local' };
    const remote = { version: 3, updatedAt: new Date('2026-06-04T11:00:00Z'), value: 'remote' };

    expect(resolveByVersionAndTime(local, remote)).toEqual(remote);
  });
});
