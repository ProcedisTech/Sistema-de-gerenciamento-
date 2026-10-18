import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  CircleDot,
  Pencil,
  Eraser,
  Eye,
  EyeOff,
  Undo2,
  X,
} from 'lucide-react';
import {
  MAPEAMENTO_PALETA_CORES,
  corParaProcedimento,
} from '../../../constants/mapeamentoPaletaCores.js';

const STORAGE_KEY = 'procedi_canvas_assistive_touch_pos';
const ORB_SIZE = 56;
const DRAG_THRESHOLD = 5;

/**
 * AssistiveTouchToolbar:
 * Bolinha flutuante ergonômica com coluna vertical expansível em cápsula.
 * Substitui a barra horizontal tradicional fixa, liberando a visão clínica da foto
 * e permitindo alcance perfeito com o polegar em tablets e desktops.
 */
export function AssistiveTouchToolbar({
  modo = 'ponto', // 'ponto' | 'traco' | 'borracha'
  setModo,
  mostrarDoses = true,
  setMostrarDoses,
  onUndo,
  canUndo = false,
  activeCor = '#06b6d4',
  activeProc = null,
  procedimentos = [],
  onMudarCor,
  onArmar,
  containerRef,
  isOpenExternal = undefined,
  onCloseExternal,
}) {
  const [isOpenInternal, setIsOpenInternal] = useState(false);
  const isOpen = isOpenExternal !== undefined ? isOpenExternal : isOpenInternal;

  const setIsOpen = useCallback((valOrFn) => {
    if (typeof valOrFn === 'function') {
      setIsOpenInternal((prev) => {
        const next = valOrFn(prev);
        if (!next && onCloseExternal) onCloseExternal();
        return next;
      });
    } else {
      setIsOpenInternal(valOrFn);
      if (!valOrFn && onCloseExternal) onCloseExternal();
    }
  }, [onCloseExternal]);

  const [isColorPickerOpen, setIsColorPickerOpen] = useState(false);
  const [pos, setPos] = useState(() => {
    try {
      if (typeof window !== 'undefined') {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (typeof parsed?.x === 'number' && typeof parsed?.y === 'number') {
            return { x: parsed.x, y: parsed.y };
          }
        }
      }
    } catch {
      // ignore
    }
    return { x: 20, y: 80 };
  });
  const [containerSize, setContainerSize] = useState({ width: 800, height: 600 });

  const containerDivRef = useRef(null);
  const orbRef = useRef(null);
  const isDragging = useRef(false);
  const hasMoved = useRef(false);
  const startPointer = useRef({ x: 0, y: 0 });
  const startOrbPos = useRef({ x: 0, y: 0 });

  // Sincroniza dimensões do container fora da fase de renderização (React 19 / Compiler compliant)
  useEffect(() => {
    const container = containerRef?.current;
    if (!container) return;
    const updateSize = () => {
      setContainerSize({
        width: container.clientWidth || 800,
        height: container.clientHeight || 600,
      });
    };
    updateSize();
    if (typeof ResizeObserver !== 'undefined') {
      const ro = new ResizeObserver(updateSize);
      ro.observe(container);
      return () => ro.disconnect();
    }
  }, [containerRef]);

  const clampPosition = useCallback((candidateX, candidateY) => {
    const container = containerRef?.current;
    const width = container ? container.clientWidth : (typeof window !== 'undefined' ? window.innerWidth : 800);
    const height = container ? container.clientHeight : (typeof window !== 'undefined' ? window.innerHeight : 600);

    const clampedX = Math.max(10, Math.min(width - ORB_SIZE - 10, candidateX));
    const clampedY = Math.max(10, Math.min(height - ORB_SIZE - 10, candidateY));
    return { x: clampedX, y: clampedY };
  }, [containerRef]);

  // Re-clamp caso a janela mude de tamanho
  useEffect(() => {
    const handleResize = () => {
      setPos((prev) => clampPosition(prev.x, prev.y));
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [clampPosition]);

  // ── 2. ORIENTAÇÃO DINÂMICA DA CÁPSULA E TOOLTIPS (QUADRANTES DO CONTAINER) ──
  const orientation = useMemo(() => {
    const { width, height } = containerSize;

    const midX = width / 2;
    const midY = height / 2;

    const isRightSide = pos.x >= midX;
    const isLowerHalf = pos.y >= midY;

    return {
      isRightSide,
      isLowerHalf,
      // Se estiver na metade inferior, expande para cima; se no topo, expande para baixo
      expandClass: isLowerHalf
        ? 'bottom-[66px] top-auto animate-in fade-in slide-in-from-bottom-2 duration-150'
        : 'top-[66px] bottom-auto animate-in fade-in slide-in-from-top-2 duration-150',
      tooltipSideClass: isRightSide ? 'right-[60px] left-auto' : 'left-[60px] right-auto',
      popoverSideClass: isRightSide ? 'right-[68px] left-auto' : 'left-[68px] right-auto',
    };
  }, [containerSize, pos.x, pos.y]);

  // ── 3. ARRASTO LIVRE TOTAL COM CAPTURA DE PONTEIRO ──
  const handlePointerDown = (e) => {
    e.stopPropagation();
    try {
      e.currentTarget.setPointerCapture?.(e.pointerId);
    } catch {
      // ignore
    }

    isDragging.current = true;
    hasMoved.current = false;
    startPointer.current = { x: e.clientX, y: e.clientY };
    startOrbPos.current = { ...pos };
  };

  const handlePointerMove = (e) => {
    if (!isDragging.current) return;
    e.stopPropagation();

    const deltaX = e.clientX - startPointer.current.x;
    const deltaY = e.clientY - startPointer.current.y;

    if (!hasMoved.current && Math.hypot(deltaX, deltaY) > DRAG_THRESHOLD) {
      hasMoved.current = true;
    }

    if (hasMoved.current) {
      const nextX = startOrbPos.current.x + deltaX;
      const nextY = startOrbPos.current.y + deltaY;
      setPos(clampPosition(nextX, nextY));
    }
  };

  const handlePointerUp = (e) => {
    if (!isDragging.current) return;
    e.stopPropagation();
    isDragging.current = false;

    try {
      e.currentTarget.releasePointerCapture?.(e.pointerId);
    } catch {
      // ignore
    }

    if (hasMoved.current) {
      // Salva no localStorage para lembrar a preferência do usuário
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(pos));
      } catch {
        // ignore
      }
    } else {
      // Clique simples: abre ou fecha a cápsula
      setIsOpen((prev) => !prev);
      if (isOpen) setIsColorPickerOpen(false);
    }
  };

  // ── 4. AÇÕES DE FERRAMENTAS NA CÁPSULA (MANTÉM CÁPSULA ABERTA) ──
  const handleSelectModo = (m, e) => {
    e.stopPropagation();
    setModo?.(m);
    // Cápsula permanece aberta para ergonomia contínua!
  };

  const handleToggleDoses = (e) => {
    e.stopPropagation();
    setMostrarDoses?.((prev) => !prev);
    // Cápsula permanece aberta!
  };

  const handleUndoClick = (e) => {
    e.stopPropagation();
    if (canUndo) {
      onUndo?.();
    }
    // Cápsula permanece aberta!
  };

  const handleToggleColorPicker = (e) => {
    e.stopPropagation();
    setIsColorPickerOpen((prev) => !prev);
  };

  const handleSelectCor = (corHex, procOwner, e) => {
    e.stopPropagation();
    if (procOwner && activeProc && String(procOwner.id) !== String(activeProc.id)) {
      if (onArmar) {
        onArmar(procOwner);
        setIsColorPickerOpen(false);
        return;
      }
    }
    onMudarCor?.(corHex);
    setIsColorPickerOpen(false);
    // Cápsula permanece aberta!
  };

  // Rótulo da ferramenta ativa para exibir na bolinha fechada
  const modoLabel = useMemo(() => {
    switch (modo) {
      case 'traco':
        return 'TRAÇO';
      case 'borracha':
        return 'BORRACHA';
      case 'ponto':
      default:
        return 'PONTO';
    }
  }, [modo]);

  return (
    <div
      ref={containerDivRef}
      data-testid="assistive-touch-container"
      className="absolute z-[70] touch-none select-none pointer-events-auto"
      style={{
        left: `${pos.x}px`,
        top: `${pos.y}px`,
      }}
    >
      {/* ── COLUNA VERTICAL EM CÁPSULA EXPANSÍVEL (BRANCO GELO CLÍNICO) ── */}
      {isOpen && (
        <div
          data-testid="assistive-touch-capsule"
          className={`absolute ${orientation.expandClass} left-1/2 -translate-x-1/2 flex flex-col items-center gap-1.5 rounded-3xl border border-slate-300 bg-white p-1.5 shadow-2xl z-[70]`}
          style={{ width: '56px' }}
        >
          {/* 1. Botão de Cor Ativa com Popover Rápido */}
          <div className="relative group">
            <button
              type="button"
              data-testid="btn-capsule-color"
              onClick={handleToggleColorPicker}
              className="flex h-11 w-11 items-center justify-center rounded-2xl hover:bg-slate-100 transition-all cursor-pointer relative"
              title={`Trocar cor ativa (Atual: ${activeCor})`}
            >
              <span
                className="h-5 w-5 rounded-full border-2 border-white shadow-sm transition-transform group-hover:scale-110"
                style={{ backgroundColor: activeCor }}
              />
            </button>
            <span
              className={`absolute top-1/2 -translate-y-1/2 ${orientation.tooltipSideClass} pointer-events-none rounded-lg bg-slate-900 px-2 py-1 text-[11px] font-bold text-white shadow-xl opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-50`}
            >
              Trocar Cor
            </span>

            {/* POPOVER FLUTUANTE DE ESCOLHA DE COR — 12 CORES OFICIAIS */}
            {isColorPickerOpen && (
              <>
                <div
                  className="fixed inset-0 z-[75]"
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsColorPickerOpen(false);
                  }}
                />
                <div
                  data-testid="color-picker-popover"
                  className={`absolute top-0 ${orientation.popoverSideClass} z-[80] w-52 rounded-2xl border border-slate-200 bg-white p-3 shadow-2xl animate-in fade-in zoom-in-95 duration-100`}
                >
                  <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-slate-500 text-center">
                    Trocar Cor Ativa
                  </p>
                  <div className="grid grid-cols-6 gap-1.5">
                    {MAPEAMENTO_PALETA_CORES.map((c) => {
                      const procOwner = procedimentos.find(
                        (p) =>
                          (p.corHex || corParaProcedimento(p.id)).toLowerCase() ===
                          c.toLowerCase()
                      );
                      const isEmUso = Boolean(procOwner);
                      const isAtiva = activeCor.toLowerCase() === c.toLowerCase();
                      return (
                        <button
                          key={c}
                          type="button"
                          title={isEmUso ? `Em uso por: ${procOwner.nome}` : 'Cor livre'}
                          onClick={(e) => handleSelectCor(c, procOwner, e)}
                          className={`flex h-6 w-6 items-center justify-center rounded-full border transition-transform hover:scale-120 cursor-pointer ${
                            isAtiva
                              ? 'ring-2 ring-emerald-500 ring-offset-1 scale-110'
                              : 'border-black/10'
                          }`}
                          style={{ backgroundColor: c }}
                        >
                          {isEmUso && (
                            <span className="h-1.5 w-1.5 rounded-full bg-white shadow-xs" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </>
            )}
          </div>

          {/* 2. Ferramenta Ponto (CircleDot / Bolinha de Injeção) */}
          <div className="relative group">
            <button
              type="button"
              data-testid="btn-capsule-ponto"
              onClick={(e) => handleSelectModo('ponto', e)}
              className={`flex h-11 w-11 items-center justify-center rounded-2xl transition-all cursor-pointer ${
                modo === 'ponto'
                  ? 'border border-emerald-500/40 bg-emerald-50 text-emerald-700 shadow-xs'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <CircleDot className="h-5 w-5" />
            </button>
            <span
              className={`absolute top-1/2 -translate-y-1/2 ${orientation.tooltipSideClass} pointer-events-none rounded-lg bg-slate-900 px-2 py-1 text-[11px] font-bold text-white shadow-xl opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-50`}
            >
              Ponto (P)
            </span>
          </div>

          {/* 3. Ferramenta Traço (Pencil / Lápis) */}
          <div className="relative group">
            <button
              type="button"
              data-testid="btn-capsule-traco"
              onClick={(e) => handleSelectModo('traco', e)}
              className={`flex h-11 w-11 items-center justify-center rounded-2xl transition-all cursor-pointer ${
                modo === 'traco'
                  ? 'border border-emerald-500/40 bg-emerald-50 text-emerald-700 shadow-xs'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <Pencil className="h-5 w-5" />
            </button>
            <span
              className={`absolute top-1/2 -translate-y-1/2 ${orientation.tooltipSideClass} pointer-events-none rounded-lg bg-slate-900 px-2 py-1 text-[11px] font-bold text-white shadow-xl opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-50`}
            >
              Traço (Lápis) (T)
            </span>
          </div>

          {/* 4. Ferramenta Borracha (Eraser) */}
          <div className="relative group">
            <button
              type="button"
              data-testid="btn-capsule-borracha"
              onClick={(e) => handleSelectModo('borracha', e)}
              className={`flex h-11 w-11 items-center justify-center rounded-2xl transition-all cursor-pointer ${
                modo === 'borracha'
                  ? 'border border-red-500/40 bg-red-50 text-red-600 shadow-xs'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <Eraser className="h-5 w-5" />
            </button>
            <span
              className={`absolute top-1/2 -translate-y-1/2 ${orientation.tooltipSideClass} pointer-events-none rounded-lg bg-slate-900 px-2 py-1 text-[11px] font-bold text-white shadow-xl opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-50`}
            >
              Borracha (B)
            </span>
          </div>

          <div className="h-px w-6 bg-slate-200 my-0.5" />

          {/* 5. Desfazer (Undo2) */}
          <div className="relative group">
            <button
              type="button"
              data-testid="btn-capsule-undo"
              onClick={handleUndoClick}
              disabled={!canUndo}
              className="flex h-11 w-11 items-center justify-center rounded-2xl text-slate-600 hover:bg-slate-100 hover:text-slate-900 disabled:opacity-30 disabled:cursor-not-allowed transition-all cursor-pointer"
            >
              <Undo2 className="h-5 w-5" />
            </button>
            <span
              className={`absolute top-1/2 -translate-y-1/2 ${orientation.tooltipSideClass} pointer-events-none rounded-lg bg-slate-900 px-2 py-1 text-[11px] font-bold text-white shadow-xl opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-50`}
            >
              Desfazer (Ctrl+Z)
            </span>
          </div>

          {/* 6. Alternar Doses (Eye / EyeOff) */}
          <div className="relative group">
            <button
              type="button"
              data-testid="btn-capsule-doses"
              onClick={handleToggleDoses}
              className={`flex h-11 w-11 items-center justify-center rounded-2xl transition-all cursor-pointer ${
                mostrarDoses
                  ? 'text-emerald-700 bg-emerald-50/70 hover:bg-emerald-100/70'
                  : 'text-slate-400 opacity-50 hover:opacity-100 hover:bg-slate-100'
              }`}
            >
              {mostrarDoses ? <Eye className="h-5 w-5" /> : <EyeOff className="h-5 w-5" />}
            </button>
            <span
              className={`absolute top-1/2 -translate-y-1/2 ${orientation.tooltipSideClass} pointer-events-none rounded-lg bg-slate-900 px-2 py-1 text-[11px] font-bold text-white shadow-xl opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-50`}
            >
              {mostrarDoses ? 'Ocultar Doses (D)' : 'Mostrar Doses (D)'}
            </span>
          </div>
        </div>
      )}

      {/* ── BOLINHA FLUTUANTE PRINCIPAL (ASSISTIVETOUCH ORB) ── */}
      <div
        ref={orbRef}
        data-testid="assistive-touch-orb"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        title={
          isOpen
            ? 'Toque para recolher as ferramentas'
            : 'Arraste livremente para onde quiser ou toque para abrir as ferramentas'
        }
        className={`relative flex h-14 w-14 cursor-grab active:cursor-grabbing flex-col items-center justify-center rounded-full border border-teal-300/40 bg-[#00a88e] hover:bg-[#00967f] text-white shadow-xl shadow-teal-900/25 transition-all duration-200 select-none ${
          isOpen ? 'ring-2 ring-white/80 scale-105 bg-[#008f79]' : 'hover:scale-105'
        }`}
      >
        {/* Aro/ponto de cor do procedimento no topo direito */}
        <span
          className="absolute -top-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-white shadow-sm transition-colors"
          style={{ backgroundColor: activeCor }}
        />

        {/* Miolo da Bolinha */}
        <div
          className={`text-white transition-transform duration-200 ${
            isOpen ? 'rotate-45 scale-90' : ''
          }`}
        >
          {isOpen ? (
            <X className="h-5 w-5 stroke-[2.5]" />
          ) : (
            <>
              {modo === 'ponto' && <CircleDot className="h-5 w-5" />}
              {modo === 'traco' && <Pencil className="h-5 w-5" />}
              {modo === 'borracha' && <Eraser className="h-5 w-5" />}
            </>
          )}
        </div>

        {/* Rótulo da ferramenta ativa (apenas quando recolhida) */}
        {!isOpen && (
          <span className="text-[8px] font-extrabold tracking-wider text-white/95 uppercase mt-0.5 drop-shadow-xs">
            {modoLabel}
          </span>
        )}
      </div>
    </div>
  );
}
