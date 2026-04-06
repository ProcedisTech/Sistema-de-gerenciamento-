import React from 'react';
import { ClipboardList, GitCommit, LogOut, Users } from 'lucide-react';

export function MobileNavigation({ activeView, onGoJornada, onGoPacientes, onGoAnamnese, onLogout }) {
  const tabClass = (isActive) =>
    `flex-1 flex flex-col items-center justify-center gap-1 rounded-xl py-2 border-[3px] transition-all min-w-0 ${
      isActive ? 'border-[#00a88e]/25 bg-[#e6f7f5] text-[#00a88e]' : 'border-transparent bg-white text-[#64748b]'
    }`;

  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 z-[130] bg-white border-t-[3px] border-[#00a88e]/15 pb-[max(env(safe-area-inset-bottom),0.25rem)]">
      <div className="px-1.5 sm:px-2 py-2.5 flex items-stretch justify-between gap-1 sm:gap-1.5">
        <button type="button" onClick={onGoJornada} className={tabClass(activeView === 'jornada')} aria-current={activeView === 'jornada' ? 'page' : undefined}>
          <GitCommit className="w-5 h-5" strokeWidth={2.5} />
          <span className="text-[10px] sm:text-[11px] font-bold leading-tight text-center px-0.5">Atendimento</span>
        </button>

        <button type="button" onClick={onGoPacientes} className={tabClass(activeView === 'pacientes')} aria-current={activeView === 'pacientes' ? 'page' : undefined}>
          <Users className="w-5 h-5" strokeWidth={2.5} />
          <span className="text-[10px] sm:text-[11px] font-bold leading-tight text-center px-0.5">Pacientes</span>
        </button>

        <button type="button" onClick={onGoAnamnese} className={tabClass(activeView === 'anamnese')} aria-current={activeView === 'anamnese' ? 'page' : undefined}>
          <ClipboardList className="w-5 h-5" strokeWidth={2.5} />
          <span className="text-[10px] sm:text-[11px] font-bold leading-tight text-center px-0.5">Anamnese</span>
        </button>

        <button
          type="button"
          onClick={onLogout}
          className="flex-1 flex flex-col items-center justify-center gap-1 rounded-xl py-2 border-[3px] border-transparent bg-white text-[#ef4444] hover:bg-red-50 min-w-0"
          aria-label="Sair do sistema"
        >
          <LogOut className="w-5 h-5" strokeWidth={2.5} />
          <span className="text-[10px] sm:text-[11px] font-bold leading-tight text-center px-0.5">Sair</span>
        </button>
      </div>
    </div>
  );
}
