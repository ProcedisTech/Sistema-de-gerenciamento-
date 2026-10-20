import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthApiError, AuthRetryableFetchError, AuthSessionMissingError } from '@supabase/supabase-js';

/**
 * B-42 FD — sessão no api.js: renovação do acesso com promessa compartilhada e falha classificada
 * (ok | definitiva | rede). Só a falha definitiva (o servidor de auth recusou) tira a aba do sistema.
 * Erros do supabase são os reais do auth-js 2.109 (lib/errors.js).
 */

const estado = vi.hoisted(() => ({ token: 'tok-velho' }));

vi.mock('../lib/supabaseClient', () => ({
  supabase: {
    auth: {
      getSession: vi.fn(async () => ({
        data: { session: estado.token ? { access_token: estado.token, refresh_token: 'refresh-xyz' } : null },
        error: null,
      })),
      refreshSession: vi.fn(),
    },
  },
}));

import { supabase } from '../lib/supabaseClient';
import {
  atendimentosApi,
  attemptTokenRefresh,
  getApiErrorToastMessage,
  MENSAGEM_SESSAO_EXPIRADA,
  pacientesApi,
  setOrgId,
} from './api';
import { criarLeitorAvisos, STATUS_LEITOR } from './avisos/canalAvisos.js';
import { formatAgendamentoApiError, formatJourneyFinishError } from '../utils/agendaErrors';
import { formatPacienteGaleriaError } from '../utils/pacienteGaleria';

const ORG = '11111111-2222-3333-4444-555555555555';

const resposta = (status, body = {}, extras = {}) => ({
  status,
  ok: status >= 200 && status < 300,
  statusText: '',
  headers: new Headers({ 'content-type': 'application/json', ...(extras.headers || {}) }),
  json: async () => body,
  text: async () => JSON.stringify(body),
  blob: async () => new Blob(['x']),
});

/** Servidor falso: só aceita o token atual "válido"; rotas de negócio podem responder 401 sempre. */
const servidor = { tokenValido: 'tok-novo', negocio401: new Set(), atrasar: new Map() };

const fetchFalso = vi.fn(async (url, init = {}) => {
  const caminho = new URL(url, 'http://localhost').pathname;
  const segurar = servidor.atrasar.get(caminho);
  if (segurar) {
    servidor.atrasar.delete(caminho);
    await segurar;
  }
  const auth = init.headers?.Authorization;
  if (servidor.negocio401.has(caminho)) return resposta(401, { message: 'Senha incorreta.' });
  if (auth !== `Bearer ${servidor.tokenValido}`) return resposta(401, { error: 'Unauthorized' });
  return resposta(200, { ok: true });
});

const renovarOk = () => {
  supabase.auth.refreshSession.mockImplementation(async () => {
    estado.token = 'tok-novo';
    return { data: { session: { access_token: 'tok-novo', refresh_token: 'refresh-novo' } }, error: null };
  });
};

const renovarFalha = (erro) => {
  supabase.auth.refreshSession.mockImplementation(async () => ({
    data: { session: null, user: null },
    error: erro,
  }));
};

const recusada = () =>
  new AuthApiError('Invalid Refresh Token: Refresh Token Not Found', 400, 'refresh_token_not_found');
const semRede = () => new AuthRetryableFetchError('Failed to fetch', 0);

const tick = () => new Promise((r) => setTimeout(r, 0));

let expirados;
const ouvir = (e) => expirados.push(e.detail);
let avisoConsole;

beforeEach(() => {
  estado.token = 'tok-velho';
  servidor.tokenValido = 'tok-novo';
  servidor.negocio401 = new Set();
  servidor.atrasar = new Map();
  vi.clearAllMocks();
  vi.stubGlobal('fetch', fetchFalso);
  setOrgId(ORG);
  expirados = [];
  window.addEventListener('auth:expired', ouvir);
  avisoConsole = vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  window.removeEventListener('auth:expired', ouvir);
  avisoConsole.mockRestore();
  vi.unstubAllGlobals();
});

const pegarErro = async (promessa) => {
  try {
    await promessa;
  } catch (e) {
    return e;
  }
  throw new Error('era para falhar');
};

