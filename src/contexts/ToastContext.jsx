import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from 'lucide-react';
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

function ToastItem({ id, message, variant, onDismiss }) {
  const cfg = VARIANT_STYLES[variant] || VARIANT_STYLES.info;
  const Icon = cfg.Icon;

  return (
    <div
      role="status"
      aria-live="polite"
      style={{ width: 'min(calc(100vw - 2rem), 22rem)' }}
      className="pointer-events-auto flex items-stretch overflow-hidden rounded-xl border border-slate-200/90 bg-white shadow-[0_8px_30px_rgba(15,23,42,0.12)] toast-pop-in"
    >
      <div className={`w-1 shrink-0 ${cfg.bar}`} aria-hidden />
      <div className="flex min-w-0 flex-1 items-start gap-3 py-3 pl-3 pr-2">
        <div className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${cfg.iconWrap}`}>
          <Icon className="h-4 w-4" strokeWidth={2.25} aria-hidden />
        </div>
        <p className="min-w-0 flex-1 pt-1 text-[13px] font-medium leading-snug text-slate-700">{message}</p>
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
        <ToastItem key={t.id} id={t.id} message={t.message} variant={t.variant} onDismiss={onDismiss} />
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
    (message, variant = 'info') => {
      const text = String(message || '').trim() || '—';
      const id = ++idRef.current;
      const ms = variant === 'error' ? 6500 : 4800;

      setToasts((prev) => {
        const next = [...prev, { id, message: text, variant }];
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
