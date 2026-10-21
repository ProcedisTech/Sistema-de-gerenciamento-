import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthApiError } from '@supabase/supabase-js';

/**
 * Item 4 (testador) — galeria com sessão expirada, passando pelo caminho REAL do api.js
 * (request → erroHttp → buildApiErrorMessage). Prova o que a tela recebe de verdade.
 */

vi.mock('../lib/supabaseClient', () => ({
  supabase: {
    auth: {
      getSession: vi.fn(async () => ({
        data: { session: { access_token: 'tok-velho', refresh_token: 'r' } },
        error: null,
      })),
      refreshSession: vi.fn(async () => ({
        data: { session: null, user: null },
        error: new AuthApiError('Invalid Refresh Token: Refresh Token Not Found', 400, 'refresh_token_not_found'),
      })),
    },
  },
}));

import { MENSAGEM_SESSAO_EXPIRADA, pacientesGaleriaApi, setOrgId } from '../services/api';
import { formatPacienteGaleriaError } from './pacienteGaleria';

const ORG = '11111111-2222-3333-4444-555555555555';

const resposta401 = ({ statusText = '', json }) => ({
  status: 401,
  ok: false,
  statusText,
  headers: new Headers({ 'content-type': 'application/json' }),
  json,
  text: async () => '',
});

const pegarErro = async (p) => {
  try {
    await p;
  } catch (e) {
    return e;
  }
  throw new Error('era para falhar');
};

let aviso;
beforeEach(() => {
  setOrgId(ORG);
  aviso = vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => {
  aviso.mockRestore();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('galeria · 401 com renovação recusada pelo caminho real do api.js', () => {
  it('backend com corpo vazio e statusText vazio (HTTP/2) → texto de sessão expirada, sem "[HTTP"', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => resposta401({ json: async () => { throw new SyntaxError('corpo vazio'); } })),
    );
    const err = await pegarErro(pacientesGaleriaApi.list('p1'));
    expect(err.status).toBe(401);
    expect(err.sessaoExpirada).toBe(true);
    expect(err.message).toBe('[HTTP 401]');
    const tela = formatPacienteGaleriaError(err);
    expect(tela).toBe(MENSAGEM_SESSAO_EXPIRADA);
    expect(tela).not.toContain('[HTTP');
    expect(tela).not.toContain('Não autorizado (401)');
  });

  it('backend com corpo vazio e statusText "Unauthorized" (HTTP/1.1) → texto de sessão expirada (reserva)', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        resposta401({ statusText: 'Unauthorized', json: async () => { throw new SyntaxError('corpo vazio'); } }),
      ),
    );
    const err = await pegarErro(pacientesGaleriaApi.list('p1'));
    expect(err.sessaoExpirada).toBe(true);
    expect(formatPacienteGaleriaError(err)).toBe(MENSAGEM_SESSAO_EXPIRADA);
  });

  it('backend com mensagem → mostra só a mensagem do backend (sem "[HTTP 401]")', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => resposta401({ json: async () => ({ message: 'Token expirado.' }) })));
    const err = await pegarErro(pacientesGaleriaApi.list('p1'));
    expect(err.sessaoExpirada).toBe(true);
    expect(formatPacienteGaleriaError(err)).toBe('Token expirado.');
  });
});

describe('galeria · contrato do texto de sessão', () => {
  it('fallback local é o mesmo texto do api.js', () => {
    expect(formatPacienteGaleriaError({ status: 401, sessaoExpirada: true, message: '' })).toBe(
      MENSAGEM_SESSAO_EXPIRADA,
    );
  });

  it('sessaoExpirada só vale com === true (string "true" cai no 401 comum)', () => {
    expect(formatPacienteGaleriaError({ status: 401, sessaoExpirada: 'true', message: '' })).toBe(
      'Erro ao usar a galeria.',
    );
  });
});

describe('galeria · 401 comum (renovação OK, backend recusa de novo) pelo caminho real do api.js', () => {
  it('corpo vazio e statusText vazio, sem sessaoExpirada → "Erro ao usar a galeria."', async () => {
    const { supabase } = await import('../lib/supabaseClient');
    supabase.auth.refreshSession.mockImplementationOnce(async () => ({
      data: { session: { access_token: 'tok-novo', refresh_token: 'r2' }, user: { id: 'u' } },
      error: null,
    }));
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => resposta401({ json: async () => { throw new SyntaxError('corpo vazio'); } })),
    );
    const err = await pegarErro(pacientesGaleriaApi.list('p1'));
    expect(err.status).toBe(401);
    expect(err.sessaoExpirada).toBeUndefined();
    expect(err.message).toBe('[HTTP 401]');
    expect(formatPacienteGaleriaError(err)).toBe('Erro ao usar a galeria.');
  });
});

describe('galeria · download presigned (new Error("[HTTP n]") do api.js)', () => {
  it('403 sem corpo → texto de reserva do 403, sem "[HTTP"', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 403 })));
    const err = await pegarErro(
      pacientesGaleriaApi.fetchArquivoBlob('https://r2.exemplo/f.jpg?X-Amz-Signature=abc'),
    );
    expect(err.message).toBe('[HTTP 403]');
    expect(formatPacienteGaleriaError(err)).toBe('Sem permissão nesta organização para esta operação na galeria.');
  });
});
