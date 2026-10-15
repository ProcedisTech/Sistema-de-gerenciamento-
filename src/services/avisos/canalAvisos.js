/**
 * Leitor do canal de avisos (SSE via `fetch`, protocolo v1). Um leitor por aba, criado pelo `AvisosProvider`.
 *
 * - Token só no header `Authorization` (nunca na URL); `X-Org-Id` = clínica do leitor.
 * - Status `conectado` só depois de `event: conectado` (resposta 200 sem bytes conta como desconectada).
 * - 401: renova o token uma vez. Renovação recusada (falha definitiva) ou 403 -> `bloqueado` (não reconecta; a
 *   saída da aba vem do `auth:expired` que a renovação dispara). Renovação sem rede -> falha de conexão
 *   (backoff, `erro`/modo degradado) e renova de novo na próxima tentativa; nunca `bloqueado` por rede.
 * - 503: espera `Retry-After`. Rede/404/5xx: backoff com jitter. `online` reconecta na hora.
 * - `substituida`: só reconecta quando a aba ganhar foco ou voltar a ficar visível.
 * - Aba oculta por mais de `ocultaMs` fecha o stream; ao ficar visível, reconecta com `Last-Event-ID`.
 * - `X-Aba-Id`: id da aba (`idDaAba()`, gerado uma vez por carga da página, só em memória) em todo fetch do stream.
 * - `pendencia-liberada`: mensagem de controle efêmera (sem id); repassada a `onPendenciaLiberada` sem tocar
 *   em `ultimoId`/ids vistos.
 * - Nunca registra em log o conteúdo dos avisos.
 */
import { createParser } from 'eventsource-parser';
import { resolveApiUrl } from '../../config/apiEnv';
import { attemptTokenRefresh, authHeadersForFetch, getFreshToken } from '../api';
import { VERSAO_PROTOCOLO } from './tiposAviso';

export const CAMINHO_STREAM = '/api/v1/eventos/stream';

export const TEMPOS_PADRAO = Object.freeze({
  backoffMs: Object.freeze([1000, 2000, 5000, 10000, 30000]),
  jitter: 0.2,
  silencioMs: 45_000,
  ocultaMs: 5 * 60_000,
  retryAfterPadraoMs: 5000,
});

export const LIMITE_IDS_VISTOS = 1000;

export const STATUS_LEITOR = Object.freeze({
  CONECTANDO: 'conectando',
  CONECTADO: 'conectado',
  ERRO: 'erro',
  SUBSTITUIDA: 'substituida',
  OCULTA: 'oculta',
  BLOQUEADO: 'bloqueado',
  PARADO: 'parado',
});

function gerarIdDaAba() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  // Fallback (ambientes sem randomUUID): uuid v4 por Math.random, só para identificar a aba.
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.floor(Math.random() * 16);
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/** @type {string | null} */
let idDaAbaAtual = null;

/**
 * Id desta aba: UUID gerado uma vez por carga da página e guardado só em memória (sessionStorage seria copiado
 * por "duplicar aba"). Vai em `X-Aba-Id` no stream e no encerrar.
 * @returns {string}
 */
export function idDaAba() {
  if (!idDaAbaAtual) idDaAbaAtual = gerarIdDaAba();
  return idDaAbaAtual;
}

/**
 * Só para testes: fixa o id da aba (ou `null` para gerar um novo na próxima chamada de `idDaAba()`).
 * @param {string | null} id
 */
export function __definirIdDaAbaParaTestes(id) {
  idDaAbaAtual = id ?? null;
}

async function headersPadrao({ orgId, token }) {
  const t = token ?? (await getFreshToken());
  const h = await authHeadersForFetch({ needsOrg: true, token: t });
  if (orgId) h['X-Org-Id'] = orgId;
  return h;
}

function idMaior(a, b) {
  if (!a) return true;
  try {
    return BigInt(b) > BigInt(a);
  } catch {
    return true;
  }
}

function parseRetryAfterMs(valor, padraoMs) {
  const s = Number.parseInt(String(valor ?? ''), 10);
  return Number.isFinite(s) && s >= 0 ? s * 1000 : padraoMs;
}

/**
 * @param {{
 *   orgId?: string,
 *   fetchImpl?: typeof fetch,
 *   obterHeaders?: (opts: { orgId?: string, token?: string | null }) => Promise<Record<string, string>>,
 *   renovarToken?: (tokenUsado?: string | null) => Promise<{ tipo: 'ok', token: string } | { tipo: 'definitiva' } | { tipo: 'rede' }>,
 *   url?: string,
 *   tempos?: Partial<typeof TEMPOS_PADRAO>,
 *   aleatorio?: () => number,
 *   onConectado?: (info: { primeiro: boolean, id: string | null }) => void,
 *   onAviso?: (aviso: { id: string | null, tipo: string, registroId: string | null, atendimentoId: string | null, porMim: boolean }) => void,
 *   onRecarregar?: (info: { id: string | null }) => void,
 *   onPendenciaLiberada?: (info: { atendimentoId: string | null }) => void,
 *   onSubstituida?: () => void,
 *   onStatus?: (status: string) => void,
 *   obterIdDaAba?: () => string,
 * }} opts
 */