describe('api.js — renovação do acesso (B-42 FD)', () => {
  it('T1: 401 → renova uma vez e repete com o token novo', async () => {
    renovarOk();
    const r = await atendimentosApi.minhas();
    expect(r).toEqual({ ok: true });
    expect(supabase.auth.refreshSession).toHaveBeenCalledTimes(1);
    expect(fetchFalso).toHaveBeenCalledTimes(2);
    expect(fetchFalso.mock.calls[1][1].headers.Authorization).toBe('Bearer tok-novo');
    expect(expirados).toEqual([]);
  });

  it('T2: falha definitiva (AuthApiError 400 refresh_token_not_found) → 1 auth:expired local por renovação + mensagem de sessão', async () => {
    renovarFalha(recusada());
    const err = await pegarErro(atendimentosApi.minhas());
    expect(err.status).toBe(401);
    expect(err.sessaoExpirada).toBe(true);
    expect(getApiErrorToastMessage(err, 'Falhou.')).toBe(MENSAGEM_SESSAO_EXPIRADA);
    expect(MENSAGEM_SESSAO_EXPIRADA).toBe('Sua sessão expirou. Faça login novamente.');
    expect(expirados).toEqual([{ scope: 'local', motivo: 'renovacao' }]);
  });

  it('T2: AuthSessionMissingError também é definitiva', async () => {
    renovarFalha(new AuthSessionMissingError());
    const r = await attemptTokenRefresh('tok-velho');
    expect(r).toEqual({ tipo: 'definitiva' });
    expect(expirados).toEqual([{ scope: 'local', motivo: 'renovacao' }]);
  });

  it('T2b: falha de rede (AuthRetryableFetchError) → sem auth:expired, sem mensagem de sessão, log com tipo rede', async () => {
    renovarFalha(semRede());
    const err = await pegarErro(atendimentosApi.minhas());
    expect(err.status).toBe(401);
    expect(err.sessaoExpirada).toBeUndefined();
    expect(getApiErrorToastMessage(err, 'Falhou.')).not.toBe(MENSAGEM_SESSAO_EXPIRADA);
    expect(expirados).toEqual([]);
    expect(avisoConsole).toHaveBeenCalledWith(
      '[api] Falha ao renovar o acesso',
      expect.objectContaining({ tipo: 'rede', name: 'AuthRetryableFetchError', status: 0 }),
    );
  });

  it.each([
    ['5xx do auth (AuthRetryableFetchError 503)', () => new AuthRetryableFetchError('Service Unavailable', 503)],
    ['AuthApiError 500', () => new AuthApiError('erro interno', 500, 'unexpected_failure')],
    ['AuthApiError 429 (limite de requisições)', () => new AuthApiError('rate limit', 429, 'over_request_rate_limit')],
    ['exceção fora do auth (ex.: lock)', () => new Error('lock timeout')],
  ])('T2b: %s → rede (não sai)', async (_nome, erro) => {
    supabase.auth.refreshSession.mockImplementation(async () => {
      const e = erro();
      if (e instanceof AuthApiError || e instanceof AuthRetryableFetchError) return { data: { session: null }, error: e };
      throw e;
    });
    const r = await attemptTokenRefresh('tok-velho');
    expect(r).toEqual({ tipo: 'rede' });
    expect(expirados).toEqual([]);
  });

  it('T3: 401 de negócio ("Senha incorreta.") → sem logout e sem mensagem de sessão', async () => {
    renovarOk();
    servidor.negocio401.add('/api/v1/pacientes/p1');
    const err = await pegarErro(pacientesApi.remove('p1'));
    expect(err.status).toBe(401);
    expect(err.sessaoExpirada).toBeUndefined();
    expect(expirados).toEqual([]);
    expect(getApiErrorToastMessage(err, 'Falhou.')).toBe('Senha incorreta.');
  });

  it('T4: 5 requisições com 401 ao mesmo tempo → 1 renovação e 1 evento (falha definitiva)', async () => {
    let soltar;
    supabase.auth.refreshSession.mockImplementation(
      () =>
        new Promise((r) => {
          soltar = () => r({ data: { session: null }, error: recusada() });
        }),
    );
    const promessas = Array.from({ length: 5 }, () => pegarErro(atendimentosApi.minhas()));
    for (let i = 0; i < 5; i += 1) await tick();
    soltar();
    const erros = await Promise.all(promessas);
    expect(supabase.auth.refreshSession).toHaveBeenCalledTimes(1);
    expect(expirados).toHaveLength(1);
    erros.forEach((e) => expect(e.sessaoExpirada).toBe(true));
  });

  it('T4: 5 requisições com 401 ao mesmo tempo → 1 renovação e todas repetem com o token novo', async () => {
    let soltar;
    supabase.auth.refreshSession.mockImplementation(
      () =>
        new Promise((r) => {
          soltar = () => {
            estado.token = 'tok-novo';
            r({ data: { session: { access_token: 'tok-novo' } }, error: null });
          };
        }),
    );
    const promessas = Array.from({ length: 5 }, () => atendimentosApi.minhas());
    for (let i = 0; i < 5; i += 1) await tick();
    soltar();
    const respostas = await Promise.all(promessas);
    expect(supabase.auth.refreshSession).toHaveBeenCalledTimes(1);
    expect(respostas).toEqual(Array(5).fill({ ok: true }));
  });

  it('T5: quem chega atrasado com o token velho só repete (não renova de novo)', async () => {
    renovarOk();
    let soltarLenta;
    servidor.atrasar.set(
      '/api/v1/atendimentos/lenta',
      new Promise((r) => {
        soltarLenta = r;
      }),
    );
    const lenta = atendimentosApi.detalhe('lenta');
    await tick();
    await atendimentosApi.minhas(); // 401 → renova → tok-novo
    expect(supabase.auth.refreshSession).toHaveBeenCalledTimes(1);

    soltarLenta(); // a lenta volta com 401 do token velho
    await expect(lenta).resolves.toEqual({ ok: true });
    expect(supabase.auth.refreshSession).toHaveBeenCalledTimes(1);
    expect(fetchFalso.mock.calls.at(-1)[1].headers.Authorization).toBe('Bearer tok-novo');
  });

  describe('T6: Delete, Form e Blob seguem a mesma regra', () => {
    const chamadas = {
      requestDelete: () => pacientesApi.removeFotoPerfil('p1'),
      requestForm: () => pacientesApi.uploadFotoPerfil('p1', new Blob(['x'], { type: 'image/png' })),
      requestBlob: () => pacientesApi.getFotoPerfilBlob('p1'),
    };

    it.each(Object.keys(chamadas))('%s: renova e repete', async (nome) => {
      renovarOk();
      await chamadas[nome]();
      expect(supabase.auth.refreshSession).toHaveBeenCalledTimes(1);
      expect(fetchFalso.mock.calls.at(-1)[1].headers.Authorization).toBe('Bearer tok-novo');
      expect(expirados).toEqual([]);
    });

    it.each(Object.keys(chamadas))('%s: falha definitiva → sessaoExpirada + 1 auth:expired', async (nome) => {
      renovarFalha(recusada());
      const err = await pegarErro(chamadas[nome]());
      expect(err.status).toBe(401);
      expect(err.sessaoExpirada).toBe(true);
      expect(expirados).toEqual([{ scope: 'local', motivo: 'renovacao' }]);
    });

    it.each(Object.keys(chamadas))('%s: falha de rede → erro comum, sem sessaoExpirada, sem evento', async (nome) => {
      renovarFalha(semRede());
      const err = await pegarErro(chamadas[nome]());
      expect(err.status).toBe(401);
      expect(err.sessaoExpirada).toBeUndefined();
      expect(expirados).toEqual([]);
    });
  });

  it('T7: o log da falha não leva token nem sessão (só code, status, name, message, tipo, em)', async () => {
    renovarFalha(recusada());
    await pegarErro(atendimentosApi.minhas());
    renovarFalha(semRede());
    await pegarErro(atendimentosApi.minhas());

    const logs = avisoConsole.mock.calls.filter((c) => c[0] === '[api] Falha ao renovar o acesso');
    expect(logs).toHaveLength(2);
    for (const [, dados] of logs) {
      expect(Object.keys(dados).sort()).toEqual(['code', 'em', 'message', 'name', 'status', 'tipo']);
      expect(new Date(dados.em).toISOString()).toBe(dados.em);
    }
    expect(logs[0][1]).toMatchObject({ code: 'refresh_token_not_found', status: 400, tipo: 'definitiva' });
    const tudo = JSON.stringify(avisoConsole.mock.calls);
    ['tok-velho', 'tok-novo', 'refresh-xyz', 'Bearer'].forEach((segredo) => expect(tudo).not.toContain(segredo));
  });
});

