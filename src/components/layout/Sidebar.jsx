import React, { useEffect, useState } from 'react';
import { CalendarDays, ChevronLeft, LogOut, Menu, Settings, Users, UserCog } from 'lucide-react';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import { usePapel } from '../../hooks/usePapel';
import { ClinicaIdentityBlock } from './ClinicaIdentityBlock.jsx';
import { UsuarioIdentityCard, UsuarioAvatarInner } from './UsuarioIdentityCard.jsx';
import { ProcediSymbol } from './ProcediSymbol.jsx';
import { resolveIdentity } from './identityDisplay';

const NAV_ITEMS = [
  { view: 'pacientes', label: 'Pacientes', icon: Users },
  { view: 'agenda', label: 'Agenda', icon: CalendarDays },
  { view: 'gestao-equipe', label: 'Gestão de Equipe', icon: UserCog },
  { view: 'configuracoes', label: 'Configurações', icon: Settings },
];

const DESKTOP_COLLAPSED_KEY = 'procedi.sidebar.desktopCollapsed';

function readDesktopCollapsed() {
  try {
    const v = localStorage.getItem(DESKTOP_COLLAPSED_KEY);
    return v === '1' || v === 'true';
  } catch {
    return false;
  }
}

/**
 * @param {{
 *   activeView: string,
 *   setActiveView: (v: string) => void,
 *   handleLogout: () => void,
 *   authUser?: object,
 *   onRailWidthPxChange?: (px: number) => void,
 *   clinicaNome?: string,
 *   clinicaLogoUrl?: string,
 *   perfilNomeCompleto?: string,
 *   perfilApelido?: string,
 *   perfilFotoUrl?: string,
 *   onOpenClinicaSettings?: () => void,
 *   onOpenPerfilSettings?: () => void,
 *   identidadeNoHeader?: boolean,
 * }} props
 */