export function criarLeitorAvisos({
  orgId,
  fetchImpl = (...args) => fetch(...args),
  obterHeaders = headersPadrao,
  renovarToken = attemptTokenRefresh,
  url = resolveApiUrl(CAMINHO_STREAM),
  tempos: temposParciais,
  aleatorio = Math.random,
  onConectado,
  onAviso,
  onRecarregar,
  onPendenciaLiberada,
  onSubstituida,
  onStatus,
  obterIdDaAba = idDaAba,
} = {}) {
  const tempos = { ...TEMPOS_PADRAO, ...temposParciais };

  let status = STATUS_LEITOR.PARADO;
  let parado = true;
  let ultimoId = null;
  let primeiroConectadoVisto = false;
  let tentativa = 0;
  let jaRenovou = false;
  let tokenRenovado = null;
  let aguardandoFoco = false;
  /** @type {AbortController | null} */
  let atual = null;
  let timerReconexao = null;
  let timerSilencio = null;
  let timerOculta = null;
  const idsVistos = new Set();
  const filaIds = [];

  const setStatus = (s) => {
    if (status === s) return;
    status = s;
    onStatus?.(s);
  };

  const limpar = (t) => {
    if (t) clearTimeout(t);
    return null;
  };

  const abortarAtual = () => {
    timerSilencio = limpar(timerSilencio);
    const ctrl = atual;
    atual = null;
    if (ctrl) ctrl.abort();
  };

  const agendar = (ms) => {
    timerReconexao = limpar(timerReconexao);
    if (parado) return;
    timerReconexao = setTimeout(() => {
      timerReconexao = null;
      conectar();
    }, ms);
  };

  const falhar = () => {
    abortarAtual();
    if (parado) return;
    setStatus(STATUS_LEITOR.ERRO);
    const base = tempos.backoffMs[Math.min(tentativa, tempos.backoffMs.length - 1)];
    tentativa += 1;
    const fator = 1 + tempos.jitter * (2 * aleatorio() - 1);
    agendar(Math.max(0, Math.round(base * fator)));
  };

  const bloquear = () => {
    abortarAtual();
    timerReconexao = limpar(timerReconexao);
    setStatus(STATUS_LEITOR.BLOQUEADO);
  };

  const lembrarId = (id) => {
    idsVistos.add(id);
    filaIds.push(id);
    if (filaIds.length > LIMITE_IDS_VISTOS) idsVistos.delete(filaIds.shift());
  };

  const armarSilencio = (ctrl) => {
    timerSilencio = limpar(timerSilencio);
    timerSilencio = setTimeout(() => {
      timerSilencio = null;
      if (ctrl === atual) falhar();
    }, tempos.silencioMs);
  };

  const tratarEvento = (ctrl, ev) => {
    if (ctrl !== atual) return;
    let dados;
    try {
      dados = JSON.parse(ev.data);
    } catch {
      return;
    }
    if (!dados) return;
    if (ev.event === 'pendencia-liberada') {
      // Mensagem de controle efêmera: sem id, não entra em idsVistos nem em ultimoId. Aceita `v` ausente.
      if (dados.v != null && dados.v !== VERSAO_PROTOCOLO) return;
      onPendenciaLiberada?.({ atendimentoId: dados.atendimentoId ?? null });
      return;
    }
    if (dados.v !== VERSAO_PROTOCOLO) return;
    const id = ev.id || null;

    switch (ev.event) {
      case 'conectado': {
        if (id) ultimoId = id;
        tentativa = 0;
        jaRenovou = false;
        setStatus(STATUS_LEITOR.CONECTADO);
        const primeiro = !primeiroConectadoVisto;
        primeiroConectadoVisto = true;
        onConectado?.({ primeiro, id });
        break;
      }
      case 'recarregar':
        if (id) ultimoId = id;
        onRecarregar?.({ id });
        break;
      case 'aviso': {
        if (id) {
          if (idsVistos.has(id)) return;
          lembrarId(id);
          if (idMaior(ultimoId, id)) ultimoId = id;
        }
        if (typeof dados.tipo !== 'string') return;
        onAviso?.({
          id,
          tipo: dados.tipo,
          registroId: dados.registroId ?? null,
          atendimentoId: dados.atendimentoId ?? null,
          porMim: dados.porMim === true,
        });
        break;
      }
      case 'substituida':
        abortarAtual();
        timerReconexao = limpar(timerReconexao);
        aguardandoFoco = true;
        setStatus(STATUS_LEITOR.SUBSTITUIDA);
        onSubstituida?.();
        break;
      default:
        break;
    }
  };

  async function lerCorpo(ctrl, res) {
    if (!res.body?.getReader) {
      falhar();
      return;
    }
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    const parser = createParser({
      onEvent: (ev) => tratarEvento(ctrl, ev),
      onComment: () => {},
    });
    armarSilencio(ctrl);
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (ctrl !== atual) return;
        if (done) break;
        armarSilencio(ctrl);
        parser.feed(typeof value === 'string' ? value : decoder.decode(value, { stream: true }));
        if (ctrl !== atual) return;
      }
    } catch {
      if (ctrl !== atual) return;
      falhar();
      return;
    }
    // Servidor encerrou (ex.: prazo do token): reconecta pelo backoff, que zera a cada `conectado`.
    falhar();
  }

  async function conectar() {
    timerReconexao = limpar(timerReconexao);
    abortarAtual();
    if (parado) return;
    const ctrl = new AbortController();
    atual = ctrl;
    setStatus(STATUS_LEITOR.CONECTANDO);

    let headers;
    try {
      const token = tokenRenovado;
      tokenRenovado = null;
      headers = { ...(await obterHeaders({ orgId, token })) };
    } catch {
      if (ctrl === atual) falhar();
      return;
    }
    if (ctrl !== atual) return;
    headers.Accept = 'text/event-stream';
    headers['X-Aba-Id'] = obterIdDaAba();
    if (ultimoId) headers['Last-Event-ID'] = ultimoId;

    let res;
    try {
      res = await fetchImpl(url, {
        method: 'GET',
        headers,
        credentials: 'omit',
        cache: 'no-store',
        signal: ctrl.signal,
      });
    } catch {
      if (ctrl === atual) falhar();
      return;
    }
    if (ctrl !== atual) return;

    if (res.status === 401) {
      res.body?.cancel?.().catch?.(() => {});
      if (jaRenovou) {
        bloquear();
        return;
      }
      jaRenovou = true;
      const tokenUsado = String(headers.Authorization || '').replace(/^Bearer\s+/i, '') || null;
      const renovacao = await Promise.resolve()
        .then(() => renovarToken(tokenUsado))
        .catch(() => ({ tipo: 'rede' }));
      if (ctrl !== atual) return;
      if (renovacao?.tipo === 'ok' && renovacao.token) {
        tokenRenovado = renovacao.token;
        conectar();
        return;
      }
      if (renovacao?.tipo === 'definitiva') {
        bloquear();
        return;
      }
      // Falha de rede na renovação: falha de conexão comum; a próxima tentativa renova de novo.
      jaRenovou = false;
      falhar();
      return;
    }
    if (res.status === 403) {
      res.body?.cancel?.().catch?.(() => {});
      bloquear();
      return;
    }
    if (res.status === 503) {
      res.body?.cancel?.().catch?.(() => {});
      abortarAtual();
      setStatus(STATUS_LEITOR.ERRO);
      agendar(parseRetryAfterMs(res.headers?.get?.('Retry-After'), tempos.retryAfterPadraoMs));
      return;
    }
    if (!res.ok) {
      res.body?.cancel?.().catch?.(() => {});
      falhar();
      return;
    }
    await lerCorpo(ctrl, res);
  }

  const podeReconectarPorEvento = () =>
    !parado && status !== STATUS_LEITOR.BLOQUEADO;

  const aoFocar = () => {
    if (!podeReconectarPorEvento() || !aguardandoFoco) return;
    aguardandoFoco = false;
    conectar();
  };

  const fecharPorOculta = () => {
    timerOculta = null;
    if (!podeReconectarPorEvento()) return;
    abortarAtual();
    timerReconexao = limpar(timerReconexao);
    setStatus(STATUS_LEITOR.OCULTA);
  };

  const aoMudarVisibilidade = () => {
    if (typeof document === 'undefined') return;
    if (document.visibilityState === 'hidden') {
      timerOculta = limpar(timerOculta);
      timerOculta = setTimeout(fecharPorOculta, tempos.ocultaMs);
      return;
    }
    timerOculta = limpar(timerOculta);
    if (!podeReconectarPorEvento()) return;
    if (status === STATUS_LEITOR.OCULTA || aguardandoFoco) {
      aguardandoFoco = false;
      conectar();
    }
  };

  const aoFicarOnline = () => {
    if (!podeReconectarPorEvento() || aguardandoFoco) return;
    if (status === STATUS_LEITOR.OCULTA || status === STATUS_LEITOR.CONECTADO) return;
    tentativa = 0;
    conectar();
  };

  function iniciar() {
    if (!parado) return;
    parado = false;
    aguardandoFoco = false;
    if (typeof window !== 'undefined') {
      window.addEventListener('online', aoFicarOnline);
      window.addEventListener('focus', aoFocar);
    }
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', aoMudarVisibilidade);
      if (document.visibilityState === 'hidden') {
        timerOculta = setTimeout(fecharPorOculta, tempos.ocultaMs);
      }
    }
    conectar();
  }

  function parar() {
    if (parado) return;
    parado = true;
    abortarAtual();
    timerReconexao = limpar(timerReconexao);
    timerOculta = limpar(timerOculta);
    if (typeof window !== 'undefined') {
      window.removeEventListener('online', aoFicarOnline);
      window.removeEventListener('focus', aoFocar);
    }
    if (typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', aoMudarVisibilidade);
    }
    setStatus(STATUS_LEITOR.PARADO);
  }

  return {
    iniciar,
    parar,
    get status() {
      return status;
    },
    get ultimoId() {
      return ultimoId;
    },
  };
}