describe('canal de avisos com a renovação real (B-42 FD)', () => {
  const montarLeitor = () => {
    const status = [];
    const sse = vi.fn(async () => resposta(401, {}));
    const leitor = criarLeitorAvisos({
      orgId: ORG,
      url: '/api/v1/eventos/stream',
      fetchImpl: sse,
      obterHeaders: async ({ token }) => ({ Authorization: `Bearer ${token ?? estado.token}` }),
      aleatorio: () => 0.5,
      onStatus: (s) => status.push(s),
    });
    return { leitor, status, sse };
  };

  it('falha definitiva no SSE → saída da aba pelo mesmo evento (auth:expired local, renovacao)', async () => {
    renovarFalha(recusada());
    const { leitor, status } = montarLeitor();
    leitor.iniciar();
    for (let i = 0; i < 5; i += 1) await tick();
    expect(expirados).toEqual([{ scope: 'local', motivo: 'renovacao' }]);
    expect(status.at(-1)).toBe(STATUS_LEITOR.BLOQUEADO);
    leitor.parar();
  });

  it('falha de rede no SSE → reconectando (erro), sem auth:expired, nunca bloqueado', async () => {
    renovarFalha(semRede());
    const { leitor, status } = montarLeitor();
    leitor.iniciar();
    for (let i = 0; i < 5; i += 1) await tick();
    expect(expirados).toEqual([]);
    expect(status.at(-1)).toBe(STATUS_LEITOR.ERRO);
    expect(status).not.toContain(STATUS_LEITOR.BLOQUEADO);
    leitor.parar();
  });
});

