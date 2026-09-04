import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('sessionTimeout config', () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
  });

  it('exporta constantes com valores padrão', async () => {
    const mod = await import('./sessionTimeout.js');
    expect(mod.SESSION_TIMEOUT_MS).toBe(15 * 60_000);
    expect(mod.SESSION_WARNING_BEFORE_MS).toBe(2 * 60_000);
    expect(mod.ACTIVITY_THROTTLE_MS).toBe(5_000);
    expect(mod.SESSION_STORAGE_KEY).toBe('procedi_last_activity');
  });
});
