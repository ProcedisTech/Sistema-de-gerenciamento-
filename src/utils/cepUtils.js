import { resolveApiUrl } from '../config/apiEnv.js';
import { authHeadersForFetch } from '../services/api.js';

const BRASIL_API_CEP = 'https://brasilapi.com.br/api/cep/v2';

/**
 * Apenas dígitos do CEP (máx. 8).
 * @param {string} value
 */
export function onlyDigitsCep(value) {
  return String(value ?? '').replace(/\D/g, '').slice(0, 8);
}

/** 8 dígitos ou `null` para o body da API. */
export function normalizeCepForApi(value) {
  const d = onlyDigitsCep(value);
  return d.length === 8 ? d : null;
}

/**
 * Máscara 99999-999 (Brasil).
 * @param {string} value
 */
export function maskCep(value) {
  const d = onlyDigitsCep(value);
  if (d.length <= 5) return d;
  return `${d.slice(0, 5)}-${d.slice(5)}`;
}

function makeNetworkError(message) {
  const err = new Error(message);
  err.kind = 'network';
  return err;
}

function linkAbortSignals(external, internal) {
  if (!external) return () => {};
  if (external.aborted) {
    internal.abort();
    return () => {};
  }
  const onAbort = () => internal.abort();
  external.addEventListener('abort', onAbort, { once: true });
  return () => external.removeEventListener('abort', onAbort);
}

/**
 * @param {string} cep8 — exatamente 8 dígitos (sem máscara)
 * @param {object} [opts]
 * @param {AbortSignal} [opts.signal]
 * @returns {Promise<{ rua: string, bairro: string, cidade: string, estado: string } | null>}
 *   `null` se CEP não encontrado (404). Lança com `error.kind === 'network'` em falha de rede/timeout.
 */
export async function fetchAddressByCep(cep8, { signal: externalSignal } = {}) {
  const digits = onlyDigitsCep(cep8);
  if (digits.length !== 8) return null;

  const timeoutController = new AbortController();
  const timeoutId = setTimeout(() => timeoutController.abort(), 5000);

  const linked = externalSignal ? linkAbortSignals(externalSignal, timeoutController) : () => {};

  try {
    const res = await fetch(`${BRASIL_API_CEP}/${digits}`, {
      signal: timeoutController.signal,
    });

    if (res.status === 404) return null;
    if (!res.ok) {
      throw makeNetworkError(`CEP lookup HTTP ${res.status}`);
    }

    /** @type {{ street?: string, neighborhood?: string, city?: string, state?: string }} */
    const data = await res.json();

    return {
      rua: typeof data.street === 'string' ? data.street.trim() : '',
      bairro: typeof data.neighborhood === 'string' ? data.neighborhood.trim() : '',
      cidade: typeof data.city === 'string' ? data.city.trim() : '',
      estado: typeof data.state === 'string' ? data.state.trim().toUpperCase().slice(0, 2) : '',
    };
  } catch (e) {
    if (e?.kind === 'network') throw e;
    if (e?.name === 'AbortError') {
      if (externalSignal?.aborted) {
        const err = new Error('Aborted');
        err.name = 'AbortError';
        throw err;
      }
      throw makeNetworkError('CEP lookup tempo esgotado');
    }
    throw makeNetworkError(e?.message || 'Falha ao consultar CEP');
  } finally {
    clearTimeout(timeoutId);
    linked();
  }
}

/**
 * ViaCEP via backend Procedi — mesmo shape que {@link fetchAddressByCep} (BrasilAPI).
 * @param {string} cep8
 * @param {{ signal?: AbortSignal }} [opts]
 * @returns {Promise<{ rua: string, bairro: string, cidade: string, estado: string, complemento?: string } | null>}
 */
export async function fetchAddressByCepBackend(cep8, { signal: externalSignal } = {}) {
  const digits = onlyDigitsCep(cep8);
  if (digits.length !== 8) return null;

  const timeoutController = new AbortController();
  const timeoutId = setTimeout(() => timeoutController.abort(), 5000);

  const linked = externalSignal ? linkAbortSignals(externalSignal, timeoutController) : () => {};

  try {
    const res = await fetch(resolveApiUrl(`/api/viacep/${digits}`), {
      signal: timeoutController.signal,
      credentials: 'include',
      headers: {
        ...(await authHeadersForFetch({ needsOrg: false })),
      },
    });

    if (res.status === 404) return null;
    if (res.status === 502 || res.status === 503 || res.status === 504) {
      throw makeNetworkError(`CEP lookup HTTP ${res.status}`);
    }
    if (!res.ok) {
      throw makeNetworkError(`CEP lookup HTTP ${res.status}`);
    }

    /** @type {{ logradouro?: string, complemento?: string, bairro?: string, cidade?: string, estado?: string }} */
    const data = await res.json().catch(() => ({}));
    const comp = typeof data.complemento === 'string' ? data.complemento.trim() : '';

    return {
      rua: typeof data.logradouro === 'string' ? data.logradouro.trim() : '',
      bairro: typeof data.bairro === 'string' ? data.bairro.trim() : '',
      cidade: typeof data.cidade === 'string' ? data.cidade.trim() : '',
      estado: typeof data.estado === 'string' ? data.estado.trim().toUpperCase().slice(0, 2) : '',
      ...(comp ? { complemento: comp } : {}),
    };
  } catch (e) {
    if (e?.kind === 'network') throw e;
    if (e?.name === 'AbortError') {
      if (externalSignal?.aborted) {
        const err = new Error('Aborted');
        err.name = 'AbortError';
        throw err;
      }
      throw makeNetworkError('CEP lookup tempo esgotado');
    }
    throw makeNetworkError(e?.message || 'Falha ao consultar CEP');
  } finally {
    clearTimeout(timeoutId);
    linked();
  }
}
