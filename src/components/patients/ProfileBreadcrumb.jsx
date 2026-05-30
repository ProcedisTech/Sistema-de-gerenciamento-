import React from 'react';
import { ArrowLeft } from 'lucide-react';

export function ProfileBreadcrumb({ patientName, onBackToList }) {
  return (
    <nav
      className="flex flex-wrap items-center gap-2 text-[13px]"
      aria-label="Navegação do perfil"
    >
      <button
        type="button"
        onClick={onBackToList}
        className="inline-flex h-9 items-center gap-2 rounded-[10px] border border-ink-200 bg-white px-3 text-[13px] font-medium text-ink-700 transition-colors hover:border-ink-300 hover:bg-ink-50 hover:text-ink-900"
      >
        <ArrowLeft className="h-4 w-4 shrink-0" strokeWidth={2.2} aria-hidden />
        Pacientes
      </button>
      <span className="text-ink-300" aria-hidden>
        /
      </span>
      <span className="truncate font-semibold text-ink-900">{patientName || '—'}</span>
    </nav>
  );
}
