import React, { useCallback, useRef, useState } from 'react';
import {
  Minimize2,
  Trash2,
  ChevronLeft,
  ChevronRight,
  ImageOff,
  MousePointer2,
  Hand,
  MoveDiagonal,
  Eraser,
  Eye,
  EyeOff,
  Undo2,
  FileText,
  Settings2,
} from 'lucide-react';
import { getVistaLabel } from '../../../constants/vistasMapeamento.js';
import { useMediaQuery } from '../../../hooks/useMediaQuery.js';
import { MapeamentoFullscreenProcedimentoToggle } from './MapeamentoFullscreenProcedimentoPanel.jsx';
import { MapeamentoFullscreenConfigPopover } from './MapeamentoFullscreenConfigPopover.jsx';
import {
  persistSidebarCollapsed,
  readStoredSidebarCollapsed,
} from './mapeamentoFullscreenSidebarStorage.js';

const DEFAULT_TOOLBAR_WIDTH_PX = 240;
const COLLAPSED_WIDTH_PX = 48;

const FERRAMENTAS = [
  { id: 'ponto', label: 'Ponto', shortcut: 'P', Icon: MousePointer2 },
  { id: 'mover', label: 'Mover', shortcut: 'M', Icon: Hand },
  { id: 'traco', label: 'Traço', shortcut: 'T', Icon: MoveDiagonal },
  { id: 'borracha', label: 'Borracha', shortcut: 'B', Icon: Eraser },
];

function stopBubble(e) {
  e.stopPropagation();
}

function toolButtonClass(active, compact) {
  const base = compact
    ? 'flex h-10 w-10 items-center justify-center rounded-lg transition-colors'
    : 'flex items-center gap-1.5 rounded-md px-2.5 py-2 text-[12px] font-semibold transition-colors';
  if (active) {
    return `${base} border border-app-border bg-white text-app-accent shadow-sm`;
  }
  return `${base} border border-transparent text-[#64748b] hover:text-[#334155]`;
}

