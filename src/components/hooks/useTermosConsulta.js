import { useCallback, useEffect, useLayoutEffect, useRef } from 'react';

/**
 * Ordem de efeitos (defeito corrigido): no mesmo commit o React roda os `useEffect` dos FILHOS antes dos do PAI.
 * Este hook vive no pai (AppRefactored) e o filho (Step4LGPD) chama `gravarEstadoTermos()` num efeito disparado por
 * `gravarTick`, no mesmo commit em que `setTermoSelecionadoId/setTermoLido` mudaram. Se os refs
 * (`jsRef/baseRef/salvarRef`) fossem atualizados num `useEffect` do pai, o efeito do filho leria o journeyState
 * velho, não veria diferença e não gravaria (nenhum PUT). `useLayoutEffect` roda antes de qualquer `useEffect` do
 * commit, então os refs já estão atualizados quando o filho lê.
 */

/**
 * Termos da consulta (Onda E): ponte fina entre `termosDaConsulta` (detalhe do servidor, via
 * `useAtendimentoServidor`) e o journeyState (`termoSelecionadoId`, `termoLido`, `termosPendentesIds`).
 *
 * Assinatura exata:
 *   useTermosConsulta({ termosDaConsulta, salvarTermosConsulta, journeyState }) -> { gravarEstadoTermos }
 *
 *   - termosDaConsulta: `[{ termoId, ordem, lido, lidoEm, escolhido, termoAssinaturaId, statusAssinatura }]`
 *   - salvarTermosConsulta({ termoSelecionadoId, termoLido, termosPendentesIds }) -> boolean
 *   - journeyState: o objeto do `useJourneyState` (lê os 3 valores; escreve por `setTermoSelecionadoId`,
 *     `setTermoLido` e `setTermosPendentesIds`).
 *   - gravarEstadoTermos(): lê o journeyState e chama `salvarTermosConsulta` SÓ se difere da base
 *     (`termosDaConsulta`). Devolve `true` se chamou. Lista final do servidor = pendentes + selecionado, então a
 *     comparação é por conjunto; `termoLido` só conta quando a base ainda não tem o escolhido como lido (o
 *     servidor nunca desmarca).
 *
 * Restauração (outra aba, reentrada): quando `termosDaConsulta` muda para um valor diferente do último aplicado,
 * o journeyState recebe `termoSelecionadoId` (linha `escolhido`, ou `null`), `termoLido` (a linha escolhida tem
 * `lido`) e `termosPendentesIds` (todos os `termoId`). Não dispara PUT. Sem eco: guarda a assinatura do último
 * valor aplicado ou gravado, e a base otimista que o próprio `gravarEstadoTermos` produz é ignorada.
 */

const idStr = (v) => (v == null ? null : String(v));

/** Estado derivado da base: escolhido, lido e conjunto (ordenado) dos termos. */
function derivar(termos) {
  const lista = Array.isArray(termos) ? termos : [];
  const escolhida = lista.find((t) => t?.escolhido) ?? null;
  return {
    selecionado: idStr(escolhida?.termoId),
    lido: Boolean(escolhida?.lido),
    ids: lista.map((t) => idStr(t?.termoId)).filter((x) => x != null),
  };
}

function assinatura({ selecionado, lido, ids }) {
  return JSON.stringify([selecionado ?? null, Boolean(lido), [...new Set(ids)].sort()]);
}

export function useTermosConsulta({ termosDaConsulta, salvarTermosConsulta, journeyState }) {
  const jsRef = useRef(journeyState);
  const baseRef = useRef(termosDaConsulta);
  const salvarRef = useRef(salvarTermosConsulta);
  // Sempre os da última renderização confirmada (declarado antes do efeito de restauração, que os lê).
  // useLayoutEffect, NÃO useEffect: ver nota "Ordem de efeitos" no topo do arquivo.
  useLayoutEffect(() => {
    jsRef.current = journeyState;
    baseRef.current = termosDaConsulta;
    salvarRef.current = salvarTermosConsulta;
  });
  /** Assinatura do último estado aplicado no journeyState ou gravado dele (o valor inicial `[]` conta como aplicado). */
  const ultimoRef = useRef(assinatura(derivar(termosDaConsulta)));

  useEffect(() => {
    const d = derivar(termosDaConsulta);
    const sig = assinatura(d);
    if (sig === ultimoRef.current) return;
    ultimoRef.current = sig;
    const js = jsRef.current;
    js?.setTermoSelecionadoId?.(d.selecionado);
    js?.setTermoLido?.(d.lido);
    js?.setTermosPendentesIds?.(d.ids);
  }, [termosDaConsulta]);

  const gravarEstadoTermos = useCallback(() => {
    const js = jsRef.current;
    if (!js || typeof salvarRef.current !== 'function') return false;
    const selecionado = idStr(js.termoSelecionadoId);
    const lido = Boolean(js.termoLido);
    const pendentes = (Array.isArray(js.termosPendentesIds) ? js.termosPendentesIds : [])
      .map(idStr)
      .filter((x) => x != null);
    const ids = [...new Set([...pendentes, ...(selecionado != null ? [selecionado] : [])])];
    const base = derivar(baseRef.current);
    const mesmoConjunto = ids.length === base.ids.length && ids.every((id) => base.ids.includes(id));
    const mudou = selecionado !== base.selecionado
      || !mesmoConjunto
      || (lido && selecionado != null && !base.lido);
    if (!mudou) return false;
    // O que sai agora vira a base otimista: a restauração que esse valor causar não reescreve a tela.
    ultimoRef.current = assinatura({ selecionado, lido: lido || (selecionado === base.selecionado && base.lido), ids });
    salvarRef.current({
      termoSelecionadoId: js.termoSelecionadoId ?? null,
      termoLido: lido,
      termosPendentesIds: ids,
    });
    return true;
  }, []);

  return { gravarEstadoTermos };
}

export default useTermosConsulta;
