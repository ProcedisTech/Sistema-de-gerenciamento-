import React, { useState } from 'react';
import { Minimize2, Trash2, Check, ChevronLeft, ChevronRight } from 'lucide-react';
import { getVistaLabel } from '../../../constants/vistasMapeamento.js';
import { useMediaQuery } from '../../../hooks/useMediaQuery.js';
import { MapeamentoFullscreenProcedimentoToggle } from './MapeamentoFullscreenProcedimentoPanel.jsx';

const DEFAULT_TOOLBAR_WIDTH_PX = 220;

function stopBubble(e) {
  e.stopPropagation();
}

function ToolbarIconButton({ icon, label, onClick, disabled = false, active = false, danger = false }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onPointerDown={stopBubble}
      onClick={(e) => {
        stopBubble(e);
        if (!disabled) onClick?.(e);
      }}
      className={`flex min-h-[44px] w-full items-center justify-center rounded-xl transition-all disabled:cursor-not-allowed disabled:opacity-40 ${
        active
          ? 'border-l-2 border-l-app-accent bg-emerald-50 text-app-accent-deep'
          : danger
            ? 'text-[#ef4444] hover:bg-red-50 active:bg-red-100'
            : 'border-l-2 border-l-transparent text-[#64748b] hover:bg-app-nav-hover active:bg-app-nav-active hover:text-app-accent-deep'
      }`}
    >
      {React.createElement(icon, { className: 'h-5 w-5 shrink-0', strokeWidth: 2, 'aria-hidden': true })}
    </button>
  );
}

