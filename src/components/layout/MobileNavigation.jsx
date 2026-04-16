import React from 'react';
import { LogOut, Settings, Users } from 'lucide-react';

export function MobileNavigation({ activeView, onGoPacientes, onGoConfiguracoes, onLogout }) {
  const tabClass = (isActive) =>
    `flex min-h-[44px] flex-1 flex-col items-center justify-center gap-0.5 rounded-xl border-[3px] px-1 py-1 transition-all ${
      isActive ? 'border-[#00a88e]/25 bg-[#e6f7f5] text-[#00a88e]' : 'border-transparent bg-white text-[#64748b]'
    }`;

  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 z-[130] h-16 min-h-[4rem] border-t-[3px] border-[#00a88e]/15 bg-white pb-[env(safe-area-inset-bottom)]">
      <div className="flex h-full min-h-[4rem] items-stretch justify-between gap-1 px-1.5 py-1 sm:px-2">
        <button
          type="button"
          onClick={onGoPacientes}
          className={tabClass(activeView === 'pacientes')}
          aria-current={activeView === 'pacientes' ? 'page' : undefined}
        >
          <Users className="h-6 w-6" strokeWidth={2.5} />
          <span className="text-[11px] font-bold leading-tight">Pacientes</span>
        </button>

        <button
          type="button"
          onClick={onGoConfiguracoes}
          className={tabClass(activeView === 'configuracoes')}
          aria-current={activeView === 'configuracoes' ? 'page' : undefined}
        >
          <Settings className="h-6 w-6" strokeWidth={2.5} />
          <span className="text-[11px] font-bold leading-tight">Configurações</span>
        </button>

        <button
          type="button"
          onClick={onLogout}
          className="flex min-h-[44px] min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-xl border-[3px] border-transparent bg-white py-1 text-[#ef4444] active:bg-red-50"
          aria-label="Sair do sistema"
        >
          <LogOut className="h-6 w-6" strokeWidth={2.5} />
          <span className="text-[11px] font-bold leading-tight">Sair</span>
        </button>
      </div>
    </div>
  );
}
