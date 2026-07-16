/**
 * Regressão: descoberta /organizacoes/minhas NÃO envia X-Org-Id;
 * tenant calls sem org falham fechado.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../lib/supabaseClient.js', () => ({
  supabase: {
    auth: {
      getSession: vi.fn(async () => ({ data: { session: { access_token: 'tok-test' } } })),
      refreshSession: vi.fn(async () => ({ data: { session: null }, error: null })),
    },
  },
}));

import {
  authHeadersForFetch,
  getOrgId,
  organizacaoApi,
  setOrgId,
} from '../services/api.js';
import { PLACEHOLDER_ORG_ID } from '../config/apiEnv.js';

describe('org discovery / tenant headers', () => {
  beforeEach(() => {
    setOrgId('');
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        status: 200,
        json: async () => [],
        headers: { get: () => 'application/json' },
      })),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    setOrgId('');
  });

  it('setOrgId(falsy|placeholder) → currentOrgId vazio', () => {
    setOrgId(PLACEHOLDER_ORG_ID);
    expect(getOrgId()).toBe('');
    setOrgId('d0000000-0000-0000-0000-0000000000aa');
    expect(getOrgId()).toBe('d0000000-0000-0000-0000-0000000000aa');
    setOrgId(null);
    expect(getOrgId()).toBe('');
  });

  it('authHeadersForFetch({ needsOrg: false }) nunca inclui X-Org-Id', async () => {
    setOrgId('d0000000-0000-0000-0000-0000000000aa');
    const h = await authHeadersForFetch({ needsOrg: false });
    expect(h.Authorization).toMatch(/^Bearer /);
    expect(h['X-Org-Id']).toBeUndefined();
  });

  it('authHeadersForFetch({ needsOrg: true }) sem org → throw ORG_REQUIRED', async () => {
    setOrgId('');
    await expect(authHeadersForFetch({ needsOrg: true })).rejects.toMatchObject({
      code: 'ORG_REQUIRED',
    });
  });

  it('authHeadersForFetch({ needsOrg: true }) com org real → envia X-Org-Id', async () => {
    const org = 'd0000000-0000-0000-0000-0000000000aa';
    setOrgId(org);
    const h = await authHeadersForFetch({ needsOrg: true });
    expect(h['X-Org-Id']).toBe(org);
  });

  it('organizacaoApi.getMinhas não envia X-Org-Id', async () => {
    setOrgId('d0000000-0000-0000-0000-0000000000aa');
    await organizacaoApi.getMinhas();
    expect(fetch).toHaveBeenCalled();
    const [, opts] = fetch.mock.calls[0];
    expect(opts.headers['X-Org-Id']).toBeUndefined();
    expect(String(fetch.mock.calls[0][0])).toContain('/api/v1/organizacoes/minhas');
  });
});
