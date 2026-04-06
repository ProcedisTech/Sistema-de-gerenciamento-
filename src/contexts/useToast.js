import { useContext } from 'react';
import { ToastContext } from './toastContext.js';

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    if (import.meta.env.DEV) {
      console.warn(
        '[Procedi] useToast foi chamado fora de ToastProvider — notificações não serão exibidas. Verifique AppRoot / main.jsx.'
      );
    }
    const noop = () => {};
    return {
      toast: noop,
      success: noop,
      error: noop,
      warning: noop,
      info: noop,
      dismiss: noop,
    };
  }
  return ctx;
}
