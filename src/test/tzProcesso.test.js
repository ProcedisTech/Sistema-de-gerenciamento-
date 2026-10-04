import { describe, it, expect } from 'vitest';

describe('fuso do processo de teste', () => {
  it('respeita a variável TZ quando definida', () => {
    const tz = globalThis.process?.env?.TZ;
    const fusoProcesso = Intl.DateTimeFormat().resolvedOptions().timeZone;
    console.warn(`[tzProcesso] TZ=${tz ?? '(não definida)'} · Intl=${fusoProcesso}`);
    if (tz === 'UTC') {
      expect(['UTC', 'Etc/UTC']).toContain(fusoProcesso);
    } else if (tz) {
      expect(fusoProcesso).toBe(tz);
    }
  });
});
