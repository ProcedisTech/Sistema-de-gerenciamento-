import { useCallback, useEffect, useRef } from 'react';
import {
  SESSION_TIMEOUT_MS,
  SESSION_WARNING_BEFORE_MS,
  SESSION_STORAGE_KEY,
} from '../../config/sessionTimeout';
import { useIdleTimer } from './useIdleTimer';

/** Em atendimento, o carimbo de última atividade é renovado a cada 30 s (o relógio não corre na consulta). */
export const RENOVACAO_EM_ATENDIMENTO_MS = 30_000;

/**
 * Cola entre useIdleTimer e o contexto da app.
 * Pausa o timer só com a consulta na tela (activeView === 'consulta'); fora dela o relógio corre, mesmo com
 * consultaModule preenchido (saída pela Sidebar, consulta encerrada em outro aparelho). Dispara auth:expired
 * com scope local.
 */
export function useSessionTimeout({ isLoggedIn, activeView }) {
  const isInAttendance = activeView === 'consulta';
  const enabled = isLoggedIn && !isInAttendance;

  const onWarning = useCallback(() => {}, []);

  const onTimeout = useCallback(() => {
    window.dispatchEvent(
      new CustomEvent('auth:expired', { detail: { scope: 'local' } }),
    );
  }, []);

  const { resetTimer, isWarning, deadlineTs } = useIdleTimer({
    enabled,
    timeoutMs: SESSION_TIMEOUT_MS,
    warningBeforeMs: SESSION_WARNING_BEFORE_MS,
    onWarning,
    onTimeout,
  });

  // Transição atendimento → fora: renova carimbo (mas NÃO no mount/F5).
  const prevAttendanceRef = useRef(isInAttendance);
  const mountedRef = useRef(false);

  useEffect(() => {
    if (!mountedRef.current) {
      mountedRef.current = true;
      prevAttendanceRef.current = isInAttendance;
      return;
    }
    if (prevAttendanceRef.current && !isInAttendance && isLoggedIn) {
      resetTimer();
    }
    prevAttendanceRef.current = isInAttendance;
  }, [isInAttendance, isLoggedIn, resetTimer]);

  // Em atendimento o carimbo se mantém atual: assim o F5 (que abre fora da consulta) não encontra um carimbo
  // congelado na entrada. Aba oculta atrasa o intervalo; o visibilitychange e o pagehide (F5) cobrem.
  useEffect(() => {
    if (!isLoggedIn || !isInAttendance) return undefined;
    const renovar = () => {
      try {
        sessionStorage.setItem(SESSION_STORAGE_KEY, String(Date.now()));
      } catch { /* ignore */ }
    };
    renovar();
    const intervalo = setInterval(renovar, RENOVACAO_EM_ATENDIMENTO_MS);
    document.addEventListener('visibilitychange', renovar);
    window.addEventListener('pagehide', renovar);
    return () => {
      clearInterval(intervalo);
      document.removeEventListener('visibilitychange', renovar);
      window.removeEventListener('pagehide', renovar);
    };
  }, [isLoggedIn, isInAttendance]);

  const handleStay = useCallback(() => {
    resetTimer();
  }, [resetTimer]);

  const handleLogoutNow = useCallback(() => {
    window.dispatchEvent(
      new CustomEvent('auth:expired', { detail: { scope: 'local' } }),
    );
  }, []);

  return { showWarning: isWarning, deadlineTs, handleStay, handleLogoutNow };
}