export function Sidebar({
  activeView,
  setActiveView,
  handleLogout,
  authUser,
  onRailWidthPxChange,
  clinicaNome,
  clinicaLogoUrl,
  perfilNomeCompleto,
  perfilApelido,
  perfilFotoUrl,
  onOpenClinicaSettings,
  onOpenPerfilSettings,
  identidadeNoHeader = false,
}) {
  const { tituloClinica, clinicaLogoResolved, displayName, shortName, perfilFotoResolved, roleLabel } =
    resolveIdentity({
      clinicaNome,
      clinicaLogoUrl,
      perfilNomeCompleto,
      perfilApelido,
      perfilFotoUrl,
      authUser,
    });
  const identityHideXl = identidadeNoHeader ? 'xl:hidden' : '';
  const isTabletSidebar = useMediaQuery('(min-width: 768px) and (max-width: 1023px)');
  const isDesktop = useMediaQuery('(min-width: 1024px)');
  const [tabletExpanded, setTabletExpanded] = useState(false);
  const [desktopCollapsed, setDesktopCollapsed] = useState(readDesktopCollapsed);
  const { canSeeConfigEquipe, canSeeConfig } = usePapel();
  const visibleNavItems = NAV_ITEMS.filter((item) => {
    if (item.view === 'configuracoes') return canSeeConfig;
    if (item.view === 'gestao-equipe') return canSeeConfigEquipe;
    return true;
  });

  useEffect(() => {
    if (!isTabletSidebar) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- recolher ao sair do intervalo tablet
      setTabletExpanded(false);
    }
  }, [isTabletSidebar]);

  useEffect(() => {
    try {
      localStorage.setItem(DESKTOP_COLLAPSED_KEY, desktopCollapsed ? '1' : '0');
    } catch {
      // ignore
    }
  }, [desktopCollapsed]);

  const narrowRail =
    (isDesktop && desktopCollapsed) || (isTabletSidebar && !tabletExpanded);
  const railW = narrowRail ? 'w-[64px]' : 'w-[220px]';
  const railWidthPx = narrowRail ? 64 : 220;

  useEffect(() => {
    onRailWidthPxChange?.(railWidthPx);
  }, [railWidthPx, onRailWidthPxChange]);

  const asideZ = isTabletSidebar && tabletExpanded ? 'relative z-[100]' : 'relative z-auto';

  const openRailWide = () => {
    if (isTabletSidebar) setTabletExpanded(true);
    if (isDesktop) setDesktopCollapsed(false);
  };

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
        className={`hidden h-full shrink-0 flex-col overflow-hidden border-r border-app-border bg-white shadow-app-sidebar transition-[width] duration-200 ease-out md:flex ${railW} ${asideZ}`}
      >
        {narrowRail ? (
          <>
            <div className="flex w-full flex-col items-center border-b border-app-border pb-2 pt-1 transition-opacity duration-200">
              <button
                type="button"
                onClick={openRailWide}
                className="mx-auto mt-3 flex h-10 w-10 items-center justify-center rounded-xl text-[#64748b] transition-all hover:bg-app-nav-hover active:bg-app-nav-active hover:text-app-accent-deep"
                aria-label="Expandir menu"
                title="Menu"
              >
                <Menu className="h-5 w-5 shrink-0" strokeWidth={2.25} />
              </button>
            </div>

            <div className={`flex justify-center py-3 ${identityHideXl}`} data-testid="sidebar-rail-avatar">
              {canSeeConfig ? (
                <button
                  type="button"
                  onClick={() => onOpenPerfilSettings?.()}
                  className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#00a88e] text-sm font-bold text-white transition-opacity duration-200 hover:opacity-95"
                  title={displayName}
                  aria-label="Abrir perfil do profissional"
                >
                  <UsuarioAvatarInner perfilFotoResolved={perfilFotoResolved} displayName={displayName} />
                </button>
              ) : (
                <div
                  className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#00a88e] text-sm font-bold text-white"
                  title={displayName}
                >
                  <UsuarioAvatarInner perfilFotoResolved={perfilFotoResolved} displayName={displayName} />
                </div>
              )}
            </div>

            <nav className="flex flex-1 flex-col gap-2 px-1 pt-1">
              {visibleNavItems.map((item) => {
                const NavIcon = item.icon;
                return (
                  <button
                    key={item.view}
                    type="button"
                    title={item.label}
                    onClick={() => setActiveView(item.view)}
                    className={`mx-auto flex h-10 w-10 items-center justify-center rounded-xl transition-all ${
                      activeView === item.view
                        ? 'bg-emerald-50 text-app-accent-deep shadow-sm ring-1 ring-emerald-200/60'
                        : 'text-[#64748b] hover:bg-app-nav-hover active:bg-app-nav-active hover:text-app-accent-deep'
                    }`}
                  >
                    <NavIcon className="h-5 w-5 shrink-0" strokeWidth={2} />
                  </button>
                );
              })}
            </nav>

            <div className="mt-auto border-t border-app-border p-3">
              <button
                type="button"
                title="Sair do Sistema"
                onClick={handleLogout}
                className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl text-[#ef4444] transition-all hover:bg-red-50 active:bg-red-100"
              >
                <LogOut className="h-5 w-5 shrink-0" strokeWidth={2.5} />
              </button>
            </div>
          </>
        ) : null}

        {!narrowRail && isDesktop ? (
          <>
            <div className="flex items-center gap-2 border-b border-app-border p-4 pl-4 pr-3 transition-opacity duration-200">
              <ClinicaIdentityBlock
                variant="sidebar-desktop"
                tituloClinica={tituloClinica}
                clinicaLogoResolved={clinicaLogoResolved}
                canSeeConfig={canSeeConfig}
                onOpenClinicaSettings={onOpenClinicaSettings}
                className={identityHideXl}
              />
              {identidadeNoHeader ? (
                <div className="hidden min-w-0 flex-1 items-center gap-2 xl:flex" data-testid="sidebar-brand">
                  <ProcediSymbol className="h-8 w-8 shrink-0" />
                  <span className="truncate font-semibold text-teal-700">Procedi</span>
                </div>
              ) : null}
              <button
                type="button"
                onClick={() => setDesktopCollapsed(true)}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-app-border text-[#64748b] transition-all hover:bg-app-nav-hover active:bg-app-nav-active hover:text-app-accent-deep"
                aria-label="Recolher menu"
                title="Recolher"
              >
                <ChevronLeft className="h-5 w-5 shrink-0" strokeWidth={2.25} />
              </button>
            </div>

            <UsuarioIdentityCard
              variant="sidebar"
              displayName={displayName}
              shortName={shortName}
              perfilFotoResolved={perfilFotoResolved}
              roleLabel={roleLabel}
              canSeeConfig={canSeeConfig}
              onOpenPerfilSettings={onOpenPerfilSettings}
              className={identityHideXl}
            />

            <nav className="flex flex-1 flex-col space-y-2 px-2 lg:px-4">
              {visibleNavItems.map((item) => {
                const NavIcon = item.icon;
                return (
                  <button
                    key={item.view}
                    type="button"
                    title={item.label}
                    onClick={() => setActiveView(item.view)}
                    className={`flex min-h-[44px] w-full items-center gap-3 rounded-xl pl-2 pr-4 py-3 text-left text-[14px] font-semibold transition-all border-l-2 ${
                      activeView === item.view
                        ? 'border-l-app-accent bg-emerald-50 text-app-accent-deep'
                        : 'border-l-transparent bg-white text-[#64748b] hover:bg-app-nav-hover active:bg-app-nav-active hover:text-app-accent-deep'
                    }`}
                  >
                    <NavIcon className="h-5 w-5 shrink-0" strokeWidth={2} />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </nav>

            <div className="border-t border-app-border p-4">
              <button
                type="button"
                onClick={handleLogout}
                className="flex min-h-[44px] w-full items-center gap-3 rounded-xl px-4 py-3 text-[14px] font-bold text-[#ef4444] transition-all hover:bg-red-50 active:bg-red-100"
              >
                <LogOut className="h-5 w-5 shrink-0" strokeWidth={2.5} />
                <span>Sair do Sistema</span>
              </button>
            </div>
          </>
        ) : null}

        {!narrowRail && isTabletSidebar && tabletExpanded ? (
          <>
            <div className="flex w-full items-center border-b border-app-border px-4 pt-3">
              <button
                type="button"
                onClick={() => setTabletExpanded(false)}
                className="flex h-10 w-10 items-center justify-center rounded-xl text-[#64748b] transition-all hover:bg-app-nav-hover active:bg-app-nav-active hover:text-app-accent-deep"
                aria-label="Recolher menu"
                title="Recolher"
              >
                <ChevronLeft className="h-5 w-5 shrink-0" strokeWidth={2.25} />
              </button>
            </div>

            <ClinicaIdentityBlock
              variant="sidebar-tablet"
              tituloClinica={tituloClinica}
              clinicaLogoResolved={clinicaLogoResolved}
              canSeeConfig={canSeeConfig}
              onOpenClinicaSettings={onOpenClinicaSettings}
            />

            <UsuarioIdentityCard
              variant="sidebar"
              displayName={displayName}
              shortName={shortName}
              perfilFotoResolved={perfilFotoResolved}
              roleLabel={roleLabel}
              canSeeConfig={canSeeConfig}
              onOpenPerfilSettings={onOpenPerfilSettings}
            />

            <nav className="flex flex-1 flex-col space-y-2 px-2 lg:px-4">
              {visibleNavItems.map((item) => {
                const NavIcon = item.icon;
                return (
                  <button
                    key={item.view}
                    type="button"
                    title={item.label}
                    onClick={() => setActiveView(item.view)}
                    className={`flex min-h-[44px] w-full items-center gap-3 rounded-xl pl-2 pr-4 py-3 text-left text-[14px] font-semibold transition-all border-l-2 ${
                      activeView === item.view
                        ? 'border-l-app-accent bg-emerald-50 text-app-accent-deep'
                        : 'border-l-transparent bg-white text-[#64748b] hover:bg-app-nav-hover active:bg-app-nav-active hover:text-app-accent-deep'
                    }`}
                  >
                    <NavIcon className="h-5 w-5 shrink-0" strokeWidth={2} />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </nav>

            <div className="border-t border-app-border p-4">
              <button
                type="button"
                onClick={handleLogout}
                className="flex min-h-[44px] w-full items-center gap-3 rounded-xl px-4 py-3 text-[14px] font-bold text-[#ef4444] transition-all hover:bg-red-50 active:bg-red-100"
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
