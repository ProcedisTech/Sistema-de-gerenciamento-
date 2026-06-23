import React, { useEffect, useState } from 'react';
import { CalendarDays, ChevronLeft, LogOut, Menu, Settings, Shield, Users, UserCog } from 'lucide-react';
import { resolveApiUrl } from '../../config/apiEnv';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import { usePapel } from '../../hooks/usePapel';

function clinicaLogoDisplaySrc(u) {
  if (u == null || typeof u !== 'string') return '';
  const t = u.trim();
  if (!t) return '';
  if (t.startsWith('data:') || t.startsWith('http://') || t.startsWith('https://')) return t;
  if (t.startsWith('/')) return resolveApiUrl(t);
  return t;
}

function perfilFotoDisplaySrc(u) {
  return clinicaLogoDisplaySrc(u);
}

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

/**
 * @param {{
 *   activeView: string,
 *   setActiveView: (v: string) => void,
 *   handleLogout: () => void,
 *   authUser?: object,
 *   onRailWidthPxChange?: (px: number) => void,
 *   clinicaNome?: string,
 *   clinicaSubtitulo?: string,
 *   clinicaLogoUrl?: string,
 *   perfilNomeCompleto?: string,
 *   perfilFotoUrl?: string,
 *   onOpenClinicaSettings?: () => void,
 *   onOpenPerfilSettings?: () => void,
 * }} props
 */
