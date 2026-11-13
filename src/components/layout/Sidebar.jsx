import React, { useEffect, useState } from 'react';
import '@fontsource/cormorant-garamond/latin-600.css';
import { ChevronDown, ChevronLeft, ChevronRight, LogOut, Menu } from 'lucide-react';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import { usePapelExibicao } from '../../contexts/PreviaAcessoContext';
import { ClinicaIdentityBlock } from './ClinicaIdentityBlock.jsx';
import { UsuarioIdentityCard, UsuarioAvatarInner } from './UsuarioIdentityCard.jsx';
import { ProcediSymbol } from './ProcediSymbol.jsx';
import { resolveIdentity } from './identityDisplay';
import { gruposVisiveis } from './navGrupos';

const FOCO = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-app-accent';

function nomeItem(item, pendenciasEquipe) {
  if (item.view !== 'gestao-equipe' || !(pendenciasEquipe > 0)) return undefined;
  return `${item.label} · ${pendenciasEquipe} ${pendenciasEquipe === 1 ? 'pendência' : 'pendências'}`;
}

function Ponto({ className = '' }) {
  return <span aria-hidden className={`h-2 w-2 shrink-0 rounded-full bg-red-500 ${className}`} />;
}

/** Menu do trilho recolhido (64px): sem títulos, um traço entre grupos. */
function NavTrilhoAgrupado({ grupos, activeView, irParaTela, pendenciasEquipe }) {
  return (
    <nav className="flex flex-1 flex-col gap-2 px-1 pt-1">
      {grupos.map((g, idx) => (
        <React.Fragment key={g.id}>
          {idx > 0 ? <div aria-hidden className="mx-auto h-px w-6 shrink-0 bg-app-border" /> : null}
          {g.itens.map((item) => {
            const NavIcon = item.icon;
            const aria = nomeItem(item, pendenciasEquipe);
            return (
              <button
                key={item.view}
                type="button"
                title={item.label}
                aria-label={aria}
                onClick={() => irParaTela(item.view)}
                className={`relative mx-auto flex h-10 w-10 toque:h-11 toque:w-11 items-center justify-center rounded-xl transition-all ${FOCO} ${
                  activeView === item.view
                    ? 'bg-emerald-50 text-app-accent-deep shadow-sm ring-1 ring-emerald-200/60'
                    : 'text-[#64748b] hover:bg-app-nav-hover active:bg-app-nav-active hover:text-app-accent-deep'
                }`}
              >
                <NavIcon className="h-5 w-5 shrink-0" strokeWidth={2} />
                {aria ? <Ponto className="absolute right-1 top-1" /> : null}
              </button>
            );
          })}
        </React.Fragment>
      ))}
    </nav>
  );
}

/** Menu expandido em grupos que abrem e fecham (estado em memória, vem do Sidebar). */
function NavGruposAbertos({ grupos, fechados, alternar, activeView, irParaTela, pendenciasEquipe }) {
  return (
    <nav className="flex flex-1 flex-col space-y-2 px-2 lg:px-4">
      {grupos.map((g) => {
        const aberto = !fechados[g.id];
        return (
          <div key={g.id} className="flex flex-col space-y-1">
            <button
              type="button"
              aria-expanded={aberto}
              onClick={() => alternar(g.id)}
              className={`flex w-full items-center justify-between gap-2 rounded-lg px-2 py-1 toque:min-h-[44px] text-left text-[11px] font-bold uppercase tracking-wide text-[#94a3b8] ${FOCO}`}
            >
              <span className="min-w-0 truncate">{g.titulo}</span>
              <ChevronDown
                className={`h-4 w-4 shrink-0 transition-transform ${aberto ? '' : '-rotate-90'}`}
                strokeWidth={2.25}
              />
            </button>
            {aberto
              ? g.itens.map((item) => {
                  const NavIcon = item.icon;
                  const aria = nomeItem(item, pendenciasEquipe);
                  return (
                    <button
                      key={item.view}
                      type="button"
                      title={item.label}
                      aria-label={aria}
                      onClick={() => irParaTela(item.view)}
                      className={`flex min-h-[44px] w-full items-center gap-3 rounded-xl pl-2 pr-4 py-3 text-left text-[14px] font-semibold transition-all border-l-2 ${FOCO} ${
                        activeView === item.view
                          ? 'border-l-app-accent bg-emerald-50 text-app-accent-deep'
                          : 'border-l-transparent bg-white text-[#64748b] hover:bg-app-nav-hover active:bg-app-nav-active hover:text-app-accent-deep'
                      }`}
                    >
                      <NavIcon className="h-5 w-5 shrink-0" strokeWidth={2} />
                      <span className="min-w-0 flex-1">{item.label}</span>
                      {aria ? <Ponto /> : null}
                    </button>
                  );
                })
              : null}
          </div>
        );
      })}
    </nav>
  );
}

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
 *   irParaTela: (v: string) => void,
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
 *   pendenciasEquipe?: number,
 * }} props
 */
