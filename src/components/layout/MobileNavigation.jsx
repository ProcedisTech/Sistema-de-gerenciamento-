import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { CalendarDays, LogOut, Menu, UserCog, Users, X } from 'lucide-react';
import { ProcediSymbol } from './ProcediSymbol.jsx';
import { useNavGrupos } from './navGrupos.js';

const VIEW_EQUIPE = 'gestao-equipe';
const FOCO = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-app-accent-deep';

function Ponto({ className = '' }) {
  return <span aria-hidden className={`h-2 w-2 shrink-0 rounded-full bg-red-500 ${className}`} />;
}

const nomePendencia = (label, n) => `${label} · ${n} ${n === 1 ? 'pendência' : 'pendências'}`;

export function MobileNavigation({ activeView, irParaTela, onLogout, pendenciasEquipe = 0, pathname }) {
  const grupos = useNavGrupos();
  const [aberto, setAberto] = useState(false);
  const [pathAnterior, setPathAnterior] = useState(pathname);
  // Ajuste durante o render: mudar de rota fecha o menu.
  if (pathname !== pathAnterior) {
    setPathAnterior(pathname);
    setAberto(false);
  }
  const menuBtnRef = useRef(null);
  const fecharRef = useRef(null);
  const painelRef = useRef(null);
  const fechar = () => {
    setAberto(false);
    menuBtnRef.current?.focus();
  };
  const temEquipe = grupos.some((g) => g.itens.some((i) => i.view === VIEW_EQUIPE));

  useEffect(() => {
    if (!aberto) return undefined;
    fecharRef.current?.focus();
    const onKey = (e) => {
      if (e.key === 'Escape') return fechar();
      if (e.key !== 'Tab') return;
      // Tab circular dentro do painel
      const f = painelRef.current?.querySelectorAll('button');
      if (!f?.length) return;
      const [a, z] = [f[0], f[f.length - 1]];
      if (e.shiftKey && document.activeElement === a) { e.preventDefault(); z.focus(); }
      else if (!e.shiftKey && document.activeElement === z) { e.preventDefault(); a.focus(); }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [aberto]);

  const tabClass = (isActive) =>
    `flex min-h-[44px] flex-1 flex-col items-center justify-center gap-0.5 rounded-xl border px-0.5 py-1 transition-all ${FOCO} ${
      isActive
        ? 'border-app-border bg-app-nav-active text-app-accent-deep shadow-sm'
        : 'border-transparent bg-white text-[#64748b] hover:bg-app-nav-hover active:bg-app-nav-active'
    }`;

  const escolher = (view) => {
    setAberto(false);
    irParaTela(view);
  };

  const temPendencia = pendenciasEquipe > 0;

  return (
    <>
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-[130] h-[calc(4rem+env(safe-area-inset-bottom))] border-t border-app-border bg-white shadow-app-card pb-[env(safe-area-inset-bottom)]">
        <div className="flex h-full items-stretch justify-between gap-1 px-1.5 py-1 sm:px-2">
          <button type="button" onClick={() => irParaTela('pacientes')} className={tabClass(activeView === 'pacientes')} aria-current={activeView === 'pacientes' ? 'page' : undefined}>
            <Users className="h-5 w-5 shrink-0" strokeWidth={2.5} />
            <span className="text-[10px] font-bold leading-tight">Pacientes</span>
          </button>
          <button type="button" onClick={() => irParaTela('agenda')} className={tabClass(activeView === 'agenda')} aria-current={activeView === 'agenda' ? 'page' : undefined}>
            <CalendarDays className="h-5 w-5 shrink-0" strokeWidth={2.5} />
            <span className="text-[10px] font-bold leading-tight">Agenda</span>
          </button>
          {temEquipe && (
            <button
              type="button"
              onClick={() => irParaTela(VIEW_EQUIPE)}
              className={tabClass(activeView === VIEW_EQUIPE)}
              aria-current={activeView === VIEW_EQUIPE ? 'page' : undefined}
              aria-label={temPendencia ? nomePendencia('Equipe', pendenciasEquipe) : undefined}
            >
              <span className="relative flex shrink-0">
                <UserCog className="h-5 w-5 shrink-0" strokeWidth={2.5} />
                {temPendencia && <Ponto className="absolute -right-1 -top-0.5" />}
              </span>
              <span className="text-[10px] font-bold leading-tight">Equipe</span>
            </button>
          )}
          <button
            ref={menuBtnRef}
            type="button"
            onClick={() => setAberto(true)}
            className={tabClass(false)}
            aria-haspopup="dialog"
            aria-expanded={aberto}
          >
            <Menu className="h-5 w-5 shrink-0" strokeWidth={2.5} />
            <span className="text-[10px] font-bold leading-tight">Menu</span>
          </button>
        </div>
      </div>

      {aberto &&
        createPortal(
          <div className="fixed inset-0 z-[200] md:hidden">
            <div data-testid="menu-fundo" className="absolute inset-0 bg-black/40" onClick={fechar} />
            <div ref={painelRef} role="dialog" aria-modal="true" aria-label="Menu" className="absolute inset-y-0 left-0 flex w-[300px] max-w-[86vw] flex-col procedi-menu-fundo shadow-xl">
              <div className="procedi-marca justify-between">
                <span className="flex items-center gap-3">
                  <span className="procedi-marca-simbolo"><ProcediSymbol viewBox="8.5 1.5 15 29" className="h-[42px] w-[21.7px] shrink-0" /></span>
                  <span className="procedi-marca-nome font-brand">Procedi</span>
                </span>
                <button ref={fecharRef} type="button" onClick={fechar} aria-label="Fechar menu" className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${FOCO}`}>
                  <X className="h-5 w-5 shrink-0" />
                </button>
              </div>
              <nav className="flex-1 overflow-y-auto px-3 py-3">
                {grupos.map((g) => (
                  <div key={g.id} className="mb-3">
                    <p className="px-2 pb-1 text-[11px] font-bold uppercase tracking-wide text-[#64748b]">{g.titulo}</p>
                    {g.itens.map(({ view, label, icon: Icon }) => {
                      const ativo = activeView === view;
                      const pend = view === VIEW_EQUIPE && temPendencia;
                      return (
                        <button
                          key={view}
                          type="button"
                          onClick={() => escolher(view)}
                          aria-current={ativo ? 'page' : undefined}
                          aria-label={pend ? nomePendencia(label, pendenciasEquipe) : undefined}
                          className={`flex min-h-[44px] w-full items-center gap-3 rounded-xl px-2 text-left text-sm font-semibold ${FOCO} ${ativo ? 'bg-app-nav-active text-app-accent-deep' : 'text-[#334155] hover:bg-app-nav-hover'}`}
                        >
                          {Icon && <Icon className="h-5 w-5 shrink-0" strokeWidth={2.5} />}
                          <span className="min-w-0 flex-1 truncate">{label}</span>
                          {pend && <Ponto />}
                        </button>
                      );
                    })}
                  </div>
                ))}
              </nav>
              <div className="border-t border-app-border p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
                <button
                  type="button"
                  onClick={() => {
                    setAberto(false);
                    onLogout();
                  }}
                  className={`flex min-h-[44px] w-full items-center gap-3 rounded-xl px-2 text-sm font-semibold text-[#ef4444] hover:bg-red-50 ${FOCO}`}
                >
                  <LogOut className="h-5 w-5 shrink-0" strokeWidth={2.5} />
                  Sair do Sistema
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