describe('textos de sessão em agendaErrors e pacienteGaleria (B-42 FD)', () => {
  const comum = () => {
    const e = new Error('[HTTP 401] Senha incorreta.');
    e.status = 401;
    e.body = { message: 'Senha incorreta.' };
    return e;
  };
  const expirada = () => Object.assign(comum(), { sessaoExpirada: true });

  it('401 comum → mensagem do backend, sem texto de sessão', () => {
    expect(formatJourneyFinishError(comum())).toBe('[HTTP 401] Senha incorreta.');
    expect(formatAgendamentoApiError(comum())).toBe('[HTTP 401] Senha incorreta.');
    expect(formatPacienteGaleriaError(comum())).toBe('Senha incorreta.');
    expect(getApiErrorToastMessage(comum(), 'Falhou.')).toBe('Senha incorreta.');
  });

  it('401 com sessaoExpirada → texto de sessão (os que já existem)', () => {
    expect(formatJourneyFinishError(expirada())).toContain('Sessão expirada ou sem permissão — faça login novamente.');
    expect(formatAgendamentoApiError(expirada())).toContain('— Sessão não autenticada');
    // Item 4: a galeria volta a mostrar a mensagem do backend; nunca o antigo "Não autorizado (401)".
    expect(formatPacienteGaleriaError(expirada())).toBe('Senha incorreta.');
    expect(formatPacienteGaleriaError(expirada())).not.toContain('Não autorizado (401)');
    expect(getApiErrorToastMessage(expirada(), 'Falhou.')).toBe(MENSAGEM_SESSAO_EXPIRADA);
  });
});

describe('atendimentosApi sem pausar (B-42: a pausa deixou de existir)', () => {
  it('não expõe pausar', () => {
    expect(atendimentosApi.pausar).toBeUndefined();
  });
});
