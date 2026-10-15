import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AvisosContext } from './avisosContext.js';
import { criarLeitorAvisos, STATUS_LEITOR } from '../services/avisos/canalAvisos.js';

export const DEGRADADO_INTERVALO_MS = 30_000;

/** Estados do leitor em que a aba está sem canal mas ainda pode rebuscar (bloqueado/oculta/parado não). */
const STATUS_DEGRADAVEIS = new Set([
  STATUS_LEITOR.CONECTANDO,
  STATUS_LEITOR.ERRO,
  STATUS_LEITOR.SUBSTITUIDA,
]);

const abaVisivel = () => typeof document === 'undefined' || document.visibilityState !== 'hidden';

/**
 * Um leitor do canal de avisos por aba. Troca de clínica fecha e reabre o leitor sem remontar os filhos.
 * Modo degradado (único timer de rede): sem canal por 30 s com a aba visível, emite `recarregar` a cada 30 s.
 *
 * Mensagens despachadas aos inscritos (`assinar`):
 * - `{ tipo: 'aviso', aviso }` — aviso do livro;
 * - `{ tipo: 'recarregar' }` — a cada `conectado` do leitor (todo, não só o primeiro), a cada `recarregar` do
 *   servidor e no modo degradado;
 * - `{ tipo: 'conectado', primeiro }` — a cada conexão do leitor (para redeclarar pendência etc.);
 * - `{ tipo: 'pendencia-liberada', atendimentoId }` — mensagem de controle efêmera do servidor.
 * `useAviso` só repassa `aviso`/`recarregar`; os outros tipos são para quem assina direto o contexto.
 */
export function AvisosProvider({
  orgId,
  ativo,
  children,
  criarLeitor = criarLeitorAvisos,
  degradadoMs = DEGRADADO_INTERVALO_MS,
}) {
  const inscritosRef = useRef(new Set());
  const [statusLeitor, setStatusLeitor] = useState(STATUS_LEITOR.PARADO);
  const [visivel, setVisivel] = useState(abaVisivel);

  const despachar = useCallback((msg) => {
    for (const receber of Array.from(inscritosRef.current)) {
      try {
        receber(msg);
      } catch {
        /* um inscrito com erro não derruba os outros */
      }
    }
  }, []);

  const recarregarTodos = useCallback(() => despachar({ tipo: 'recarregar' }), [despachar]);

  useEffect(() => {
    if (!ativo || !orgId) return undefined;
    const leitor = criarLeitor({
      orgId,
      // Toda conexão relê (a aba pode ter perdido avisos sem Last-Event-ID válido) e avisa quem assina.
      onConectado: ({ primeiro }) => {
        recarregarTodos();
        despachar({ tipo: 'conectado', primeiro: primeiro === true });
      },
      onAviso: (aviso) => despachar({ tipo: 'aviso', aviso }),
      onRecarregar: recarregarTodos,
      onPendenciaLiberada: ({ atendimentoId }) =>
        despachar({ tipo: 'pendencia-liberada', atendimentoId: atendimentoId ?? null }),
      onStatus: setStatusLeitor,
    });
    leitor.iniciar();
    return () => leitor.parar();
  }, [ativo, orgId, criarLeitor, despachar, recarregarTodos]);

  useEffect(() => {
    const aoMudar = () => setVisivel(abaVisivel());
    document.addEventListener('visibilitychange', aoMudar);
    return () => document.removeEventListener('visibilitychange', aoMudar);
  }, []);

  const degradavel = Boolean(ativo && orgId) && visivel && STATUS_DEGRADAVEIS.has(statusLeitor);

  useEffect(() => {
    if (!degradavel) return undefined;
    let intervalo = null;
    const inicio = setTimeout(() => {
      recarregarTodos();
      intervalo = setInterval(() => {
        if (abaVisivel()) recarregarTodos();
      }, degradadoMs);
    }, degradadoMs);
    return () => {
      clearTimeout(inicio);
      if (intervalo) clearInterval(intervalo);
    };
  }, [degradavel, degradadoMs, recarregarTodos]);

  const assinar = useCallback((receber) => {
    inscritosRef.current.add(receber);
    return () => {
      inscritosRef.current.delete(receber);
    };
  }, []);

  const value = useMemo(() => ({ assinar }), [assinar]);

  return <AvisosContext.Provider value={value}>{children}</AvisosContext.Provider>;
}
