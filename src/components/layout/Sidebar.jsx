import React, { useEffect, useState } from 'react';
import { ChevronLeft, LogOut, Menu, Settings, Shield, Users } from 'lucide-react';
import { useMediaQuery } from '../../hooks/useMediaQuery';

const NAV_ITEMS = [
  { view: 'pacientes', label: 'Pacientes', icon: Users },
  { view: 'configuracoes', label: 'Configurações', icon: Settings },
];

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
  const isDesktop = useMediaQuery('(min-width: 1024px)');
  const [tabletExpanded, setTabletExpanded] = useState(false);

  useEffect(() => {
    if (!isTabletSidebar) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- recolher ao sair do intervalo tablet
      setTabletExpanded(false);
    }
  }, [isTabletSidebar]);

  const railW = isDesktop
    ? 'w-[220px]'
    : isTabletSidebar
      ? tabletExpanded
        ? 'w-[220px]'
        : 'w-[64px]'
      : 'w-[220px]';

  const asideZ = isTabletSidebar && tabletExpanded ? 'relative z-[100]' : 'relative z-auto';

  return (
    <>
      {isTabletSidebar && tabletExpanded ? (
        <div
          className="fixed inset-0 z-[90] cursor-pointer bg-black/30 backdrop-blur-[1px]"
          aria-hidden
          onClick={() => setTabletExpanded(false)}
          role="presentation"
        />
      ) : null}

      <aside
        className={`hidden h-full shrink-0 flex-col border-r-[3px] border-[#00a88e]/15 bg-white shadow-[4px_0_24px_rgb(0,168,142,0.02)] transition-[width] duration-200 ease-out md:flex ${railW} ${asideZ}`}
      >
        {isDesktop ? (
          <>
            <div className="flex items-center gap-3 border-b border-[#00a88e]/10 p-4 px-6">
              <div className="rounded-xl border-[3px] border-[#00a88e]/25 bg-[#00a88e] p-2 shadow-sm">
                <Shield className="h-6 w-6 text-white" strokeWidth={2} />
              </div>
              <div className="min-w-0 flex-1">
                <h1 className="text-[19px] font-bold leading-tight text-[#0f172a]">Procedi</h1>
                <p className="text-[11px] font-medium text-[#64748b]">Harmonização Premium</p>
              </div>
            </div>

            <div className="mx-4 mb-6 mt-4 flex items-center gap-3 rounded-[14px] border-[3px] border-[#00a88e]/25 bg-[#e6f7f5] p-3 shadow-sm">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#00a88e] text-sm font-bold text-white">
                {displayInitials(displayName)}
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="truncate text-[14px] font-bold leading-tight text-[#0f766e]">{displayName}</h2>
                <p className="truncate text-[12px] font-medium text-[#00a88e]">{roleLabel}</p>
              </div>
            </div>

            <nav className="flex flex-1 flex-col space-y-2 px-2 lg:px-4">
              {NAV_ITEMS.map((item) => {
                const NavIcon = item.icon;
                return (
                  <button
                    key={item.view}
                    type="button"
                    title={item.label}
                    onClick={() => setActiveView(item.view)}
                    className={`flex min-h-[44px] w-full items-center gap-3 rounded-xl border-[3px] border-transparent px-4 py-3 text-[14px] font-semibold transition-all active:bg-[#f0fdfa] ${
                      activeView === item.view
                        ? 'border-[#00a88e]/25 bg-[#e6f7f5] text-[#00a88e]'
                        : 'bg-white text-[#64748b] hover:border-[#00a88e]/20 hover:text-[#00a88e]'
                    }`}
                  >
                    <NavIcon className="h-5 w-5 shrink-0" strokeWidth={2} />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </nav>

            <div className="border-t-[3px] border-[#00a88e]/10 p-4">
              <button
                type="button"
                onClick={handleLogout}
                className="flex min-h-[44px] w-full items-center gap-3 rounded-xl border-[3px] border-transparent px-4 py-3 text-[14px] font-bold text-[#ef4444] transition-all active:bg-red-50"
              >
                <LogOut className="h-5 w-5 shrink-0" strokeWidth={2.5} />
                <span>Sair do Sistema</span>
              </button>
            </div>
          </>
        ) : null}

        {isTabletSidebar && !tabletExpanded ? (
          <>
            <div className="flex w-full flex-col items-center border-b border-[#00a88e]/10 pb-2 pt-1">
              <button
                type="button"
                onClick={() => setTabletExpanded(true)}
                className="mx-auto mt-3 flex h-10 w-10 items-center justify-center rounded-xl text-[#64748b] transition-colors hover:bg-[#f1f5f9] hover:text-[#0f172a]"
                aria-label="Expandir menu"
                title="Menu"
              >
                <Menu className="h-5 w-5 shrink-0" strokeWidth={2.25} />
              </button>
            </div>

            <div className="flex justify-center py-3">
              <div
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#00a88e] text-sm font-bold text-white"
                title={displayName}
              >
                {displayInitials(displayName)}
              </div>
            </div>

            <nav className="flex flex-1 flex-col gap-2 px-1 pt-1">
              {NAV_ITEMS.map((item) => {
                const NavIcon = item.icon;
                return (
                  <button
                    key={item.view}
                    type="button"
                    title={item.label}
                    onClick={() => setActiveView(item.view)}
                    className={`mx-auto flex h-10 w-10 items-center justify-center rounded-xl transition-colors ${
                      activeView === item.view
                        ? 'bg-[#e6f7f5] text-[#00a88e]'
                        : 'text-[#64748b] hover:bg-[#f1f5f9] hover:text-[#0f172a]'
                    }`}
                  >
                    <NavIcon className="h-5 w-5 shrink-0" strokeWidth={2} />
                  </button>
                );
              })}
            </nav>

            <div className="mt-auto border-t-[3px] border-[#00a88e]/10 p-3">
              <button
                type="button"
                title="Sair do Sistema"
                onClick={handleLogout}
                className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl text-[#ef4444] transition-colors hover:bg-red-50"
              >
                <LogOut className="h-5 w-5 shrink-0" strokeWidth={2.5} />
              </button>
            </div>
          </>
        ) : null}

        {isTabletSidebar && tabletExpanded ? (
          <>
            <div className="flex w-full items-center border-b border-[#00a88e]/10 px-4 pt-3">
              <button
                type="button"
                onClick={() => setTabletExpanded(false)}
                className="flex h-10 w-10 items-center justify-center rounded-xl text-[#64748b] transition-colors hover:bg-[#f1f5f9] hover:text-[#0f172a]"
                aria-label="Recolher menu"
                title="Recolher"
              >
                <ChevronLeft className="h-5 w-5 shrink-0" strokeWidth={2.25} />
              </button>
            </div>

            <div className="flex items-center gap-3 border-b border-[#00a88e]/10 px-6 pb-4 pt-2">
              <div className="rounded-xl border-[3px] border-[#00a88e]/25 bg-[#00a88e] p-2 shadow-sm">
                <Shield className="h-6 w-6 text-white" strokeWidth={2} />
              </div>
              <div className="min-w-0 flex-1">
                <h1 className="text-[19px] font-bold leading-tight text-[#0f172a]">Procedi</h1>
                <p className="text-[11px] font-medium text-[#64748b]">Harmonização Premium</p>
              </div>
            </div>

            <div className="mx-4 mb-6 mt-4 flex items-center gap-3 rounded-[14px] border-[3px] border-[#00a88e]/25 bg-[#e6f7f5] p-3 shadow-sm">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#00a88e] text-sm font-bold text-white">
                {displayInitials(displayName)}
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="truncate text-[14px] font-bold leading-tight text-[#0f766e]">{displayName}</h2>
                <p className="truncate text-[12px] font-medium text-[#00a88e]">{roleLabel}</p>
              </div>
            </div>

            <nav className="flex flex-1 flex-col space-y-2 px-2 lg:px-4">
              {NAV_ITEMS.map((item) => {
                const NavIcon = item.icon;
                return (
                  <button
                    key={item.view}
                    type="button"
                    title={item.label}
                    onClick={() => setActiveView(item.view)}
                    className={`flex min-h-[44px] w-full items-center gap-3 rounded-xl border-[3px] border-transparent px-4 py-3 text-[14px] font-semibold transition-all active:bg-[#f0fdfa] ${
                      activeView === item.view
                        ? 'border-[#00a88e]/25 bg-[#e6f7f5] text-[#00a88e]'
                        : 'bg-white text-[#64748b] hover:border-[#00a88e]/20 hover:text-[#00a88e]'
                    }`}
                  >
                    <NavIcon className="h-5 w-5 shrink-0" strokeWidth={2} />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </nav>

            <div className="border-t-[3px] border-[#00a88e]/10 p-4">
              <button
                type="button"
                onClick={handleLogout}
                className="flex min-h-[44px] w-full items-center gap-3 rounded-xl border-[3px] border-transparent px-4 py-3 text-[14px] font-bold text-[#ef4444] transition-all active:bg-red-50"
              >
                <LogOut className="h-5 w-5 shrink-0" strokeWidth={2.5} />
                <span>Sair do Sistema</span>
              </button>
            </div>
          </>
        ) : null}
      </aside>
    </>
  );
}