function ConfigFields({
  modo,
  configMarcacao,
  setConfigMarcacao,
  unidadeMedida,
  tamanho,
  setTamanho,
  compact = false,
}) {
  if (modo === 'mover') {
    return (
      <p className="text-[11px] leading-snug text-slate-500">
        Arraste a foto para reposicionar. Use o scroll ou pinch para zoom.
      </p>
    );
  }
  if (modo === 'borracha') {
    return (
      <p className="text-[11px] leading-snug text-slate-500">
        Clique em um ponto ou traço para apagá-lo.
      </p>
    );
  }

  const showDose = modo === 'ponto' && configMarcacao && setConfigMarcacao;
  const showTamanho = (modo === 'ponto' || modo === 'traco') && typeof setTamanho === 'function';

  return (
    <div className={`flex flex-col ${compact ? 'gap-2' : 'gap-2.5'}`}>
      {modo === 'traco' ? (
        <p className="text-[11px] leading-snug text-slate-500">
          A espessura da linha é fixa; o tamanho controla o ponto nas extremidades.
        </p>
      ) : null}

      {showDose ? (
        <>
          <label className="block">
            <span className="mb-1 block text-[11px] font-semibold text-slate-600">Dose padrão</span>
            <div className="relative">
              <input
                type="number"
                min="0.1"
                step="0.1"
                value={configMarcacao.dosePadrao}
                onChange={(e) =>
                  setConfigMarcacao({ ...configMarcacao, dosePadrao: Number(e.target.value) || 1 })
                }
                className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-[13px] font-medium text-slate-700 shadow-sm outline-none focus:border-app-accent focus:ring-1 focus:ring-app-accent"
              />
              {unidadeMedida ? (
                <span className="pointer-events-none absolute inset-y-0 right-2 flex items-center text-[12px] font-medium uppercase text-slate-400">
                  {unidadeMedida}
                </span>
              ) : null}
            </div>
          </label>

          <label className="block">
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
                className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-[13px] font-medium text-slate-700 shadow-sm outline-none focus:border-app-accent focus:ring-1 focus:ring-app-accent"
              />
              <span className="pointer-events-none absolute inset-y-0 right-2 flex items-center text-[12px] font-medium text-slate-400">
                mm
              </span>
            </div>
          </label>

          <label className="mt-1 flex cursor-pointer flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[12px] font-semibold text-slate-700">Confirmar a cada clique</span>
              <button
                type="button"
                role="switch"
                aria-checked={configMarcacao.confirmarDose}
                aria-label="Confirmar a cada clique"
                onClick={() =>
                  setConfigMarcacao({
                    ...configMarcacao,
                    confirmarDose: !configMarcacao.confirmarDose,
                  })
                }
                className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${
                  configMarcacao.confirmarDose ? 'bg-app-accent' : 'bg-slate-300'
                }`}
              >
                <span
                  className="pointer-events-none inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition"
                  style={{ transform: `translateX(${configMarcacao.confirmarDose ? '18px' : '3px'})` }}
                />
              </button>
            </div>
            {!configMarcacao.confirmarDose ? (
              <span className="w-fit rounded bg-emerald-50/80 px-1.5 py-1 text-[11px] font-bold text-emerald-600">
                Fricção Zero
              </span>
            ) : (
              <span className="text-[10px] leading-tight text-slate-500">
                Abre popup pedindo a dose a cada marcação na foto.
              </span>
            )}
          </label>
        </>
      ) : null}

      {showTamanho ? (
        <label className="block">
          <span className="mb-1 block text-[11px] font-semibold text-slate-600">Tamanho do marcador</span>
          <input
            type="range"
            min="0.5"
            max="1.5"
            step="0.1"
            value={tamanho ?? 1.0}
            onChange={(e) => setTamanho?.(Number(e.target.value))}
            className="w-full accent-app-accent"
            aria-label="Tamanho do marcador"
          />
        </label>
      ) : null}
    </div>
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
  onRemoverFotoVista,
  hasFoto = false,
  hideProcedimentoPicker,
  isMobileDrawer = false,
  drawerOpen = false,
  onCloseDrawer,
  modo = 'ponto',
  setModo,
  tamanho,
  setTamanho,
  mostrarValores = false,
  onToggleMostrarValores,
  onDesfazerUltimo,
  onOpenResumo,
  configPopoverOpen = false,
  onConfigPopoverOpenChange,
}) {
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [showRemoverFotoConfirm, setShowRemoverFotoConfirm] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(() => readStoredSidebarCollapsed());
  const configAnchorRef = useRef(null);
  const isMdUp = useMediaQuery('(min-width: 768px)');

  const showAsDrawer = !isMdUp || isMobileDrawer;

  const setCollapsedPersisted = useCallback((next) => {
    setIsCollapsed(next);
    persistSidebarCollapsed(next);
  }, []);

  if (showAsDrawer && !drawerOpen) return null;

  const collapsed = !showAsDrawer && isCollapsed;
  const currentWidth = collapsed ? COLLAPSED_WIDTH_PX : toolbarWidthPx;
  const widthStyle = showAsDrawer
    ? { width: toolbarWidthPx }
    : { width: currentWidth, minWidth: currentWidth };

  const doseBadge =
    configMarcacao?.dosePadrao != null ? String(configMarcacao.dosePadrao) : '1';

  const closeConfirms = () => {
    setShowClearConfirm(false);
    setShowRemoverFotoConfirm(false);
  };

  const configTitle =
    modo === 'ponto'
      ? 'Config — Ponto'
      : modo === 'traco'
        ? 'Config — Traço'
        : modo === 'mover'
          ? 'Ajuda — Mover'
          : 'Ajuda — Borracha';

  return (
    <>
      {showAsDrawer ? (
        <div className="fixed inset-0 z-[140] bg-black/40" onClick={onCloseDrawer} aria-hidden />
      ) : null}
      <aside
        style={widthStyle}
        className={`flex h-full flex-col overflow-y-auto overflow-x-hidden border-r border-app-border bg-white shadow-app-sidebar transition-all duration-300 ${
          showAsDrawer ? 'fixed left-0 top-0 bottom-0 z-[150]' : 'relative shrink-0 z-10'
        }`}
        onPointerDown={stopBubble}
        onClick={stopBubble}
      >
        {/* Header */}
        <div
          className={`flex items-center justify-between border-b border-app-border ${
            collapsed ? 'flex-col gap-2 px-0.5 py-2' : 'px-3 py-3'
          }`}
        >
          {collapsed ? (
            <button
              type="button"
              aria-label="Expandir sidebar"
              title="Expandir sidebar"
              onClick={() => setCollapsedPersisted(false)}
              className="mx-auto rounded-lg p-1.5 text-slate-500 hover:bg-slate-100"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          ) : (
            <>
              <div className="min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-[#94a3b8]">
                  Mapeamento
                </p>
                <h3 className="mt-0.5 line-clamp-2 text-[14px] font-bold leading-snug text-app-accent-deep">
                  {vistaAtual ? getVistaLabel(vistaAtual) : 'Vista'}
                </h3>
              </div>
              {!showAsDrawer ? (
                <button
                  type="button"
                  aria-label="Recolher sidebar"
                  title="Recolher sidebar"
                  onClick={() => setCollapsedPersisted(true)}
                  className="shrink-0 rounded-lg p-1.5 text-slate-500 hover:bg-slate-100"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
              ) : null}
            </>
          )}
        </div>

        <div className={`flex flex-1 flex-col gap-2 py-2 ${collapsed ? 'items-center px-0.5' : 'px-2'}`}>
          {!hideProcedimentoPicker ? (
            <MapeamentoFullscreenProcedimentoToggle
              panelOpen={panelOpen}
              procedimentoArmado={procedimentoArmado}
              onToggle={onToggleProcedimentoPanel}
              narrow={collapsed}
            />
          ) : null}

          {/* FERRAMENTAS */}
          <div className={collapsed ? 'flex flex-col items-center gap-1' : ''}>
            {!collapsed ? (
              <p className="mb-1 px-1 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                Ferramentas
              </p>
            ) : null}
            <div className={collapsed ? 'flex flex-col gap-1' : 'grid grid-cols-2 gap-1.5'}>
              {FERRAMENTAS.map((tool) => {
                const { id, label, shortcut } = tool;
                const active = modo === id;
                const tip = `${label} (${shortcut})`;
                return (
                  <button
                    key={id}
                    type="button"
                    aria-label={tip}
                    title={tip}
                    aria-pressed={active}
                    onClick={() => setModo?.(id)}
                    className={toolButtonClass(active, collapsed)}
                  >
                    {React.createElement(tool.Icon, {
                      className: 'h-3.5 w-3.5 shrink-0',
                      strokeWidth: 2,
                      'aria-hidden': true,
                    })}
                    {!collapsed ? <span>{label}</span> : null}
                  </button>
                );
              })}
            </div>
          </div>

          {/* CONFIG */}
          {collapsed ? (
            <>
              <button
                ref={configAnchorRef}
                type="button"
                aria-label={`Configuração. Dose ${doseBadge}`}
                title={`Configuração (dose ${doseBadge})`}
                aria-expanded={configPopoverOpen}
                onClick={() => onConfigPopoverOpenChange?.(!configPopoverOpen)}
                className="relative flex h-10 w-10 items-center justify-center rounded-lg text-[#64748b] hover:bg-slate-100 hover:text-app-accent-deep"
              >
                <Settings2 className="h-4 w-4" strokeWidth={2} aria-hidden />
                <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-app-accent px-0.5 text-[9px] font-bold text-white">
                  {doseBadge}
                </span>
              </button>
              <MapeamentoFullscreenConfigPopover
                open={Boolean(configPopoverOpen)}
                onClose={() => onConfigPopoverOpenChange?.(false)}
                anchorRef={configAnchorRef}
                title={configTitle}
              >
                <ConfigFields
                  modo={modo}
                  configMarcacao={configMarcacao}
                  setConfigMarcacao={setConfigMarcacao}
                  unidadeMedida={unidadeMedida}
                  tamanho={tamanho}
                  setTamanho={setTamanho}
                  compact
                />
              </MapeamentoFullscreenConfigPopover>
            </>
          ) : (
            <div className="mx-0.5 rounded-xl border border-slate-200 bg-slate-50 p-3 text-left shadow-sm">
              <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                Config
              </p>
              <ConfigFields
                modo={modo}
                configMarcacao={configMarcacao}
                setConfigMarcacao={setConfigMarcacao}
                unidadeMedida={unidadeMedida}
                tamanho={tamanho}
                setTamanho={setTamanho}
              />
            </div>
          )}

          {/* EXIBIÇÃO */}
          {collapsed ? (
            <button
              type="button"
              aria-label={mostrarValores ? 'Ocultar doses (olho)' : 'Mostrar doses (olho)'}
              title={mostrarValores ? 'Ocultar doses' : 'Mostrar doses'}
              aria-pressed={mostrarValores}
              onClick={() => onToggleMostrarValores?.()}
              className="flex h-10 w-10 items-center justify-center rounded-lg text-[#64748b] hover:bg-slate-100 hover:text-app-accent-deep"
            >
              {mostrarValores ? (
                <Eye className="h-4 w-4" strokeWidth={2} aria-hidden />
              ) : (
                <EyeOff className="h-4 w-4" strokeWidth={2} aria-hidden />
              )}
            </button>
          ) : (
            <div className="mx-0.5 rounded-xl border border-slate-200 bg-white p-3">
              <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                Exibição
              </p>
              <button
                type="button"
                role="switch"
                aria-checked={mostrarValores}
                aria-label="Mostrar doses"
                onClick={() => onToggleMostrarValores?.()}
                className="flex w-full items-center justify-between gap-2 text-left"
              >
                <span className="text-[12px] font-semibold text-slate-700">Mostrar doses</span>
                <span
                  className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${
                    mostrarValores ? 'bg-app-accent' : 'bg-slate-300'
                  }`}
                >
                  <span
                    className="pointer-events-none inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition"
                    style={{ transform: `translateX(${mostrarValores ? '18px' : '3px'})` }}
                  />
                </span>
              </button>
            </div>
          )}

          {/* Desfazer */}
          <button
            type="button"
            aria-label="Desfazer último ponto (Ctrl+Z)"
            title="Desfazer (Ctrl+Z)"
            disabled={countPontosVista === 0}
            onClick={() => onDesfazerUltimo?.()}
            className={
              collapsed
                ? 'flex h-10 w-10 items-center justify-center rounded-lg text-[#64748b] hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40'
                : 'mx-0.5 flex w-[calc(100%-0.25rem)] items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-[12px] font-semibold text-[#64748b] hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40'
            }
          >
            <Undo2 className="h-4 w-4" strokeWidth={2} aria-hidden />
            {!collapsed ? <span>Desfazer</span> : null}
          </button>
        </div>

        {/* Rodapé */}
        <div className={`mt-auto border-t border-app-border ${collapsed ? 'flex flex-col items-center gap-1 p-1' : 'p-3'}`}>
          <button
            type="button"
            aria-label="Resumo de insumos"
            title="Resumo"
            onClick={() => onOpenResumo?.()}
            className={
              collapsed
                ? 'flex h-10 w-10 items-center justify-center rounded-lg text-[#64748b] hover:bg-slate-100'
                : 'mb-2 flex w-full items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-[12px] font-semibold text-[#64748b] hover:bg-slate-50'
            }
          >
            <FileText className="h-4 w-4" strokeWidth={2} aria-hidden />
            {!collapsed ? <span>Resumo</span> : null}
          </button>

          {typeof onRemoverFotoVista === 'function' ? (
            showRemoverFotoConfirm ? (
              <div
                className={`mb-2 rounded-lg border border-red-200 bg-red-50 p-2 text-center text-[11px] ${
                  collapsed ? 'mx-0 w-11 overflow-hidden p-1' : ''
                }`}
              >
                {!collapsed ? (
                  <>
                    <p className="font-semibold text-red-800">Remover foto desta vista?</p>
                    <p className="mt-1 text-red-700/80">
                      As marcações desta vista também serão apagadas. A foto permanece na galeria.
                    </p>
                  </>
                ) : (
                  <p className="text-[9px] font-semibold text-red-800">Remover?</p>
                )}
                <div className={`mt-2 flex gap-1 ${collapsed ? 'flex-col' : ''}`}>
                  <button
                    type="button"
                    onClick={() => {
                      onRemoverFotoVista?.();
                      closeConfirms();
                    }}
                    className="flex-1 rounded border border-red-200 bg-white py-1 font-bold text-red-600 hover:bg-red-50"
                  >
                    Sim
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowRemoverFotoConfirm(false)}
                    className="flex-1 rounded border border-slate-200 bg-white py-1 font-bold text-slate-600 hover:bg-slate-50"
                  >
                    Não
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                aria-label="Remover foto da vista"
                title="Remover foto"
                disabled={!hasFoto}
                onClick={() => {
                  setShowClearConfirm(false);
                  setShowRemoverFotoConfirm(true);
                }}
                className={
                  collapsed
                    ? 'flex h-10 w-10 items-center justify-center rounded-lg text-red-600 hover:bg-red-50 disabled:opacity-40'
                    : 'mb-2 flex w-full items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-[12px] font-semibold text-red-600 hover:bg-red-50 disabled:opacity-40'
                }
              >
                <ImageOff className="h-4 w-4" aria-hidden />
                {!collapsed ? <span>Remover foto</span> : null}
              </button>
            )
          ) : null}

          {typeof onClearVista === 'function' ? (
            showClearConfirm ? (
              <div
                className={`mb-2 rounded-lg border border-red-200 bg-red-50 p-2 text-center text-[11px] ${
                  collapsed ? 'w-11 p-1' : ''
                }`}
              >
                {!collapsed ? (
                  <p className="font-semibold text-red-800">Limpar esta vista?</p>
                ) : (
                  <p className="text-[9px] font-semibold text-red-800">Limpar?</p>
                )}
                <div className={`mt-2 flex gap-1 ${collapsed ? 'flex-col' : ''}`}>
                  <button
                    type="button"
                    onClick={() => {
                      onClearVista?.();
                      closeConfirms();
                    }}
                    className="flex-1 rounded border border-red-200 bg-white py-1 font-bold text-red-600 hover:bg-red-50"
                  >
                    Sim
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowClearConfirm(false)}
                    className="flex-1 rounded border border-slate-200 bg-white py-1 font-bold text-slate-600 hover:bg-slate-50"
                  >
                    Não
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                aria-label="Limpar vista"
                title="Limpar vista"
                disabled={countPontosVista === 0}
                onClick={() => {
                  setShowRemoverFotoConfirm(false);
                  setShowClearConfirm(true);
                }}
                className={
                  collapsed
                    ? 'flex h-10 w-10 items-center justify-center rounded-lg text-red-600 hover:bg-red-50 disabled:opacity-40'
                    : 'mb-3 flex w-full items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-[12px] font-semibold text-red-600 hover:bg-red-50 disabled:opacity-40'
                }
              >
                <Trash2 className="h-4 w-4" aria-hidden />
                {!collapsed ? <span>Limpar vista</span> : null}
              </button>
            )
          ) : null}

          <button
            type="button"
            aria-label="Sair da tela cheia (Esc)"
            title="Sair (Esc)"
            onPointerDown={stopBubble}
            onClick={(e) => {
              stopBubble(e);
              onClose?.();
            }}
            className={
              collapsed
                ? 'flex h-10 w-10 items-center justify-center rounded-lg text-[#64748b] hover:bg-app-nav-hover hover:text-app-accent-deep'
                : 'flex min-h-[44px] w-full items-center justify-center gap-3 rounded-xl px-2 text-[#64748b] hover:bg-app-nav-hover hover:text-app-accent-deep'
            }
          >
            <Minimize2 className="h-5 w-5 shrink-0" strokeWidth={2} aria-hidden />
            {!collapsed ? <span className="text-[13px] font-semibold">Sair</span> : null}
          </button>
        </div>
      </aside>
    </>
  );
}
