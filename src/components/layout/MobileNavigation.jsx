import React from 'react';
import { CalendarDays, LogOut, Settings, Users, UserCog } from 'lucide-react';
import { usePapel } from '../../hooks/usePapel';

export function MobileNavigation({ activeView, onGoPacientes, onGoAgenda, onGoGestaoEquipe, onGoConfiguracoes, onLogout }) {
  const { isAtLeast, canSeeConfigEquipe } = usePapel();
  const canSeeConfig = isAtLeast('NIVEL_3');
  const tabClass = (isActive) =>
    `flex min-h-[44px] flex-1 flex-col items-center justify-center gap-0.5 rounded-xl border px-0.5 py-1 transition-all ${
      isActive
        ? 'border-app-border bg-app-nav-active text-app-accent-deep shadow-sm'
        : 'border-transparent bg-white text-[#64748b] hover:bg-app-nav-hover active:bg-app-nav-active'
    }`;

  return (
    <div className="lg:hidden fixed bottom-0 left-0 right-0 z-[130] h-16 min-h-[4rem] border-t border-app-border bg-white shadow-app-card pb-[env(safe-area-inset-bottom)]">
      <div className="flex h-full min-h-[4rem] items-stretch justify-between gap-1 px-1.5 py-1 sm:px-2">
        <button
          type="button"
          onClick={onGoPacientes}
          className={tabClass(activeView === 'pacientes')}
          aria-current={activeView === 'pacientes' ? 'page' : undefined}
        >
          <Users className="h-5 w-5" strokeWidth={2.5} />
          <span className="text-[10px] font-bold leading-tight">Pacientes</span>
        </button>

        <button
          type="button"
          onClick={onGoAgenda}
          className={tabClass(activeView === 'agenda')}
          aria-current={activeView === 'agenda' ? 'page' : undefined}
        >
          <CalendarDays className="h-5 w-5" strokeWidth={2.5} />
          <span className="text-[10px] font-bold leading-tight">Agenda</span>
        </button>

        {canSeeConfigEquipe && (
          <button
            type="button"
            onClick={onGoGestaoEquipe}
            className={tabClass(activeView === 'gestao-equipe')}
            aria-current={activeView === 'gestao-equipe' ? 'page' : undefined}
          >
            <UserCog className="h-5 w-5" strokeWidth={2.5} />
            <span className="text-[10px] font-bold leading-tight">Equipe</span>
          </button>
        )}

        {canSeeConfig && (
          <button
            type="button"
            onClick={onGoConfiguracoes}
            className={tabClass(activeView === 'configuracoes')}
            aria-current={activeView === 'configuracoes' ? 'page' : undefined}
          >
            <Settings className="h-5 w-5" strokeWidth={2.5} />
            <span className="text-[10px] font-bold leading-tight">Configurações</span>
          </button>
        )}

        <button
          type="button"
          onClick={onLogout}
          className="flex min-h-[44px] min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-xl border border-transparent bg-white py-1 text-[#ef4444] hover:bg-red-50 active:bg-red-100"
          aria-label="Sair do sistema"
        >
          <LogOut className="h-5 w-5" strokeWidth={2.5} />
          <span className="text-[10px] font-bold leading-tight">Sair</span>
        </button>
      </div>
    </div>
  );
}
