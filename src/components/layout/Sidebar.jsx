import React, { useEffect, useState } from 'react';
import { ChevronRight, LogOut, Settings, Shield, Users } from 'lucide-react';
import { useMediaQuery } from '../../hooks/useMediaQuery';

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
  const isTabletSidebar = useMediaQuery('(min-width: 768px) and (max-width: 1023px)');
  const [tabletExpanded, setTabletExpanded] = useState(false);

  useEffect(() => {
    if (!isTabletSidebar) setTabletExpanded(false);
  }, [isTabletSidebar]);

  const collapsedTablet = isTabletSidebar && !tabletExpanded;
  const railW = isTabletSidebar ? (collapsedTablet ? 'w-16' : 'w-[220px]') : 'w-[220px]';

  return (
    <aside
      className={`hidden h-full shrink-0 flex-col border-r-[3px] border-[#00a88e]/15 bg-white shadow-[4px_0_24px_rgb(0,168,142,0.02)] transition-[width] duration-200 ease-out md:flex ${railW}`}
    >
      <div
        className={`flex border-b border-[#00a88e]/10 p-4 ${collapsedTablet ? 'flex-col items-center gap-2 px-2' : 'items-center gap-3 px-6'}`}
      >
        <div className="rounded-xl border-[3px] border-[#00a88e]/25 bg-[#00a88e] p-2 shadow-sm">
          <Shield className="h-6 w-6 text-white" strokeWidth={2} />
        </div>
        {!collapsedTablet ? (
          <div className="min-w-0 flex-1">
            <h1 className="text-[19px] font-bold leading-tight text-[#0f172a]">Procedi</h1>
            <p className="text-[11px] font-medium text-[#64748b]">Harmonização Premium</p>
          </div>
        ) : null}
        {isTabletSidebar ? (
          <button
            type="button"
            onClick={() => setTabletExpanded((e) => !e)}
            className="flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-lg border border-[#e2e8f0] text-[#64748b] active:bg-[#f8fafc] lg:hidden"
            aria-label={tabletExpanded ? 'Recolher menu' : 'Expandir menu'}
          >
            <ChevronRight
              className={`h-5 w-5 transition-transform ${tabletExpanded ? 'rotate-180' : ''}`}
              strokeWidth={2.25}
            />
          </button>
        ) : null}
      </div>

      <div
        className={`mx-4 mb-6 mt-4 flex items-center gap-3 rounded-[14px] border-[3px] border-[#00a88e]/25 bg-[#e6f7f5] p-3 shadow-sm ${
          collapsedTablet ? 'mx-2 justify-center px-2' : ''
        }`}
      >
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#00a88e] text-sm font-bold text-white">
          {displayInitials(displayName)}
        </div>
        {!collapsedTablet ? (
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-[14px] font-bold leading-tight text-[#0f766e]">{displayName}</h2>
            <p className="truncate text-[12px] font-medium text-[#00a88e]">{roleLabel}</p>
          </div>
        ) : null}
      </div>

      <nav className="flex flex-1 flex-col space-y-2 px-2 lg:px-4">
        <button
          type="button"
          onClick={() => {
            setActiveView('pacientes');
          }}
          className={`flex min-h-[44px] w-full items-center rounded-xl border-[3px] border-transparent py-3 text-[14px] font-semibold transition-all active:bg-[#f0fdfa] ${
            collapsedTablet ? 'justify-center px-2' : 'gap-3 px-4'
          } ${
            activeView === 'pacientes'
              ? 'border-[#00a88e]/25 bg-[#e6f7f5] text-[#00a88e]'
              : 'bg-white text-[#64748b] hover:border-[#00a88e]/20 hover:text-[#00a88e]'
          }`}
        >
          <Users className="h-5 w-5 shrink-0" strokeWidth={2} />
          {!collapsedTablet ? <span>Pacientes</span> : <span className="sr-only">Pacientes</span>}
        </button>
        <button
          type="button"
          onClick={() => {
            setActiveView('configuracoes');
          }}
          className={`flex min-h-[44px] w-full items-center rounded-xl border-[3px] border-transparent py-3 text-[14px] font-semibold transition-all active:bg-[#f0fdfa] ${
            collapsedTablet ? 'justify-center px-2' : 'gap-3 px-4'
          } ${
            activeView === 'configuracoes'
              ? 'border-[#00a88e]/25 bg-[#e6f7f5] text-[#00a88e]'
              : 'bg-white text-[#64748b] hover:border-[#00a88e]/20 hover:text-[#00a88e]'
          }`}
        >
          <Settings className="h-5 w-5 shrink-0" strokeWidth={2} />
          {!collapsedTablet ? <span>Configurações</span> : <span className="sr-only">Configurações</span>}
        </button>
      </nav>

      <div className="border-t-[3px] border-[#00a88e]/10 p-4">
        <button
          type="button"
          onClick={handleLogout}
          className={`flex min-h-[44px] w-full items-center rounded-xl border-[3px] border-transparent py-3 text-[14px] font-bold text-[#ef4444] transition-all active:bg-red-50 ${
            collapsedTablet ? 'justify-center px-2' : 'gap-3 px-4'
          }`}
        >
          <LogOut className="h-5 w-5 shrink-0" strokeWidth={2.5} />
          {!collapsedTablet ? <span>Sair do Sistema</span> : <span className="sr-only">Sair do Sistema</span>}
        </button>
      </div>
    </aside>
  );
}