export function Sidebar({
  activeView,
  irParaTela,
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
  pendenciasEquipe = 0,
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
  const isTabletSidebar = useMediaQuery('(min-width: 768px) and (max-width: 1023px)');
  const isDesktop = useMediaQuery('(min-width: 1024px)');
  const [tabletExpanded, setTabletExpanded] = useState(false);
  const [desktopCollapsed, setDesktopCollapsed] = useState(readDesktopCollapsed);
  const papel = usePapelExibicao();
  const { canSeeConfig } = papel;
  const grupos = gruposVisiveis(papel);
  const visibleNavItems = grupos.flatMap((g) => g.itens);
  const [fechados, setFechados] = useState({});
  const alternarGrupo = (id) => setFechados((f) => ({ ...f, [id]: !f[id] }));

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

  // --sidebar-w: largura real do menu (0 abaixo de 768px, onde ele fica escondido)
  const menuVisivel = isDesktop || isTabletSidebar;
  useEffect(() => {
    document.documentElement.style.setProperty('--sidebar-w', menuVisivel ? `${railWidthPx}px` : '0px');
  }, [railWidthPx, menuVisivel]);

  const asideZ = isTabletSidebar && tabletExpanded ? 'relative z-[100]' : 'relative z-auto';

  const openRailWide = () => {
    if (isTabletSidebar) setTabletExpanded(true);
    if (isDesktop) setDesktopCollapsed(false);
  };

  const mostrarBotaoFio = identidadeNoHeader && (isDesktop || isTabletSidebar);
  const alternarMenu = () => {
    if (narrowRail) openRailWide();
    else if (isDesktop) setDesktopCollapsed(true);
    else setTabletExpanded(false);
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

      <div className={`relative hidden h-full shrink-0 md:flex transition-[width] duration-200 ease-out ${railW} ${asideZ}`}>
      {mostrarBotaoFio ? (
        <button
          type="button"
          onClick={alternarMenu}
          className={`procedi-menu-botao absolute -right-[15px] top-[70.5px] z-[45] ${FOCO}`}
          aria-label={narrowRail ? 'Abrir menu' : 'Recolher menu'}
          title={narrowRail ? 'Abrir menu' : 'Recolher menu'}
          aria-expanded={!narrowRail}
        >
          {narrowRail ? <ChevronRight className="h-4 w-4" strokeWidth={2} aria-hidden /> : <ChevronLeft className="h-4 w-4" strokeWidth={2} aria-hidden />}
        </button>
      ) : null}
      <aside
        className={`relative flex h-full w-full flex-col overflow-hidden border-r border-app-border ${identidadeNoHeader ? 'procedi-menu-fundo' : 'bg-white'} shadow-app-sidebar`}
      >
        {narrowRail ? (
          <>
            <div className={identidadeNoHeader ? 'procedi-marca procedi-marca--recolhida w-full' : 'flex w-full flex-col items-center border-b border-app-border pb-2 pt-1 transition-opacity duration-200'}>
              <button
                type="button"
                onClick={openRailWide}
                className={identidadeNoHeader
                  ? `flex h-full w-full items-center justify-center ${FOCO}`
                  : `mx-auto mt-3 flex h-10 w-10 toque:h-11 toque:w-11 items-center justify-center rounded-xl text-[#64748b] transition-all hover:bg-app-nav-hover active:bg-app-nav-active hover:text-app-accent-deep ${FOCO}`}
                aria-label="Expandir menu"
                title="Menu"
              >
                {identidadeNoHeader ? (
                  <span className="procedi-marca-simbolo"><ProcediSymbol viewBox="8.5 1.5 15 29" className="h-[30px] w-[15.5px] shrink-0" /></span>
                ) : (
                  <Menu className="h-5 w-5 shrink-0" strokeWidth={2.25} />
                )}
              </button>
            </div>

            {!identidadeNoHeader ? (
              <div className="flex justify-center py-3" data-testid="sidebar-rail-avatar">
                {canSeeConfig || typeof onOpenPerfilSettings === 'function' ? (
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
            ) : null}

            {identidadeNoHeader ? (
              <NavTrilhoAgrupado
                grupos={grupos}
                activeView={activeView}
                irParaTela={irParaTela}
                pendenciasEquipe={pendenciasEquipe}
              />
            ) : (
            <nav className="flex flex-1 flex-col gap-2 px-1 pt-1">
              {visibleNavItems.map((item) => {
                const NavIcon = item.icon;
                return (
                  <button
                    key={item.view}
                    type="button"
                    title={item.label}
                    onClick={() => irParaTela(item.view)}
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
            )}

            <div className="mt-auto border-t border-app-border p-3">
              <button
                type="button"
                title="Sair do Sistema"
                onClick={handleLogout}
                className={`mx-auto flex h-10 w-10 toque:h-11 toque:w-11 items-center justify-center rounded-xl text-[#ef4444] transition-all hover:bg-red-50 active:bg-red-100 ${FOCO}`}
              >
                <LogOut className="h-5 w-5 shrink-0" strokeWidth={2.5} />
              </button>
            </div>
          </>
        ) : null}

        {!narrowRail && isDesktop ? (
          <>
            <div className={identidadeNoHeader ? 'procedi-marca' : 'flex items-center gap-2 border-b border-app-border p-4 pl-4 pr-3 transition-opacity duration-200'}>
              {identidadeNoHeader ? (
                <div className="flex min-w-0 flex-1 items-center gap-2" data-testid="sidebar-brand">
                  <span className="procedi-marca-simbolo"><ProcediSymbol viewBox="8.5 1.5 15 29" className="h-[42px] w-[21.7px] shrink-0" /></span>
                  <span className="procedi-marca-nome font-brand">Procedi</span>
                </div>
              ) : (
                <ClinicaIdentityBlock
                  variant="sidebar-desktop"
                  tituloClinica={tituloClinica}
                  clinicaLogoResolved={clinicaLogoResolved}
                  canSeeConfig={canSeeConfig}
                  onOpenClinicaSettings={onOpenClinicaSettings}
                />
              )}
              {!identidadeNoHeader ? (
                <button
                  type="button"
                  onClick={() => setDesktopCollapsed(true)}
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-app-border text-[#64748b] transition-all hover:bg-app-nav-hover active:bg-app-nav-active hover:text-app-accent-deep"
                  aria-label="Recolher menu"
                  title="Recolher"
                >
                  <ChevronLeft className="h-5 w-5 shrink-0" strokeWidth={2.25} />
                </button>
              ) : null}
            </div>

            {!identidadeNoHeader ? (
              <UsuarioIdentityCard
                variant="sidebar"
                displayName={displayName}
                shortName={shortName}
                perfilFotoResolved={perfilFotoResolved}
                roleLabel={roleLabel}
                canSeeConfig={canSeeConfig}
                onOpenPerfilSettings={onOpenPerfilSettings}
              />
            ) : null}

            {identidadeNoHeader ? (
              <NavGruposAbertos
                grupos={grupos}
                fechados={fechados}
                alternar={alternarGrupo}
                activeView={activeView}
                irParaTela={irParaTela}
                pendenciasEquipe={pendenciasEquipe}
              />
            ) : (
            <nav className="flex flex-1 flex-col space-y-2 px-2 lg:px-4">
              {visibleNavItems.map((item) => {
                const NavIcon = item.icon;
                return (
                  <button
                    key={item.view}
                    type="button"
                    title={item.label}
                    onClick={() => irParaTela(item.view)}
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
            )}

            <div className="border-t border-app-border p-4">
              <button
                type="button"
                onClick={handleLogout}
                className={`flex min-h-[44px] w-full items-center gap-3 rounded-xl px-4 py-3 text-[14px] font-bold text-[#ef4444] transition-all hover:bg-red-50 active:bg-red-100 ${FOCO}`}
              >
                <LogOut className="h-5 w-5 shrink-0" strokeWidth={2.5} />
                <span>Sair do Sistema</span>
              </button>
            </div>
          </>
        ) : null}

        {!narrowRail && isTabletSidebar && tabletExpanded ? (
          <>
            <div className={identidadeNoHeader ? 'procedi-marca w-full' : 'flex w-full items-center gap-2 border-b border-app-border px-4 pt-3'}>
              {!identidadeNoHeader ? (
                <button
                  type="button"
                  onClick={() => setTabletExpanded(false)}
                  className={`flex h-10 w-10 toque:h-11 toque:w-11 shrink-0 items-center justify-center rounded-xl text-[#64748b] transition-all hover:bg-app-nav-hover active:bg-app-nav-active hover:text-app-accent-deep ${FOCO}`}
                  aria-label="Recolher menu"
                  title="Recolher"
                >
                  <ChevronLeft className="h-5 w-5 shrink-0" strokeWidth={2.25} />
                </button>
              ) : null}
              {identidadeNoHeader ? (
                <div className="flex min-w-0 flex-1 items-center gap-2" data-testid="sidebar-tablet-brand">
                  <span className="procedi-marca-simbolo"><ProcediSymbol viewBox="8.5 1.5 15 29" className="h-[42px] w-[21.7px] shrink-0" /></span>
                  <span className="procedi-marca-nome font-brand">Procedi</span>
                </div>
              ) : null}
            </div>

            {!identidadeNoHeader ? (
              <>
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
              </>
            ) : null}

            {identidadeNoHeader ? (
              <NavGruposAbertos
                grupos={grupos}
                fechados={fechados}
                alternar={alternarGrupo}
                activeView={activeView}
                irParaTela={irParaTela}
                pendenciasEquipe={pendenciasEquipe}
              />
            ) : (
            <nav className="flex flex-1 flex-col space-y-2 px-2 lg:px-4">
              {visibleNavItems.map((item) => {
                const NavIcon = item.icon;
                return (
                  <button
                    key={item.view}
                    type="button"
                    title={item.label}
                    onClick={() => irParaTela(item.view)}
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
            )}

            <div className="border-t border-app-border p-4">
              <button
                type="button"
                onClick={handleLogout}
                className={`flex min-h-[44px] w-full items-center gap-3 rounded-xl px-4 py-3 text-[14px] font-bold text-[#ef4444] transition-all hover:bg-red-50 active:bg-red-100 ${FOCO}`}
              >
                <LogOut className="h-5 w-5 shrink-0" strokeWidth={2.5} />
                <span>Sair do Sistema</span>
              </button>
            </div>
          </>
        ) : null}
      </aside>
      </div>
    </>
  );
}
