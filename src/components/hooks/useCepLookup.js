import { useCallback, useRef, useState } from 'react';
import { fetchAddressByCepBackend, onlyDigitsCep } from '../../utils/cepUtils.js';

/** @type {Map<string, { rua: string, bairro: string, cidade: string, estado: string, complemento?: string } | null>} */
const cepSessionCache = new Map();

/**
 * Busca CEP no backend (/api/viacep) com cache em sessão, cancelamento por chamada e estado de UI.
 *
 * `status`: `idle` | `loading` | `success` | `not_found` | `error`
 *
 * Retorno de `lookup`:
 * - `{ ok: false }` — abortado (não aplicar preenchimento).
 * - `{ ok: true, skipped: true }` — CEP com menos de 8 dígitos (estado já em idle).
 * - `{ ok: true, data }` — `data` é o objeto de endereço ou `null` (404 / falha tratada como fallback).
 */
export function useCepLookup() {
  const [status, setStatus] = useState('idle');
  const [lastResult, setLastResult] = useState(null);
  const abortRef = useRef(null);
  const requestIdRef = useRef(0);

  const reset = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    requestIdRef.current += 1;
    setStatus('idle');
    setLastResult(null);
  }, []);

  const lookup = useCallback(async (cepRaw) => {
    const cep8 = onlyDigitsCep(cepRaw);
    if (cep8.length !== 8) {
      setStatus('idle');
      setLastResult(null);
      return { ok: true, skipped: true };
    }

    if (cepSessionCache.has(cep8)) {
      const cached = cepSessionCache.get(cep8);
      setLastResult(cached);
      setStatus(cached ? 'success' : 'not_found');
      return { ok: true, data: cached };
    }

    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    const myRequest = ++requestIdRef.current;

    setStatus('loading');
    setLastResult(null);

    try {
      const result = await fetchAddressByCepBackend(cep8, { signal: ac.signal });
      cepSessionCache.set(cep8, result);
      if (myRequest !== requestIdRef.current) return { ok: false };
      setLastResult(result);
      setStatus(result ? 'success' : 'not_found');
      return { ok: true, data: result };
    } catch (e) {
      if (e?.name === 'AbortError') return { ok: false };
      if (myRequest !== requestIdRef.current) return { ok: false };
      setLastResult(null);
      setStatus('error');
      return { ok: true, data: null, fetchFailed: true };
    }
  }, []);

  return { lookup, status, lastResult, reset };
}
