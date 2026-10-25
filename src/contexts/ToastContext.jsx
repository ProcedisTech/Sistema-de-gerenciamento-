import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, BellRing, CheckCircle2, Info, X, XCircle } from 'lucide-react';
import { ToastContext } from './toastContext.js';

const MAX_TOASTS = 5;

const VARIANT_STYLES = {
  success: {
    bar: 'bg-[#00a88e]',
    iconWrap: 'bg-[#e6f7f5] text-[#00a88e]',
    Icon: CheckCircle2,
  },
  error: {
    bar: 'bg-rose-500',
    iconWrap: 'bg-rose-50 text-rose-600',
    Icon: XCircle,
  },
  warning: {
    bar: 'bg-amber-500',
    iconWrap: 'bg-amber-50 text-amber-700',
    Icon: AlertTriangle,
  },
  info: {
    bar: 'bg-slate-500',
    iconWrap: 'bg-slate-100 text-slate-600',
    Icon: Info,
  },
};

const TOAST_ROOT_ID = 'procedi-toast-root';

function getToastMountNode() {
  if (typeof document === 'undefined') return null;
  return document.getElementById(TOAST_ROOT_ID) || document.body;
}

function ToastUrgente({ id, message, titulo, acao, onDismiss }) {
  return (
    <div
      role="status"
      aria-live="assertive"
      className="pointer-events-auto flex w-[400px] max-w-[calc(100vw-2rem)] items-start gap-3 rounded-xl border border-l-4 border-[#e2e8f0] border-l-rose-500 bg-white p-4 shadow-2xl toast-pop-in"
    >
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-rose-50 text-rose-600">
        <BellRing className="h-5 w-5" aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        {titulo ? <p className="text-[12px] font-bold uppercase tracking-wide text-rose-600">{titulo}</p> : null}
        <p className="text-[14px] font-medium leading-snug text-[#0f172a]">{message}</p>
        {acao ? (
          <button
            type="button"
            onClick={() => {
              acao.onClick?.();
              onDismiss(id);
            }}
            className="mt-2 inline-flex min-h-[36px] items-center rounded-lg bg-[#00a88e] px-3 text-[13px] font-semibold text-white hover:bg-[#00967f]"
          >
            {acao.label}
          </button>
        ) : null}
      </div>
      <button
        type="button"
        onClick={() => onDismiss(id)}
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[#94a3b8] hover:bg-slate-100"
        aria-label="Fechar notificação"
      >
        <X className="h-4 w-4" strokeWidth={2} />
      </button>
    </div>
  );
}

function ToastItem({ id, message, variant, titulo, acao, onDismiss }) {
  if (variant === 'urgent') {
    return <ToastUrgente id={id} message={message} titulo={titulo} acao={acao} onDismiss={onDismiss} />;
  }
  const cfg = VARIANT_STYLES[variant] || VARIANT_STYLES.info;
  const Icon = cfg.Icon;
  const isError = variant === 'error';

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        width: isError ? 'min(calc(100vw - 2rem), 28rem)' : 'min(calc(100vw - 2rem), 22rem)',
      }}
      className={`pointer-events-auto flex max-w-md items-stretch overflow-hidden rounded-xl bg-white shadow-[0_8px_30px_rgba(15,23,42,0.12)] toast-pop-in ${
        isError ? 'border border-rose-400' : 'border border-slate-200/90'
      }`}
    >
      <div className={`w-1 shrink-0 ${cfg.bar}`} aria-hidden />
      <div
        className={`flex min-w-0 flex-1 items-start gap-3 pr-2 ${isError ? 'py-4 pl-4 gap-4' : 'py-3 pl-3 gap-3'}`}
      >
        <div
          className={`mt-0.5 flex shrink-0 items-center justify-center rounded-lg ${cfg.iconWrap} ${
            isError ? 'h-10 w-10' : 'h-8 w-8'
          }`}
        >
          <Icon className={isError ? 'h-5 w-5' : 'h-4 w-4'} strokeWidth={2.25} aria-hidden />
        </div>
        <p
          className={`min-w-0 flex-1 font-medium leading-snug text-slate-700 ${
            isError ? 'pt-1.5 text-base' : 'pt-1 text-[13px]'
          }`}
        >
          {message}
        </p>
        <button
          type="button"
          onClick={() => onDismiss(id)}
          className="shrink-0 rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
          aria-label="Fechar notificação"
        >
          <X className="h-4 w-4" strokeWidth={2} />
        </button>
      </div>
    </div>
  );
}

function ToastStack({ toasts, onDismiss }) {
  if (typeof document === 'undefined') return null;
  const mount = getToastMountNode();
  if (!mount) return null;

  return createPortal(
    <>
      {toasts.map((t) => (
        <ToastItem key={t.id} id={t.id} message={t.message} variant={t.variant} titulo={t.titulo} acao={t.acao} onDismiss={onDismiss} />
      ))}
    </>,
    mount
  );
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const idRef = useRef(0);
  const timersRef = useRef(new Map());

  const dismiss = useCallback((id) => {
    const t = timersRef.current.get(id);
    if (t) clearTimeout(t);
    timersRef.current.delete(id);
    setToasts((prev) => prev.filter((x) => x.id !== id));
  }, []);

  useEffect(() => {
    const timers = timersRef.current;
    return () => {
      timers.forEach((tid) => clearTimeout(tid));
      timers.clear();
    };
  }, []);

  const push = useCallback(
    (message, variant = 'info', opts = {}) => {
      const text = String(message || '').trim() || '—';
      const id = ++idRef.current;
      const ms = variant === 'urgent' ? 12000 : variant === 'error' ? 6500 : 4800;

      setToasts((prev) => {
        const next = [...prev, { id, message: text, variant, titulo: opts.titulo, acao: opts.acao }];
        return next.slice(-MAX_TOASTS);
      });

      const tid = setTimeout(() => dismiss(id), ms);
      timersRef.current.set(id, tid);
      return id;
    },
    [dismiss]
  );

  const value = useMemo(
    () => ({
      toast: push,
      success: (m) => push(m, 'success'),
      error: (m) => push(m, 'error'),
      warning: (m) => push(m, 'warning'),
      info: (m) => push(m, 'info'),
      urgente: (m, opts) => push(m, 'urgent', opts),
      dismiss,
    }),
    [push, dismiss]
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastStack toasts={toasts} onDismiss={dismiss} />
    </ToastContext.Provider>
  );
}