export function MapeamentoFullscreenToolbar({
  vistaAtual,
  toolbarWidthPx = DEFAULT_TOOLBAR_WIDTH_PX,
  procedimentoArmado,
  panelOpen,
  onToggleProcedimentoPanel,
  countPontosVista = 0,
  onClose,
  configMarcacao,
  setConfigMarcacao,
  unidadeMedida,
  onClearVista,
  hideProcedimentoPicker,
  isMobileDrawer = false,
  drawerOpen = false,
  onCloseDrawer,
}) {
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const isMdUp = useMediaQuery('(min-width: 768px)');
  
  const showAsDrawer = !isMdUp || isMobileDrawer;
  
  if (showAsDrawer && !drawerOpen) return null;

  const collapsed = !showAsDrawer && isCollapsed;
  const currentWidth = collapsed ? 64 : toolbarWidthPx;
  const widthStyle = showAsDrawer ? { width: toolbarWidthPx } : { width: currentWidth, minWidth: currentWidth };

  return (
    <>
      {showAsDrawer && (
        <div 
          className="fixed inset-0 z-[140] bg-black/40" 
          onClick={onCloseDrawer} 
        />
      )}
      <aside
        style={widthStyle}
        className={`flex h-full flex-col overflow-y-auto overflow-x-hidden border-r border-app-border bg-white shadow-app-sidebar transition-all duration-300 ${
          showAsDrawer ? 'fixed left-0 top-0 bottom-0 z-[150]' : 'relative shrink-0 z-10'
        }`}
        onPointerDown={stopBubble}
        onClick={stopBubble}
      >
        <div className={`border-b border-app-border flex items-center justify-between ${collapsed ? 'px-1 py-3 flex-col gap-3' : 'px-3 py-4'}`}>
          {collapsed ? (
            <>
              <button onClick={() => setIsCollapsed(false)} className="rounded-lg p-1.5 hover:bg-slate-100 text-slate-500 mx-auto">
                <ChevronRight className="h-4 w-4" />
              </button>
              <p
                className="mx-auto max-w-[2.5rem] truncate text-center text-[9px] font-bold uppercase leading-tight tracking-wide text-[#64748b]"
                title={vistaAtual ? getVistaLabel(vistaAtual) : 'Vista'}
              >
                {vistaAtual ? getVistaLabel(vistaAtual).split(' ')[0] : 'Vista'}
              </p>
            </>
          ) : (
            <>
              <div className="min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-[#94a3b8]">Mapeamento</p>
                <h3 className="mt-0.5 line-clamp-2 text-[14px] font-bold leading-snug text-app-accent-deep">
                  {vistaAtual ? getVistaLabel(vistaAtual) : 'Vista'}
                </h3>
              </div>
              {!showAsDrawer && (
                <button onClick={() => setIsCollapsed(true)} className="rounded-lg p-1.5 hover:bg-slate-100 text-slate-500 shrink-0">
                  <ChevronLeft className="h-4 w-4" />
                </button>
              )}
            </>
          )}
        </div>

        <div className={`flex flex-1 flex-col gap-1 py-2 ${collapsed ? 'px-1' : 'px-2'}`}>
          {!hideProcedimentoPicker && (
            <MapeamentoFullscreenProcedimentoToggle
              panelOpen={panelOpen}
              procedimentoArmado={procedimentoArmado}
              onToggle={onToggleProcedimentoPanel}
              narrow={collapsed}
            />
          )}

          {!collapsed && configMarcacao && setConfigMarcacao && (
            <div className="mt-2 flex flex-col rounded-xl border border-slate-200 bg-slate-50 p-3 text-left shadow-sm mx-1">
              <p className="mb-3 text-[10px] font-bold uppercase tracking-wider text-slate-500">Config do Ponto</p>

              <label className="mb-2 block">
                <span className="mb-1 block text-[11px] font-semibold text-slate-600">Dose padrão</span>
                <div className="relative">
                  <input
                    type="number"
                    min="0.1"
                    step="0.1"
                    value={configMarcacao.dosePadrao}
                    onChange={(e) => setConfigMarcacao({ ...configMarcacao, dosePadrao: Number(e.target.value) || 1 })}
                    className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-[13px] font-medium text-slate-700 shadow-sm outline-none transition-colors focus:border-app-accent focus:ring-1 focus:ring-app-accent"
                  />
                  {unidadeMedida && (
                    <span className="absolute inset-y-0 right-2 flex items-center text-[12px] font-medium text-slate-400 pointer-events-none uppercase">
                      {unidadeMedida}
                    </span>
                  )}
                </div>
              </label>

              <label className="mb-3 block">
                <span className="mb-1 flex items-center justify-between text-[11px] font-semibold text-slate-600">
                  Profundidade <span className="text-[10px] font-medium text-slate-400">(Opcional)</span>
                </span>
                <div className="relative">
                  <input
                    type="number"
                    min="0.1"
                    step="0.1"
                    value={configMarcacao.profundidade}
                    onChange={(e) => setConfigMarcacao({ ...configMarcacao, profundidade: e.target.value })}
                    placeholder="Ex: 2.0"
                    className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-[13px] font-medium text-slate-700 shadow-sm outline-none transition-colors focus:border-app-accent focus:ring-1 focus:ring-app-accent"
                  />
                  <span className="absolute inset-y-0 right-2 flex items-center text-[12px] font-medium text-slate-400 pointer-events-none">
                    mm
                  </span>
                </div>
              </label>

              <div className="my-1 border-t border-slate-200/80"></div>

              <label className="mt-3 flex cursor-pointer flex-col gap-1.5 group">
                <div className="flex items-center justify-between">
                  <span className="text-[12px] font-semibold text-slate-700">Confirmar a cada clique</span>
                  <div
                    className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full transition-colors duration-200 ease-in-out focus:outline-none focus-visible:ring-2 focus-visible:ring-app-accent focus-visible:ring-offset-2 ${
                      configMarcacao.confirmarDose ? 'bg-app-accent' : 'bg-slate-300'
                    }`}
                    role="switch"
                    aria-checked={configMarcacao.confirmarDose}
                    onClick={() => setConfigMarcacao({ ...configMarcacao, confirmarDose: !configMarcacao.confirmarDose })}
                  >
                    <span
                      className={`pointer-events-none inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                        configMarcacao.confirmarDose ? 'translate-x-4.5' : 'translate-x-1'
                      }`}
                      style={{ transform: `translateX(${configMarcacao.confirmarDose ? '18px' : '3px'})` }}
                    />
                  </div>
                </div>
                
                {!configMarcacao.confirmarDose ? (
                  <div className="mt-1 flex items-center gap-1 text-[11px] font-bold text-emerald-600 bg-emerald-50/80 px-1.5 py-1 rounded w-fit">
                    <span className="text-[10px]">⚡</span> Fricção Zero
                  </div>
                ) : (
                  <span className="text-[10px] leading-tight text-slate-500">
                    Abre popup pedindo a dose a cada marcação na foto.
                  </span>
                )}
              </label>
            </div>
          )}
        </div>

        <div className={`mt-auto border-t border-app-border ${collapsed ? 'p-1' : 'p-3'}`}>
          {!collapsed && (
            <>
              {showClearConfirm ? (
                <div className="mb-3 rounded-lg border border-red-200 bg-red-50 p-2 text-center text-[11px]">
                  <p className="font-semibold text-red-800">Limpar esta vista?</p>
                  <div className="mt-2 flex gap-2">
                    <button
                      onClick={() => {
                        onClearVista?.();
                        setShowClearConfirm(false);
                      }}
                      className="flex-1 rounded border border-red-200 bg-white py-1 font-bold text-red-600 shadow-sm hover:bg-red-50"
                    >
                      Sim
                    </button>
                    <button
                      onClick={() => setShowClearConfirm(false)}
                      className="flex-1 rounded border border-slate-200 bg-white py-1 font-bold text-slate-600 shadow-sm hover:bg-slate-50"
                    >
                      Não
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowClearConfirm(true)}
                  disabled={countPontosVista === 0}
                  className="mb-3 flex w-full items-center justify-center gap-1.5 rounded-lg border border-transparent px-3 py-2 text-[12px] font-semibold text-red-600 transition-colors hover:bg-red-50 hover:text-red-700 disabled:opacity-50 disabled:hover:bg-transparent"
                >
                  <Trash2 className="h-4 w-4" />
                  Limpar Vista
                </button>
              )}
            </>
          )}

          <button
            type="button"
            aria-label="Sair da tela cheia"
            title="Sair"
            onPointerDown={stopBubble}
            onClick={(e) => {
              stopBubble(e);
              onClose?.();
            }}
            className={`flex w-full items-center justify-center rounded-xl text-[#64748b] transition-all hover:bg-app-nav-hover active:bg-app-nav-active hover:text-app-accent-deep ${
              collapsed ? 'h-10 mx-auto' : 'min-h-[44px] gap-3 px-2'
            }`}
          >
            <Minimize2 className="h-5 w-5 shrink-0" strokeWidth={2} aria-hidden />
            {!collapsed && <span className="text-[13px] font-semibold">Sair</span>}
          </button>
        </div>
      </aside>
    </>
  );
}