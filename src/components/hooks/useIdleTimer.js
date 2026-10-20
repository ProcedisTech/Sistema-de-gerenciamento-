import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ACTIVITY_THROTTLE_MS,
  SESSION_STORAGE_KEY,
} from '../../config/sessionTimeout';

/** Enquanto a inatividade estiver vencida (e o timer ativo), reenvia `onTimeout` a cada 5 s. */
export const REENVIO_TIMEOUT_MS = 5000;

/**
 * Hook genérico de inatividade.
 *
 * @param {{
 *   enabled: boolean,
 *   timeoutMs: number,
 *   warningBeforeMs: number,
 *   onWarning: () => void,
 *   onTimeout: () => void,
 * }} opts
 * @returns {{ resetTimer: () => void, isWarning: boolean, deadlineTs: number }}
 */
export function useIdleTimer({ enabled, timeoutMs, warningBeforeMs, onWarning, onTimeout }) {
  const [isWarning, setIsWarning] = useState(false);
  const [deadlineTs, setDeadlineTs] = useState(0);

  const isWarningRef = useRef(false);
  const warnedRef = useRef(false);
  /** Instante do último `onTimeout` enviado (null = nenhum desde a última atividade/religada). */
  const ultimoTimeoutRef = useRef(null);
  const lastStampRef = useRef(0);
  const intervalRef = useRef(null);

  const onWarningRef = useRef(onWarning);
  const onTimeoutRef = useRef(onTimeout);
  useEffect(() => { onWarningRef.current = onWarning; }, [onWarning]);
  useEffect(() => { onTimeoutRef.current = onTimeout; }, [onTimeout]);

  const timeoutMsRef = useRef(timeoutMs);
  const warningBeforeMsRef = useRef(warningBeforeMs);
  useEffect(() => { timeoutMsRef.current = timeoutMs; }, [timeoutMs]);
  useEffect(() => { warningBeforeMsRef.current = warningBeforeMs; }, [warningBeforeMs]);

  const stampActivity = useCallback((force = false) => {
    if (!force && isWarningRef.current) return;
    const now = Date.now();
    if (!force && now - lastStampRef.current < ACTIVITY_THROTTLE_MS) return;
    lastStampRef.current = now;
    try {
      sessionStorage.setItem(SESSION_STORAGE_KEY, String(now));
    } catch { /* ignore */ }
  }, []);

  const tick = useCallback(() => {
    const raw = sessionStorage.getItem(SESSION_STORAGE_KEY);
    if (raw == null) return;
    const lastActivity = Number(raw);
    const elapsed = Date.now() - lastActivity;
    const tMs = timeoutMsRef.current;
    const wMs = warningBeforeMsRef.current;

    if (elapsed >= tMs) {
      const agora = Date.now();
      if (ultimoTimeoutRef.current == null || agora - ultimoTimeoutRef.current >= REENVIO_TIMEOUT_MS) {
        ultimoTimeoutRef.current = agora;
        onTimeoutRef.current();
      }
      return;
    }

    if (elapsed >= tMs - wMs) {
      if (!warnedRef.current) {
        warnedRef.current = true;
        isWarningRef.current = true;
        setIsWarning(true);
        setDeadlineTs(lastActivity + tMs);
        onWarningRef.current();
      }
    } else {
      if (warnedRef.current) {
        warnedRef.current = false;
        ultimoTimeoutRef.current = null;
        isWarningRef.current = false;
        setIsWarning(false);
      }
    }
  }, []);

  const resetTimer = useCallback(() => {
    stampActivity(true);
    warnedRef.current = false;
    ultimoTimeoutRef.current = null;
    isWarningRef.current = false;
    setIsWarning(false);
    const now = Date.now();
    setDeadlineTs(now + timeoutMsRef.current);
  }, [stampActivity]);

  useEffect(() => {
    if (!enabled) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    // Religou (ex.: novo login): zera o estado da rodada anterior. Sem isso, depois de vencer sem aviso
    // a inatividade não disparava mais.
    ultimoTimeoutRef.current = null;
    lastStampRef.current = 0;

    // Semeadura: gravar carimbo SE nao existir (preserva no F5).
    if (!sessionStorage.getItem(SESSION_STORAGE_KEY)) {
      stampActivity(true);
    }

    const PASSIVE = { passive: true };
    const handler = () => stampActivity();

    window.addEventListener('mousemove', handler);
    window.addEventListener('mousedown', handler);
    window.addEventListener('keydown', handler);
    window.addEventListener('touchstart', handler, PASSIVE);
    window.addEventListener('scroll', handler, PASSIVE);
    window.addEventListener('wheel', handler, PASSIVE);

    const onVisibility = () => {
      if (document.visibilityState === 'visible') tick();
    };
    document.addEventListener('visibilitychange', onVisibility);

    intervalRef.current = setInterval(tick, 1000);

    return () => {
      window.removeEventListener('mousemove', handler);
      window.removeEventListener('mousedown', handler);
      window.removeEventListener('keydown', handler);
      window.removeEventListener('touchstart', handler);
      window.removeEventListener('scroll', handler);
      window.removeEventListener('wheel', handler);
      document.removeEventListener('visibilitychange', onVisibility);
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [enabled, stampActivity, tick]);

  return { resetTimer, isWarning, deadlineTs };
}
