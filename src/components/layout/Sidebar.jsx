import React from 'react';
import { Shield, GitCommit, Users, ClipboardList, LogOut } from 'lucide-react';

function displayInitials(name) {
  if (!name || typeof name !== 'string') return 'U';
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'U';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function displayRole(role) {
  if (!role || typeof role !== 'string') return 'Usuário';
  return role.charAt(0).toUpperCase() + role.slice(1).toLowerCase();
}

export function Sidebar({ activeView, setActiveView, handleLogout, authUser }) {
  const displayName = authUser?.username || 'Usuário';
  const roleLabel = displayRole(authUser?.role);

  return (
    <aside className="hidden md:flex w-[280px] bg-white border-r-[3px] border-[#00a88e]/15 flex-col md:h-full flex-shrink-0 shadow-[4px_0_24px_rgb(0,168,142,0.02)] z-10">
      <div className="p-6 flex items-center gap-3 mb-2">
        <div className="bg-[#00a88e] p-2 rounded-xl border-[3px] border-[#00a88e]/25 shadow-sm">
          <Shield className="text-white w-6 h-6" strokeWidth={2} />
        </div>
        <div>
          <h1 className="text-[19px] font-bold text-[#0f172a] leading-tight">Procedi</h1>
          <p className="text-[11px] text-[#64748b] font-medium">Harmonização Premium</p>
        </div>
      </div>

      <div className="mx-4 mb-6 bg-[#e6f7f5] rounded-[14px] p-3 flex items-center gap-3 border-[3px] border-[#00a88e]/25 shadow-sm">
        <div className="w-10 h-10 rounded-full bg-[#00a88e] flex items-center justify-center text-white font-bold text-sm">
          {displayInitials(displayName)}
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="text-[14px] font-bold text-[#0f766e] leading-tight truncate">{displayName}</h2>
          <p className="text-[12px] text-[#00a88e] font-medium truncate">{roleLabel}</p>
        </div>
      </div>

      <nav className="flex-1 px-4 space-y-2">
        <button
          onClick={() => setActiveView('jornada')}
          className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold text-[14px] shadow-sm border-[3px] ${
            activeView === 'jornada'
              ? 'bg-[#e6f7f5] text-[#00a88e] border-[#00a88e]/25'
              : 'bg-white text-[#64748b] border-transparent hover:bg-[#f0fdfa] hover:text-[#00a88e] hover:border-[#00a88e]/20'
          }`}
        >
          <GitCommit className="w-5 h-5" strokeWidth={2.5} /> Fluxo de atendimento
        </button>
        <button
          type="button"
          onClick={() => setActiveView('pacientes')}
          className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-semibold text-[14px] transition-all border-[3px] ${
            activeView === 'pacientes'
              ? 'bg-[#e6f7f5] text-[#00a88e] border-[#00a88e]/25'
              : 'bg-white text-[#64748b] border-transparent hover:bg-[#f0fdfa] hover:text-[#00a88e] hover:border-[#00a88e]/20'
          }`}
        >
          <Users className="w-5 h-5" /> Pacientes
        </button>
        <button
          type="button"
          onClick={() => setActiveView('anamnese')}
          className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-semibold text-[14px] transition-all border-[3px] ${
            activeView === 'anamnese'
              ? 'bg-[#e6f7f5] text-[#00a88e] border-[#00a88e]/25'
              : 'bg-white text-[#64748b] border-transparent hover:bg-[#f0fdfa] hover:text-[#00a88e] hover:border-[#00a88e]/20'
          }`}
        >
          <ClipboardList className="w-5 h-5" /> Anamnese
        </button>
      </nav>

      <div className="p-4 border-t-[3px] border-[#00a88e]/10">
        <button onClick={handleLogout} className="flex items-center gap-3 px-4 py-3 text-[#ef4444] hover:bg-red-50 border-[3px] border-transparent hover:border-red-100 w-full rounded-xl font-bold text-[14px] transition-all">
          <LogOut className="w-5 h-5" strokeWidth={2.5} /> Sair do Sistema
        </button>
      </div>
    </aside>
  );
}
