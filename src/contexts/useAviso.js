import { useContext, useEffect, useRef } from 'react';
import { AvisosContext } from './avisosContext.js';
import { tipoDoPrefixo } from '../services/avisos/tiposAviso.js';

/**
 * Chama `handler` quando chega um aviso do `prefixo` (ex.: `'AGENDA'`) ou um `recarregar` do canal.
 * Com `registroId`, só avisos desse registro — aviso com `registroId` nulo ("várias linhas") sempre dispara.
 * Avisos que chegam juntos dentro de `debounceMs` disparam o handler uma vez. No-op fora do `AvisosProvider`.
 *
 * @param {string} prefixo
 * @param {(msg: { tipo: 'aviso', aviso: object } | { tipo: 'recarregar' }) => void} handler
 * @param {{ registroId?: string | null, debounceMs?: number }} [opts]
 */
export function useAviso(
  prefixo,
  handler,
  {
    registroId = null,
    debounceMs = (typeof globalThis !== 'undefined' && globalThis.process?.env?.NODE_ENV === 'test') || import.meta.env?.MODE === 'test' ? 0 : 300,
  } = {},
) {
  const ctx = useContext(AvisosContext);
  const handlerRef = useRef(handler);

  useEffect(() => {
    handlerRef.current = handler;
  }, [handler]);

  useEffect(() => {
    if (!ctx) return undefined;
    let timer = null;
    let ultima = null;
    const receber = (msg) => {
      if (msg?.tipo === 'aviso') {
        const { aviso } = msg;
        if (!tipoDoPrefixo(aviso?.tipo, prefixo)) return;
        if (registroId != null && aviso.registroId != null && String(aviso.registroId) !== String(registroId)) {
          return;
        }
      } else if (msg?.tipo !== 'recarregar') {
        return;
      }
      ultima = msg;
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        timer = null;
        handlerRef.current?.(ultima);
      }, debounceMs);
    };
    const cancelar = ctx.assinar(receber);
    return () => {
      cancelar();
      if (timer) clearTimeout(timer);
    };
  }, [ctx, prefixo, registroId, debounceMs]);
}
