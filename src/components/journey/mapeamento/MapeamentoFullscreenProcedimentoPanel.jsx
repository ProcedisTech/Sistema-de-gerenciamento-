import React from 'react';
import { Syringe } from 'lucide-react';
import { corParaProcedimento } from '../../../constants/mapeamentoPaletaCores.js';
import { MapeamentoProcedimentoPicker } from './MapeamentoProcedimentoPicker.jsx';

function stopBubble(e) {
  e.stopPropagation();
}

export function MapeamentoFullscreenProcedimentoToggle({
  panelOpen,
  procedimentoArmado,
  onToggle,
  narrow = false,
}) {
  const armado = Boolean(procedimentoArmado?.id);
  const corArmado = armado ? corParaProcedimento(procedimentoArmado.id) : null;
  const ariaLabel = armado
    ? `Procedimentos — ${procedimentoArmado.nome}`
    : 'Procedimentos';

  return (
    <button
      type="button"
      aria-expanded={panelOpen}
      aria-controls="mapeamento-fs-procedimento-panel"
      aria-label={ariaLabel}
      title={ariaLabel}
      onPointerDown={stopBubble}
      onClick={(e) => {
        stopBubble(e);
        onToggle?.();
      }}
      className={`relative flex items-center justify-center rounded-xl transition-all ${
        narrow ? 'mx-auto h-10 w-10' : 'min-h-[44px] w-full gap-3 px-2'
      } ${
        panelOpen
          ? 'border-l-2 border-l-app-accent bg-emerald-50 text-app-accent-deep'
          : 'border-l-2 border-l-transparent text-[#64748b] hover:bg-app-nav-hover active:bg-app-nav-active hover:text-app-accent-deep'
      }`}
    >
      <Syringe className="h-5 w-5 shrink-0" strokeWidth={2} aria-hidden />
      {!narrow ? <span className="min-w-0 flex-1 truncate text-left text-[13px] font-semibold">Procedimentos</span> : null}
      {armado && !panelOpen ? (
        <span
          className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full ring-2 ring-white"
          style={{ backgroundColor: corArmado }}
          aria-hidden
        />
      ) : null}
    </button>
  );
}

export function MapeamentoFullscreenProcedimentoFloatingPanel({
  open,
  procedimentoArmado,
  onArmar,
  procedimentosUsados = [],
}) {
  if (!open) return null;

  return (
    <div
      id="mapeamento-fs-procedimento-panel"
      role="region"
      aria-label="Seleção de procedimento"
      onPointerDown={stopBubble}
      onClick={stopBubble}
      className="absolute left-4 top-4 z-[35] w-[min(360px,calc(100%-2rem))] max-h-[min(70dvh,520px)] overflow-y-auto rounded-xl shadow-2xl"
    >
      <MapeamentoProcedimentoPicker
        procedimentoArmado={procedimentoArmado}
        onArmar={onArmar}
        procedimentosUsados={procedimentosUsados}
      />
    </div>
  );
}

/** @deprecated Use MapeamentoFullscreenProcedimentoToggle + MapeamentoFullscreenProcedimentoFloatingPanel */
export function MapeamentoFullscreenProcedimentoPanel(props) {
  return (
    <>
      <MapeamentoFullscreenProcedimentoToggle {...props} onToggle={() => props.onToggle?.()} />
      <MapeamentoFullscreenProcedimentoFloatingPanel {...props} open={props.panelOpen} />
    </>
  );
}
