import React from 'react';
import { Plus } from 'lucide-react';
import { getGrupoDaVista, getGrupoLabel, getVistaLabel } from '../../../constants/vistasMapeamento.js';

export function VistaChipsBar({
  vistasPreenchidas = [],
  vistaAtual,
  onSelectVista,
  onAdicionarVista,
  countPontosVista,
}) {
  if (!vistasPreenchidas.length && !onAdicionarVista) return null;

  return (
    <div className="flex items-center gap-2 overflow-x-auto pb-1 [-webkit-overflow-scrolling:touch]">
      {vistasPreenchidas.map((codigo) => {
        const active = vistaAtual === codigo;
        const count = typeof countPontosVista === 'function' ? countPontosVista(codigo) : 0;
        const grupo = getGrupoDaVista(codigo);
        return (
          <button
            key={codigo}
            type="button"
            onClick={() => onSelectVista?.(codigo)}
            className={`relative shrink-0 rounded-xl border px-3 py-2 text-left transition-colors ${
              active
                ? 'border-app-accent bg-app-nav-active shadow-sm'
                : 'border-app-border bg-white hover:bg-app-nav-hover'
            }`}
          >
            <span className={`block text-[12px] font-bold ${active ? 'text-[#0f766e]' : 'text-app-ink'}`}>
              {getVistaLabel(codigo)}
            </span>
            {grupo ? (
              <span className="text-[10px] font-medium text-[#94a3b8]">{getGrupoLabel(grupo)}</span>
            ) : null}
            {count > 0 ? (
              <span className="absolute -right-1 -top-1 inline-flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-app-accent px-1 text-[10px] font-bold text-white">
                {count}
              </span>
            ) : null}
          </button>
        );
      })}
      {onAdicionarVista ? (
        <button
          type="button"
          onClick={onAdicionarVista}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-dashed border-app-accent/50 bg-white px-3 py-2 text-[12px] font-semibold text-[#00a88e] hover:bg-app-nav-active"
        >
          <Plus className="h-3.5 w-3.5" />
          Adicionar vista
        </button>
      ) : null}
    </div>
  );
}

/** Cabeçalho da vista ativa acima do canvas. */
export function VistaAtivaHeader({ vistaAtual }) {
  if (!vistaAtual) return null;
  const grupo = getGrupoDaVista(vistaAtual);
  return (
    <div className="mb-3 flex flex-wrap items-center gap-2">
      <h4 className="text-[14px] font-bold text-app-ink">{getVistaLabel(vistaAtual)}</h4>
      {grupo ? (
        <span className="rounded-md bg-[#e6f7f5] px-2 py-0.5 text-[11px] font-semibold text-[#00a88e]">
          {getGrupoLabel(grupo)}
        </span>
      ) : null}
    </div>
  );
}
