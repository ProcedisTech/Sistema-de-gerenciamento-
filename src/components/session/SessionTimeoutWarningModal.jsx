import { useEffect, useState } from 'react';

/**
 * Modal de aviso de inatividade.
 * O countdown de segundos vive aqui — o parent só passa o deadline (timestamp).
 * Montagem condicional no pai (showWarning && <Modal />) — sem prop `open`.
 */
export default function SessionTimeoutWarningModal({ deadlineTs, onStay, onLogout }) {
  const [remainingSeconds, setRemainingSeconds] = useState(
    () => Math.max(0, Math.ceil((deadlineTs - Date.now()) / 1000)),
  );

  useEffect(() => {
    const calc = () => Math.max(0, Math.ceil((deadlineTs - Date.now()) / 1000));
    const id = setInterval(() => setRemainingSeconds(calc()), 1000);
    return () => clearInterval(id);
  }, [deadlineTs]);

  return (
    <div
      className="fixed inset-0 z-[600] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="session-timeout-title"
      aria-describedby="session-timeout-desc"
    >
      <div className="w-full max-w-sm rounded-xl border border-[#e2e8f0] bg-white p-6 shadow-2xl">
        <h4
          id="session-timeout-title"
          className="text-[16px] font-bold text-[#0f172a]"
        >
          Sessão prestes a expirar
        </h4>

        <p
          id="session-timeout-desc"
          className="mt-3 text-[14px] font-medium leading-relaxed text-[#475569]"
        >
          Sua sessão será encerrada em{' '}
          <span className="tabular-nums font-bold text-[#0f172a]">{remainingSeconds}s</span>{' '}
          por inatividade.
        </p>

        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <button
            type="button"
            onClick={onLogout}
            className="h-10 rounded-lg border border-[#e2e8f0] bg-white px-4 text-[13px] font-semibold text-[#64748b] hover:bg-[#f8fafc]"
          >
            Sair agora
          </button>
          <button
            type="button"
            onClick={onStay}
            className="h-10 rounded-lg bg-[#14B8A6] px-4 text-[13px] font-semibold text-white hover:bg-[#0d9488]"
          >
            Continuar conectado
          </button>
        </div>
      </div>
    </div>
  );
}
