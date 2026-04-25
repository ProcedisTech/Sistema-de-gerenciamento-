import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Loader2, RefreshCw, ServerCrash, WifiOff } from 'lucide-react';
import {
  getBackendRetryIntervalMs,
  pingBackendOnce,
  shouldSkipBackendCheck,
} from '../../utils/backendHealth.js';
import { getApiBaseUrl } from '../../config/apiEnv.js';

function BackendWaitScreen({ variant, onManualRetry }) {
  const apiBase = getApiBaseUrl();
  const showApiHint = Boolean(apiBase);

  if (variant === 'checking') {
    return (
      <div className="backend-gate-bg flex min-h-screen flex-col items-center justify-center px-5 py-10">
        <div className="backend-gate-card w-full max-w-lg rounded-[22px] border border-app-border bg-white p-8 shadow-xl shadow-app-card">
          <div className="backend-gate-pulse-ring mx-auto mb-6 flex h-24 w-24 items-center justify-center rounded-full bg-[#e6f7f5]">
            <Loader2 className="h-11 w-11 animate-spin text-[#00a88e]" strokeWidth={2.25} aria-hidden />
          </div>
          <h1 className="text-center text-[20px] font-bold leading-snug text-[#0f172a] sm:text-[22px]">
            Conectando ao servidor
          </h1>
          <p className="mt-3 text-center text-[14px] leading-relaxed text-[#64748b]">
            Verificando se a API está disponível. Se o backend acabou de ser implantado (por exemplo no
            Render), o primeiro acesso pode levar{' '}
            <span className="font-semibold text-[#0f766e]">até um ou dois minutos</span> enquanto o
            serviço inicia — não feche esta página.
          </p>
          {showApiHint && (
            <p className="mt-4 rounded-xl border border-[#e2e8f0] bg-[#f8fafc] px-3 py-2 text-center font-mono text-[11px] text-[#475569] break-all">
              {apiBase}
            </p>
          )}
        </div>
      </div>
    );
  }

  const isSlow = variant === 'offlineSlow';
  const Icon = isSlow ? ServerCrash : WifiOff;

  return (
    <div className="backend-gate-bg flex min-h-screen flex-col items-center justify-center px-5 py-10">
      <div className="backend-gate-card w-full max-w-lg rounded-[22px] border border-amber-200/90 bg-white p-8 shadow-xl shadow-amber-100/80">
        <div
          className={`mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-2xl ${
            isSlow ? 'bg-amber-50' : 'bg-red-50'
          }`}
        >
          <Icon
            className={`h-10 w-10 ${isSlow ? 'text-amber-600' : 'text-red-600'}`}
            strokeWidth={2}
            aria-hidden
          />
        </div>
        <h1 className="text-center text-[19px] font-bold leading-snug text-[#0f172a] sm:text-[21px]">
          {isSlow ? 'Servidor demorando a responder' : 'Não foi possível alcançar o servidor'}
        </h1>
        <p className="mt-3 text-center text-[14px] leading-relaxed text-[#64748b]">
          {isSlow
            ? 'Isso costuma acontecer quando a hospedagem do backend estava inativa e está “acordando”. Aguarde: novas tentativas são feitas automaticamente.'
            : 'Confira sua conexão com a internet, se o endereço da API no deploy está correto (variável VITE_API_BASE_URL no Netlify) e se o backend está publicado.'}
        </p>
        {showApiHint && (
          <p className="mt-4 rounded-xl border border-[#e2e8f0] bg-[#f8fafc] px-3 py-2 text-center font-mono text-[11px] text-[#475569] break-all">
            {apiBase}
          </p>
        )}
        <p className="mt-4 text-center text-[12px] text-[#94a3b8]">
          Próxima tentativa automática em alguns segundos. Você também pode tentar agora.
        </p>
        <button
          type="button"
          onClick={onManualRetry}
          disabled={variant === 'checking'}
          className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl border-[2px] border-[#00a88e] bg-[#00a88e] px-4 py-3.5 text-[14px] font-bold text-white transition-colors hover:bg-[#00967f] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {variant === 'checking' ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
              Verificando…
            </>
          ) : (
            <>
              <RefreshCw className="h-5 w-5" aria-hidden />
              Tentar novamente
            </>
          )}
        </button>
      </div>
    </div>
  );
}

/**
 * Bloqueia o app até o backend responder. Essencial quando o front (Netlify) sobe antes do back (Render).
 */
export function BackendGate({ children }) {
  const skip = shouldSkipBackendCheck();
  const [connected, setConnected] = useState(skip);
  const [variant, setVariant] = useState('checking');
  const timeoutRef = useRef(null);
  const cancelledRef = useRef(false);
  const checkingRef = useRef(false);

  const clearSchedule = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  };

  const scheduleRetry = useCallback((run) => {
    clearSchedule();
    timeoutRef.current = setTimeout(run, getBackendRetryIntervalMs());
  }, []);

  const runAttempt = useCallback(async () => {
    if (skip || cancelledRef.current) return;
    checkingRef.current = true;
    setVariant('checking');
    const result = await pingBackendOnce();
    checkingRef.current = false;
    if (cancelledRef.current) return;
    if (result.ok) {
      clearSchedule();
      setConnected(true);
      return;
    }
    setConnected(false);
    setVariant(result.kind === 'timeout' ? 'offlineSlow' : 'offlineNet');
    scheduleRetry(() => {
      runAttempt();
    });
  }, [skip, scheduleRetry]);

  useEffect(() => {
    if (skip) {
      setConnected(true);
      return undefined;
    }
    cancelledRef.current = false;
    setConnected(false);
    runAttempt();
    return () => {
      cancelledRef.current = true;
      clearSchedule();
    };
  }, [skip, runAttempt]);

  const handleManualRetry = () => {
    if (skip || checkingRef.current) return;
    clearSchedule();
    runAttempt();
  };

  if (connected) {
    return children;
  }

  return <BackendWaitScreen variant={variant} onManualRetry={handleManualRetry} />;
}
