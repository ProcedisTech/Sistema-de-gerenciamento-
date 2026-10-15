import { useCallback, useEffect, useState } from 'react';
import { ufApi } from '../../services/api.js';

/** @typedef {{ sigla: string, nome: string, fusoIana: string }} Uf */

/** @type {Uf[] | null} */
let ufsCache = null;
/** @type {Promise<Uf[]> | null} */
let ufsPromise = null;

function normalizarUfs(raw) {
  if (!Array.isArray(raw)) throw new Error('Resposta de UFs inválida');
  return raw
    .filter((u) => u && typeof u.sigla === 'string' && u.sigla.length === 2)
    .map((u) => ({ sigla: u.sigla, nome: String(u.nome ?? u.sigla), fusoIana: String(u.fusoIana ?? '') }));
}

function carregarUfs() {
  if (ufsCache) return Promise.resolve(ufsCache);
  if (!ufsPromise) {
    ufsPromise = Promise.resolve()
      .then(() => ufApi.listar())
      .then((raw) => {
        ufsCache = normalizarUfs(raw);
        return ufsCache;
      })
      .finally(() => {
        ufsPromise = null;
      });
  }
  return ufsPromise;
}

/** Só para testes: esquece a lista carregada. */
export function limparCacheUfs() {
  ufsCache = null;
  ufsPromise = null;
}

/**
 * Lista de UFs ativas (GET /api/v1/ufs), carregada uma vez por sessão e guardada em memória.
 * Falha não fica no cache: `recarregar` tenta de novo.
 *
 * @returns {{ ufs: Uf[], status: 'loading' | 'success' | 'error', recarregar: () => void }}
 */
export function useUfs() {
  const [ufs, setUfs] = useState(() => ufsCache ?? []);
  const [status, setStatus] = useState(() => (ufsCache ? 'success' : 'loading'));
  const [tentativa, setTentativa] = useState(0);

  useEffect(() => {
    let cancelado = false;
    carregarUfs().then(
      (lista) => {
        if (cancelado) return;
        setUfs(lista);
        setStatus('success');
      },
      () => {
        if (cancelado) return;
        setStatus('error');
      }
    );
    return () => {
      cancelado = true;
    };
  }, [tentativa]);

  const recarregar = useCallback(() => {
    setStatus('loading');
    setTentativa((n) => n + 1);
  }, []);

  return { ufs, status, recarregar };
}
