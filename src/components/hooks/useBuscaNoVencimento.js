import { useEffect, useRef } from 'react';

/** Acima de ~24,8 dias o `setTimeout` estoura e dispara na hora. */
export const LIMITE_AGENDAMENTO_MS = 24 * 24 * 60 * 60 * 1000;

/**
 * Chama `buscar` uma vez quando `expiraEm` chegar (um único `setTimeout`). Já vencido -> busca imediata.
 * Faltando mais de 24 dias, não agenda nada.
 *
 * @param {string | Date | null | undefined} expiraEm
 * @param {() => void} buscar
 */
export function useBuscaNoVencimento(expiraEm, buscar) {
  const buscarRef = useRef(buscar);

  useEffect(() => {
    buscarRef.current = buscar;
  }, [buscar]);

  const alvo = expiraEm ? new Date(expiraEm).getTime() : NaN;

  useEffect(() => {
    if (!Number.isFinite(alvo)) return undefined;
    const faltam = alvo - Date.now();
    if (faltam > LIMITE_AGENDAMENTO_MS) return undefined;
    const timer = setTimeout(() => buscarRef.current?.(), Math.max(0, faltam));
    return () => clearTimeout(timer);
  }, [alvo]);
}
