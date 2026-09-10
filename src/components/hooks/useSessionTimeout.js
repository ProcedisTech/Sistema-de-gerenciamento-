import { useCallback, useEffect, useRef } from 'react';
import {
  SESSION_TIMEOUT_MS,
  SESSION_WARNING_BEFORE_MS,
} from '../../config/sessionTimeout';
import { useIdleTimer } from './useIdleTimer';

/**
 * Cola entre useIdleTimer e o contexto da app.
 * Pausa o timer durante atendimento; dispara auth:expired com scope local.
 */
export function useSessionTimeout({ isLoggedIn, activeView, consultaModule }) {
  const isInAttendance = activeView === 'consulta' || consultaModule !== null;
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
