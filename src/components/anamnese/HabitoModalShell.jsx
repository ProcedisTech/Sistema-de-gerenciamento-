import React from 'react';
import { X } from 'lucide-react';

export const HABITO_INPUT_CLASS =
  'w-full px-4 py-3 bg-[#f8fbfb] border border-[#00a88e]/25 rounded-xl text-[14px] text-[#0f172a] font-medium focus:ring-4 outline-none focus:ring-[#00a88e]/15 transition-all focus:border-[#00a88e] appearance-none';

export const HABITO_READONLY_CLASS =
  'w-full px-4 py-3 bg-[#f1f5f9] border border-app-border rounded-xl text-[14px] font-medium text-[#475569]';

const PRIORIDADE_SEGMENTS = [
  {
    value: 'NORMAL',
    label: 'Normal',
    active: 'border-[#00a88e]/40 bg-[#e6f7f5] text-[#0f766e] shadow-sm',
  },
  {
    value: 'ALERTA',
    label: 'Alerta',
    active: 'border-amber-300 bg-amber-50 text-amber-800 shadow-sm',
  },
  {
    value: 'CRITICA',
    label: 'Crítica',
    active: 'border-red-300 bg-red-50 text-red-700 shadow-sm',
  },
];

const SEGMENT_INACTIVE =
  'border-slate-200 bg-white text-slate-600 hover:border-slate-300';

export function PrioridadeSegmented({ value, onChange }) {
  return (
    <div className="grid grid-cols-3 gap-2" role="group" aria-label="Prioridade">
      {PRIORIDADE_SEGMENTS.map((seg) => {
        const active = value === seg.value;
        return (
          <button
            key={seg.value}
            type="button"
            onClick={() => onChange(seg.value)}
            aria-pressed={active}
            className={`rounded-xl border px-3 py-2.5 text-[13px] font-bold transition ${
              active ? seg.active : SEGMENT_INACTIVE
            }`}
          >
            {seg.label}
          </button>
        );
      })}
    </div>
  );
}

/**
 * @param {{
 *   title: string,
 *   subtitle?: string | null,
 *   icon: React.ComponentType<{ className?: string, strokeWidth?: number }>,
 *   onClose: () => void,
 *   footer: React.ReactNode,
 *   children: React.ReactNode,
 * }} props
 */
export function HabitoModalShell({ title, subtitle, icon, onClose, footer, children }) {
  const Icon = icon;

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center p-4 bg-slate-900/45 backdrop-blur-sm modal-overlay-in">
      <div
        role="dialog"
        aria-modal="true"
        className="modal-card-in flex w-full max-w-lg max-h-[90vh] flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
      >
        <div className="flex shrink-0 items-start justify-between gap-3 bg-gradient-to-r from-[#00a88e] to-[#0e9480] px-6 py-5">
          <div className="flex min-w-0 items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/20 text-white">
              <Icon className="h-5 w-5" strokeWidth={2.5} aria-hidden />
            </div>
            <div className="min-w-0">
              <h3 className="text-[17px] font-bold text-white">{title}</h3>
              {subtitle ? (
                <p className="mt-0.5 text-[13px] font-medium text-white/80">{subtitle}</p>
              ) : null}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-lg p-1.5 text-white/90 transition hover:bg-white/20"
            aria-label="Fechar"
          >
            <X className="h-5 w-5" strokeWidth={2} aria-hidden />
          </button>
        </div>

        <div className="flex min-h-0 flex-1 flex-col">{children}</div>

        <div className="flex shrink-0 flex-col-reverse items-stretch gap-3 border-t border-[#e2e8f0] px-6 py-4 sm:flex-row sm:items-center sm:justify-end">
          {footer}
        </div>
      </div>
    </div>
  );
}

export const HABITO_MODAL_CANCEL_CLASS =
  'rounded-xl border border-slate-200 bg-white px-5 py-3 text-[14px] font-bold text-[#64748b] transition hover:border-[#00a88e]/20';

export const HABITO_MODAL_SUBMIT_CLASS =
  'flex items-center justify-center gap-2 rounded-xl border border-transparent bg-[#00a88e] px-5 py-3 text-[14px] font-bold text-white shadow-md transition hover:bg-[#00967f] disabled:cursor-not-allowed disabled:opacity-60';
