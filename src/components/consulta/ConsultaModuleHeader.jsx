import React from 'react';
import { ChevronLeft } from 'lucide-react';
import { getPatientInitials as defaultGetPatientInitials } from '../utils';

const MODULE_LABELS = {
  hub: 'Consulta',
  anamnese: 'Anamnese',
  avaliacao: 'Avaliação',
  planejamento: 'Planejamento',
  termos: 'Termos',
  procedimento: 'Procedimento',
};

export function ConsultaModuleHeader({ paciente, module, onBack, onSair, getPatientInitials }) {
  const initialsFn = getPatientInitials ?? defaultGetPatientInitials;
  const moduleLabel = MODULE_LABELS[module] ?? 'Consulta';
  const iniciais = paciente ? initialsFn(paciente.nome || '') || '—' : '—';

  return (
    <div className="flex w-full shrink-0 items-center gap-2 sm:gap-3">
      {typeof onBack === 'function' ? (
        <button
          type="button"
          onClick={onBack}
          className="flex min-h-[44px] shrink-0 items-center gap-1 rounded-xl border border-app-border bg-white px-3 text-[13px] font-semibold text-[#64748b] transition-colors hover:bg-app-nav-hover active:bg-app-nav-active sm:px-4"
        >
          <ChevronLeft className="h-4 w-4 shrink-0" strokeWidth={2.5} aria-hidden />
          Voltar ao hub
        </button>
      ) : null}

      <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
        {paciente ? (
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#00a88e] text-[12px] font-bold text-white sm:h-9 sm:w-9 sm:text-[13px]">
            {iniciais}
          </div>
        ) : null}
        <div className="min-w-0 flex-1">
          <p className="truncate text-[14px] font-bold text-[#0f172a] sm:text-[15px]">{moduleLabel}</p>
          {paciente?.nome ? (
            <p className="truncate text-[12px] text-[#94a3b8] sm:text-[13px]">{paciente.nome}</p>
          ) : null}
        </div>
      </div>

      {typeof onSair === 'function' ? (
        <button
          type="button"
          onClick={onSair}
          className="shrink-0 rounded-lg px-3 py-2 text-[13px] font-semibold text-[#64748b] transition-colors hover:bg-app-nav-hover active:bg-app-nav-active"
        >
          Sair
        </button>
      ) : null}
    </div>
  );
}
