import React, { useState } from 'react';
import { percentToContainerPositionFromMetrics } from '../../../utils/mapeamentoCoords.js';
import { corParaProcedimento } from '../../../constants/mapeamentoPaletaCores.js';
import {
  formatQuantidadeEtiqueta,
  markerSizePx,
  normalizeTamanho,
} from '../../../constants/mapeamentoMarcador.js';

const DENSITY = {
  full: { scale: 1, stroke: 4, strokeSelected: 6, showDoses: true },
  preview: { scale: 0.85, stroke: 3, strokeSelected: 4, showDoses: false },
  thumb: { scale: 0.65, stroke: 2.5, strokeSelected: 3, showDoses: false },
};

/**
 * Overlay de marcações salvas (traços SVG + pontos DOM).
 * Usado pelo canvas do mapa e pelas miniaturas da galeria — um único caminho visual.
 *
 * @param {'full'|'preview'|'thumb'} density
 * @param {Array} pontos — lista plana com tipoGeometria, vertices/posX/posY, quantidade, tamanho, catalogoId, localId
 */
export function MapaMarcacoesOverlay({
  pontos = [],
  layoutMetrics,
  density = 'full',
  mostrarValores = true,
  unidadeMedida = 'u',
  interactive = false,
  selectedLocalId = null,
  onMarkerPointerDown,
  filtroProcedimentoId = null,
  procedimentosOcultosIds = [],
  hoveredPontoId = null,
  onMarkerHover = null,
  onMarkerClick = null,
}) {
  const cfg = DENSITY[density] || DENSITY.full;
  const showDoses = cfg.showDoses && mostrarValores;
  const list = Array.isArray(pontos) ? pontos : [];
  const [activeTooltipId, setActiveTooltipId] = useState(null);
  const [prevHoveredId, setPrevHoveredId] = useState(hoveredPontoId);

  // Sincronizar limpeza de tooltip durante o render quando o pai reseta hoveredPontoId (sem cascading effect)
  if (prevHoveredId !== hoveredPontoId) {
    setPrevHoveredId(hoveredPontoId);
    if (hoveredPontoId === null && activeTooltipId !== null) {
      setActiveTooltipId(null);
    }
  }

  const resolveContainerPos = (posX, posY) => {
    const pos = percentToContainerPositionFromMetrics(posX, posY, layoutMetrics);
    if (pos) return pos;
    return { left: posX, top: posY };
  };

  const resolvePos = (x, y) => {
    const pos = percentToContainerPositionFromMetrics(x, y, layoutMetrics);
    return pos ? { x: pos.left, y: pos.top } : { x, y };
  };

  const isPontoVisivel = (p) => {
    if (Array.isArray(procedimentosOcultosIds) && procedimentosOcultosIds.length > 0) {
      const isOculto = procedimentosOcultosIds.some((id) =>
        (p.mapaProcedimentoId && String(p.mapaProcedimentoId) === String(id)) ||
        (p.catalogoId && String(p.catalogoId) === String(id)) ||
        (p.nomeProcedimento && String(p.nomeProcedimento) === String(id)) ||
        (p.cor && String(p.cor) === String(id))
      );
      return !isOculto;
    }
    if (filtroProcedimentoId) {
      return String(p.mapaProcedimentoId) === String(filtroProcedimentoId);
    }
    return true;
  };

  return (
    <>
      <svg
        className="absolute inset-0 z-[10] h-full w-full"
        style={{ overflow: 'visible', pointerEvents: 'none' }}
      >
        {list
          .filter((p) => p.tipoGeometria === 'traco' && p.vertices?.length > 0)
          .map((p) => {
            const cor = p.cor || corParaProcedimento(p.catalogoId || p.catalogoProcedimentoSaudeId);
            const selected = selectedLocalId != null && selectedLocalId === p.localId;
            const matchesFilter = isPontoVisivel(p);
            const points = p.vertices.map((v) =>
              resolvePos(v.posX ?? v.x, v.posY ?? v.y),
            );
            return points.map((pt, i) => {
              if (i === 0) return null;
              const prev = points[i - 1];
              return (
                <line
                  key={`${p.localId || p.id}-segment-${i}`}
                  x1={`${prev.x}%`}
                  y1={`${prev.y}%`}
                  x2={`${pt.x}%`}
                  y2={`${pt.y}%`}
                  stroke={cor}
                  strokeWidth={String(selected ? cfg.strokeSelected : cfg.stroke)}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  style={{
                    opacity: matchesFilter ? 1 : 0,
                    transition: 'opacity 200ms ease',
                    ...(interactive
                      ? { pointerEvents: matchesFilter ? 'stroke' : 'none', cursor: 'pointer' }
                      : undefined),
                  }}
                  onPointerDown={
                    interactive && onMarkerPointerDown
                      ? (ev) => onMarkerPointerDown(ev, p)
                      : undefined
                  }
                />
              );
            });
          })}
      </svg>

      {list.map((p, idx) => {
        const cor = p.cor || corParaProcedimento(p.catalogoId || p.catalogoProcedimentoSaudeId);
        const key = p.localId || p.id || `pt_${idx}`;
        const selected = selectedLocalId != null && selectedLocalId === key;
        const isHovered = hoveredPontoId != null && String(hoveredPontoId) === String(key);
        const isTooltipOpen = activeTooltipId != null && String(activeTooltipId) === String(key);
        const matchesFilter = isPontoVisivel(p);
        const itemOpacity = matchesFilter ? 1 : 0;

        let containerPos;
        if (p.tipoGeometria === 'traco' && p.vertices?.length > 0) {
          const lastV = p.vertices[p.vertices.length - 1];
          containerPos = resolveContainerPos(lastV.posX ?? lastV.x, lastV.posY ?? lastV.y);
        } else if (p.vertices?.length > 0 && (p.posX == null || p.posY == null)) {
          const v0 = p.vertices[0];
          containerPos = resolveContainerPos(v0.posX ?? v0.x, v0.posY ?? v0.y);
        } else {
          containerPos = resolveContainerPos(p.posX, p.posY);
        }

        if (!containerPos || containerPos.left == null || containerPos.top == null) return null;

        const tamanho = normalizeTamanho(p.tamanho);
        const sizePx = Math.max(6, Math.round(markerSizePx(tamanho) * cfg.scale));

        return (
          <div
            key={key}
            className={`absolute -translate-x-1/2 -translate-y-1/2 transition-opacity duration-200 ${
              isHovered || isTooltipOpen ? 'z-[45]' : selected ? 'z-[30]' : 'z-[10]'
            }`}
            style={{
              left: `${containerPos.left}%`,
              top: `${containerPos.top}%`,
              opacity: itemOpacity,
              pointerEvents: matchesFilter ? 'auto' : 'none',
            }}
            onMouseEnter={() => {
              if (interactive) {
                setActiveTooltipId(key);
                onMarkerHover?.(p);
              }
            }}
            onMouseLeave={() => {
              if (interactive) {
                setActiveTooltipId((prev) => (prev === key ? null : prev));
                onMarkerHover?.(null);
              }
            }}
          >
            <div className="relative" style={{ width: sizePx, height: sizePx }}>
              {/* Tooltip Interativo Clínico ao Hover ou Clique */}
              {interactive && (isTooltipOpen || isHovered) ? (
                <div
                  className="pointer-events-none absolute bottom-[calc(100%+8px)] left-1/2 -translate-x-1/2 z-[50] flex flex-col items-center animate-in fade-in zoom-in-95 duration-100 will-change-transform select-none"
                  role="tooltip"
                >
                  <div className="flex items-center gap-2 rounded-lg bg-slate-900 px-3 py-1.5 text-xs text-white shadow-2xl border border-slate-700/90 whitespace-nowrap">
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0 shadow-xs ring-1 ring-white/30"
                      style={{ backgroundColor: cor }}
                    />
                    <div className="flex flex-col text-left">
                      <span className="font-semibold text-slate-100 leading-tight">
                        {p.nomeProcedimento || 'Procedimento'}
                      </span>
                      <span className="text-[10px] text-slate-300 font-mono leading-tight">
                        Ponto #{p.ordemPonto ?? (idx + 1)} · {formatQuantidadeEtiqueta(p.quantidade, p.unidadeMedida || unidadeMedida)}
                      </span>
                    </div>
                  </div>
                  <div className="w-2 h-2 rotate-45 bg-slate-900 border-r border-b border-slate-700/90 -mt-1" />
                </div>
              ) : showDoses ? (
                <span
                  className="pointer-events-none absolute bottom-[calc(100%+5px)] left-1/2 -translate-x-1/2 whitespace-nowrap rounded px-2 py-1 text-[14px] font-medium leading-none text-white shadow-sm select-none"
                  style={{ backgroundColor: cor }}
                  aria-hidden
                >
                  {formatQuantidadeEtiqueta(p.quantidade, unidadeMedida)}
                </span>
              ) : null}

              {interactive ? (
                <button
                  type="button"
                  title={`${p.nomeProcedimento || ''} — Ponto #${p.ordemPonto ?? (idx + 1)} (${p.quantidade ?? ''})`.trim()}
                  className="absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-0 bg-transparent p-0 cursor-pointer select-none"
                  style={{
                    width: Math.max(26, sizePx + 12),
                    height: Math.max(26, sizePx + 12),
                    touchAction: 'manipulation',
                  }}
                  onPointerDown={(ev) => {
                    ev.stopPropagation();
                    onMarkerPointerDown?.(ev, p);
                  }}
                  onClick={(ev) => {
                    ev.stopPropagation();
                    setActiveTooltipId(key);
                    onMarkerClick?.(p);
                  }}
                >
                  <span
                    className={`block rounded-full ${
                      sizePx < 10 ? 'border-[1.5px]' : 'border-2'
                    } shadow-md transition-transform duration-150 ease-out will-change-transform ${
                      isHovered || isTooltipOpen
                        ? 'scale-125 ring-4 ring-white/90 shadow-lg'
                        : selected
                        ? 'scale-110 border-yellow-300 ring-2 ring-yellow-300/50'
                        : 'border-white hover:scale-110'
                    }`}
                    style={{
                      width: sizePx,
                      height: sizePx,
                      backgroundColor: cor,
                    }}
                  />
                </button>
              ) : (
                <span
                  className={`absolute left-1/2 top-1/2 block -translate-x-1/2 -translate-y-1/2 rounded-full ${
                    sizePx < 10 ? 'border-[1.5px]' : 'border-2'
                  } border-white shadow-xs`}
                  style={{
                    width: sizePx,
                    height: sizePx,
                    backgroundColor: cor,
                  }}
                  aria-hidden
                />
              )}
            </div>
          </div>
        );
      })}
    </>
  );
}
