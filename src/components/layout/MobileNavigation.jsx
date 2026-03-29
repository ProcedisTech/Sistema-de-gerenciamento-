import React from 'react';
import { Calendar, GitCommit, LogOut, Menu, Shield, Users, X } from 'lucide-react';

export function MobileNavigation({
  activeView,
  mobileNavOpen,
  setMobileNavOpen,
  onGoJornada,
  onGoAgenda,
  onGoPacientes,
  onLogout,
}) {
  return (
    <>
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-[130] bg-white border-t-[3px] border-[#00a88e]/15 pb-[max(env(safe-area-inset-bottom),0.25rem)]">
        <div className="px-2.5 sm:px-3 py-2.5 flex items-center justify-between gap-1.5 sm:gap-2">
          <button
            type="button"
            onClick={onGoJornada}
            className={`flex-1 flex flex-col items-center justify-center gap-1 rounded-xl py-2 border-[3px] transition-all min-w-0 ${
              activeView === 'jornada'
                ? 'border-[#00a88e]/25 bg-[#e6f7f5] text-[#00a88e]'
                : 'border-transparent bg-white text-[#64748b]'
            }`}
          >
            <GitCommit className="w-5 h-5" strokeWidth={2.5} />
            <span className="text-[11px] font-bold">Jornada</span>
          </button>

          <button
            type="button"
            onClick={onGoAgenda}
            className={`flex-1 flex flex-col items-center justify-center gap-1 rounded-xl py-2 border-[3px] transition-all min-w-0 ${
              activeView === 'agenda'
                ? 'border-[#00a88e]/25 bg-[#e6f7f5] text-[#00a88e]'
                : 'border-transparent bg-white text-[#64748b]'
            }`}
          >
            <Calendar className="w-5 h-5" strokeWidth={2.5} />
            <span className="text-[11px] font-bold">Agenda</span>
          </button>

          <button
            type="button"
            onClick={() => setMobileNavOpen(true)}
            className="flex-1 flex flex-col items-center justify-center gap-1 rounded-xl py-2 border-[3px] transition-all border-transparent bg-white text-[#64748b] min-w-0"
          >
            <Menu className="w-5 h-5" strokeWidth={2.5} />
            <span className="text-[11px] font-bold">Menu</span>
          </button>
        </div>
      </div>

      {mobileNavOpen && (
        <div className="md:hidden fixed inset-0 z-[140]">
          <div className="absolute inset-0 bg-black/50" onClick={() => setMobileNavOpen(false)} />
          <div className="absolute left-0 top-0 bottom-0 w-[88vw] max-w-[340px] bg-white border-r-[3px] border-[#00a88e]/15 shadow-[4px_0_24px_rgb(0,168,142,0.08)] p-4 overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="bg-[#00a88e] p-2 rounded-xl border-[3px] border-[#00a88e]/25 shadow-sm">
                  <Shield className="text-white w-6 h-6" strokeWidth={2} />
                </div>
                <div>
                  <h1 className="text-[16px] font-bold text-[#0f172a] leading-tight">Procedi</h1>
                  <p className="text-[10px] text-[#64748b] font-medium">Harmonizacao Premium</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setMobileNavOpen(false)}
                className="w-10 h-10 rounded-xl border-[3px] border-[#00a88e]/20 text-[#64748b] hover:text-[#00a88e] hover:bg-[#f0fdfa] transition-all flex items-center justify-center"
                aria-label="Fechar menu"
              >
                <X className="w-5 h-5" strokeWidth={2.5} />
              </button>
            </div>

            <div className="mx-0 mb-5 bg-[#e6f7f5] rounded-[14px] p-3 flex items-center gap-3 border-[3px] border-[#00a88e]/25 shadow-sm">
              <div className="w-10 h-10 rounded-full bg-[#00a88e] flex items-center justify-center text-white font-bold text-sm">RS</div>
              <div className="flex-1">
                <h2 className="text-[13px] font-bold text-[#0f766e] leading-tight">Rafael Silva</h2>
                <p className="text-[11px] text-[#00a88e] font-medium">Administrador</p>
              </div>
            </div>

            <nav className="space-y-2">
              <button
                type="button"
                onClick={onGoJornada}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold text-[14px] shadow-sm border-[3px] ${
                  activeView === 'jornada'
                    ? 'bg-[#e6f7f5] text-[#00a88e] border-[#00a88e]/25'
                    : 'bg-white text-[#64748b] border-transparent hover:bg-[#f0fdfa] hover:text-[#00a88e] hover:border-[#00a88e]/20'
                }`}
              >
                <GitCommit className="w-5 h-5" strokeWidth={2.5} /> Jornada do Paciente
              </button>

              <button
                type="button"
                onClick={onGoAgenda}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-semibold text-[14px] transition-all border-[3px] ${
                  activeView === 'agenda'
                    ? 'bg-[#e6f7f5] text-[#00a88e] border-[#00a88e]/25'
                    : 'bg-white text-[#64748b] border-transparent hover:bg-[#f0fdfa] hover:text-[#00a88e] hover:border-[#00a88e]/20'
                }`}
              >
                <Calendar className="w-5 h-5" /> Agenda
              </button>

              <button
                type="button"
                onClick={onGoPacientes}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-semibold text-[14px] transition-all border-[3px] ${
                  activeView === 'pacientes'
                    ? 'bg-[#e6f7f5] text-[#00a88e] border-[#00a88e]/25'
                    : 'bg-white text-[#64748b] border-transparent hover:bg-[#f0fdfa] hover:text-[#00a88e] hover:border-[#00a88e]/20'
                }`}
              >
                <Users className="w-5 h-5" strokeWidth={2.5} /> Pacientes
              </button>
            </nav>

            <div className="mt-5 pt-4 border-t-[3px] border-[#00a88e]/10">
              <button
                type="button"
                onClick={onLogout}
                className="flex items-center gap-3 px-4 py-3 text-[#ef4444] hover:bg-red-50 border-[3px] border-transparent hover:border-red-100 w-full rounded-xl font-bold text-[14px] transition-all"
              >
                <LogOut className="w-5 h-5" strokeWidth={2.5} /> Sair do Sistema
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

