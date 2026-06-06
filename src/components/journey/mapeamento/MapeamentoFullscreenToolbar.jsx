import React from 'react';
import { Minimize2, Undo2 } from 'lucide-react';
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
  onDesfazerUltimo,
  onClose,
}) {
  const isMdUp = useMediaQuery('(min-width: 768px)');
  const narrow = !isMdUp || toolbarWidthPx <= 64;
  const widthStyle = narrow ? undefined : { width: toolbarWidthPx, minWidth: toolbarWidthPx };
  const widthClass = narrow ? 'w-14' : 'shrink-0';

  const hasPontos = countPontosVista > 0;

  return (
    <aside
      style={widthStyle}
      className={`${widthClass} z-10 flex h-full flex-col overflow-hidden border-r border-app-border bg-white shadow-app-sidebar`}
      onPointerDown={stopBubble}
      onClick={stopBubble}
    >
      <div className={`border-b border-app-border ${narrow ? 'px-1 py-3' : 'px-3 py-4'}`}>
        {narrow ? (
          <p
            className="mx-auto max-w-[2.5rem] truncate text-center text-[9px] font-bold uppercase leading-tight tracking-wide text-[#64748b]"
            title={vistaAtual ? getVistaLabel(vistaAtual) : 'Vista'}
          >
            {vistaAtual ? getVistaLabel(vistaAtual).split(' ')[0] : 'Vista'}
          </p>
        ) : (
          <>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-[#94a3b8]">Mapeamento</p>
            <h3 className="mt-0.5 line-clamp-2 text-[14px] font-bold leading-snug text-app-accent-deep">
              {vistaAtual ? getVistaLabel(vistaAtual) : 'Vista'}
            </h3>
          </>
        )}
      </div>

      <div className={`flex flex-1 flex-col gap-1 py-2 ${narrow ? 'px-1' : 'px-2'}`}>
        <MapeamentoFullscreenProcedimentoToggle
          panelOpen={panelOpen}
          procedimentoArmado={procedimentoArmado}
          onToggle={onToggleProcedimentoPanel}
          narrow={narrow}
        />

        <ToolbarIconButton
          icon={Undo2}
          label="Desfazer último ponto"
          disabled={!hasPontos}
          onClick={onDesfazerUltimo}
        />
      </div>

      <div className={`border-t border-app-border ${narrow ? 'p-1' : 'p-2'}`}>
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
            narrow ? 'h-10' : 'min-h-[44px] gap-3 px-2'
          }`}
        >
          <Minimize2 className="h-5 w-5 shrink-0" strokeWidth={2} aria-hidden />
          {!narrow ? <span className="text-[13px] font-semibold">Sair</span> : null}
        </button>
      </div>
    </aside>
  );
}
