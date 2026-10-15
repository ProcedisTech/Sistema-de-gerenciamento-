import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * termosApi.resolver: `atendimentoId` (opcional) vai como query param SÓ quando informado.
 * Dentro da consulta o backend aceita apenas assinatura ASSINADA nesta consulta; fora dela nada muda.
 */
vi.mock('../lib/supabaseClient', () => ({
  supabase: {
    auth: {
      getSession: vi.fn(async () => ({ data: { session: { access_token: 'tok', refresh_token: 'r' } }, error: null })),
      refreshSession: vi.fn(),
    },
  },
}));

import { setOrgId, termosApi } from './api';

const ORG = '11111111-2222-3333-4444-555555555555';
const PAC = 'pac-1';
const CAT_A = 'cat-a';
const CAT_B = 'cat-b';
const ATEND = '99999999-aaaa-bbbb-cccc-000000000001';

let urls;
let fetchOriginal;

beforeEach(() => {
  urls = [];
  setOrgId(ORG);
  fetchOriginal = globalThis.fetch;
  globalThis.fetch = vi.fn(async (url) => {
    urls.push(String(url));
    return {
      status: 200,
      ok: true,
      statusText: '',
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => ({ faltantes: [] }),
      text: async () => '{"faltantes":[]}',
    };
  });
});

afterEach(() => {
  globalThis.fetch = fetchOriginal;
});

const consulta = (url) => new URL(url, 'http://localhost').searchParams;

describe('termosApi.resolver e atendimentoId', () => {
  it('com atendimentoId: envia atendimentoId junto de pacienteId e dos catálogos', async () => {
    await termosApi.resolver({ pacienteId: PAC, catalogoIds: [CAT_A, CAT_B], atendimentoId: ATEND });
    expect(urls).toHaveLength(1);
    expect(new URL(urls[0], 'http://localhost').pathname).toBe('/api/v1/termos/resolucao');
    const q = consulta(urls[0]);
    expect(q.get('pacienteId')).toBe(PAC);
    expect(q.getAll('catalogoProcedimentoSaudeIds')).toEqual([CAT_A, CAT_B]);
    expect(q.get('atendimentoId')).toBe(ATEND);
  });

  it('sem atendimentoId (ou vazio/nulo): a query não leva atendimentoId', async () => {
    await termosApi.resolver({ pacienteId: PAC, catalogoIds: [CAT_A] });
    await termosApi.resolver({ pacienteId: PAC, catalogoIds: [CAT_A], atendimentoId: null });
    await termosApi.resolver({ pacienteId: PAC, catalogoIds: [CAT_A], atendimentoId: '  ' });
    expect(urls).toHaveLength(3);
    for (const u of urls) {
      expect(u).not.toContain('atendimentoId');
      expect(consulta(u).get('pacienteId')).toBe(PAC);
    }
  });
});