export function Sidebar({
  activeView,
  setActiveView,
  handleLogout,
  authUser,
  onRailWidthPxChange,
  clinicaNome,
  clinicaSubtitulo,
  clinicaLogoUrl,
  perfilNomeCompleto,
  perfilFotoUrl,
  onOpenClinicaSettings,
  onOpenPerfilSettings,
}) {
  const tituloClinica =
    (typeof clinicaNome === 'string' && clinicaNome.trim()) || 'Procedi';
  const subtituloClinica =
    (typeof clinicaSubtitulo === 'string' && clinicaSubtitulo.trim()) || 'Harmonização Premium';
  const clinicaLogoResolved =
    clinicaLogoUrl && String(clinicaLogoUrl).trim() ? clinicaLogoDisplaySrc(clinicaLogoUrl) : '';
  const displayName =
    (typeof perfilNomeCompleto === 'string' && perfilNomeCompleto.trim()) ||
    authUser?.email ||
    authUser?.username ||
    'Usuário';
  const perfilFotoResolved =
    perfilFotoUrl && String(perfilFotoUrl).trim() ? perfilFotoDisplaySrc(perfilFotoUrl) : '';
  const roleLabel = displayRole(authUser?.role);
  const isTabletSidebar = useMediaQuery('(min-width: 768px) and (max-width: 1023px)');
  const isDesktop = useMediaQuery('(min-width: 1024px)');
  const [tabletExpanded, setTabletExpanded] = useState(false);
  const [desktopCollapsed, setDesktopCollapsed] = useState(readDesktopCollapsed);
  const { isAtLeast, canSeeConfigEquipe, canSeeConfig } = usePapel();
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

  const renderAvatarInner = () => {
    if (perfilFotoResolved) {
      return (
        <img
          src={perfilFotoResolved}
          alt=""
          className="h-full w-full object-cover"
        />
      );
    }
    return displayInitials(displayName);
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

            <div className="flex justify-center py-3">
              {canSeeConfig ? (
                <button
                  type="button"
                  onClick={() => onOpenPerfilSettings?.()}
                  className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#00a88e] text-sm font-bold text-white transition-opacity duration-200 hover:opacity-95"
                  title={displayName}
                  aria-label="Abrir perfil do profissional"
                >
                  {renderAvatarInner()}
                </button>
              ) : (
                <div
                  className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#00a88e] text-sm font-bold text-white"
                  title={displayName}
                >
                  {renderAvatarInner()}
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
              {canSeeConfig ? (
                <button
                  type="button"
                  onClick={() => onOpenClinicaSettings?.()}
                  className="flex min-w-0 flex-1 items-center gap-3 rounded-xl py-1 text-left transition-colors hover:bg-app-nav-hover/80 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300/60"
                  aria-label="Abrir dados da clínica"
                >
                  <div className="shrink-0 rounded-xl border border-white/30 bg-[#00a88e] p-2 shadow-sm">
                    {clinicaLogoResolved ? (
                      <img
                        src={clinicaLogoResolved}
                        alt="Logo"
                        className="h-10 w-10 rounded-xl object-cover"
                      />
                    ) : (
                      <Shield className="h-6 w-6 text-white" strokeWidth={2} />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h1 className="truncate text-[19px] font-bold leading-tight text-[#0f172a]">{tituloClinica}</h1>
                    <p className="truncate text-[11px] font-medium text-[#64748b]">{subtituloClinica}</p>
                  </div>
                </button>
              ) : (
                <div
                  className="flex min-w-0 flex-1 items-center gap-3 py-1"
                >
                  <div className="shrink-0 rounded-xl border border-white/30 bg-[#00a88e] p-2 shadow-sm">
                    {clinicaLogoResolved ? (
                      <img
                        src={clinicaLogoResolved}
                        alt="Logo"
                        className="h-10 w-10 rounded-xl object-cover"
                      />
                    ) : (
                      <Shield className="h-6 w-6 text-white" strokeWidth={2} />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h1 className="truncate text-[19px] font-bold leading-tight text-[#0f172a]">{tituloClinica}</h1>
                    <p className="truncate text-[11px] font-medium text-[#64748b]">{subtituloClinica}</p>
                  </div>
                </div>
              )}
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

            {canSeeConfig ? (
              <button
                type="button"
                onClick={() => onOpenPerfilSettings?.()}
                className="mx-4 mb-6 mt-4 flex w-[calc(100%-2rem)] items-center gap-3 rounded-[14px] border border-app-border bg-app-nav-active p-3 text-left shadow-app-card transition-colors hover:bg-[#e8f5f3] focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300/60"
                aria-label="Abrir perfil do profissional"
              >
                <div className="relative flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#00a88e] text-sm font-bold text-white">
                  {renderAvatarInner()}
                </div>
                <div className="min-w-0 flex-1">
                  <h2 className="truncate text-[14px] font-bold leading-tight text-app-accent-deep">{displayName}</h2>
                  <p className="truncate text-[12px] font-medium text-app-accent">{roleLabel}</p>
                </div>
              </button>
            ) : (
              <div
                className="mx-4 mb-6 mt-4 flex w-[calc(100%-2rem)] items-center gap-3 rounded-[14px] border border-app-border bg-app-nav-active p-3 shadow-app-card"
              >
                <div className="relative flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#00a88e] text-sm font-bold text-white">
                  {renderAvatarInner()}
                </div>
                <div className="min-w-0 flex-1">
                  <h2 className="truncate text-[14px] font-bold leading-tight text-app-accent-deep">{displayName}</h2>
                  <p className="truncate text-[12px] font-medium text-app-accent">{roleLabel}</p>
                </div>
              </div>
            )}

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

            {canSeeConfig ? (
              <button
                type="button"
                onClick={() => onOpenClinicaSettings?.()}
                className="flex w-full items-center gap-3 border-b border-app-border px-6 pb-4 pt-2 text-left transition-colors hover:bg-app-nav-hover/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-emerald-300/50"
                aria-label="Abrir dados da clínica"
              >
                <div className="shrink-0 rounded-xl border border-white/30 bg-[#00a88e] p-2 shadow-sm">
                  {clinicaLogoResolved ? (
                    <img
                      src={clinicaLogoResolved}
                      alt="Logo"
                      className="h-10 w-10 rounded-xl object-cover"
                    />
                  ) : (
                    <Shield className="h-6 w-6 text-white" strokeWidth={2} />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <h1 className="truncate text-[19px] font-bold leading-tight text-[#0f172a]">{tituloClinica}</h1>
                  <p className="truncate text-[11px] font-medium text-[#64748b]">{subtituloClinica}</p>
                </div>
              </button>
            ) : (
              <div
                className="flex w-full items-center gap-3 border-b border-app-border px-6 pb-4 pt-2"
              >
                <div className="shrink-0 rounded-xl border border-white/30 bg-[#00a88e] p-2 shadow-sm">
                  {clinicaLogoResolved ? (
                    <img
                      src={clinicaLogoResolved}
                      alt="Logo"
                      className="h-10 w-10 rounded-xl object-cover"
                    />
                  ) : (
                    <Shield className="h-6 w-6 text-white" strokeWidth={2} />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <h1 className="truncate text-[19px] font-bold leading-tight text-[#0f172a]">{tituloClinica}</h1>
                  <p className="truncate text-[11px] font-medium text-[#64748b]">{subtituloClinica}</p>
                </div>
              </div>
            )}

            {canSeeConfig ? (
              <button
                type="button"
                onClick={() => onOpenPerfilSettings?.()}
                className="mx-4 mb-6 mt-4 flex w-[calc(100%-2rem)] items-center gap-3 rounded-[14px] border border-app-border bg-app-nav-active p-3 text-left shadow-app-card transition-colors hover:bg-[#e8f5f3] focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300/60"
                aria-label="Abrir perfil do profissional"
              >
                <div className="relative flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#00a88e] text-sm font-bold text-white">
                  {renderAvatarInner()}
                </div>
                <div className="min-w-0 flex-1">
                  <h2 className="truncate text-[14px] font-bold leading-tight text-app-accent-deep">{displayName}</h2>
                  <p className="truncate text-[12px] font-medium text-app-accent">{roleLabel}</p>
                </div>
              </button>
            ) : (
              <div
                className="mx-4 mb-6 mt-4 flex w-[calc(100%-2rem)] items-center gap-3 rounded-[14px] border border-app-border bg-app-nav-active p-3 shadow-app-card"
              >
                <div className="relative flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#00a88e] text-sm font-bold text-white">
                  {renderAvatarInner()}
                </div>
                <div className="min-w-0 flex-1">
                  <h2 className="truncate text-[14px] font-bold leading-tight text-app-accent-deep">{displayName}</h2>
                  <p className="truncate text-[12px] font-medium text-app-accent">{roleLabel}</p>
                </div>
              </div>
            )}

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
