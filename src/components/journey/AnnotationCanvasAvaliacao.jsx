import React, { useState, useRef, useMemo, useCallback } from 'react';
import { TransformWrapper, TransformComponent } from 'react-zoom-pan-pinch';
import { 
  ZoomIn, 
  ZoomOut, 
  RotateCcw, 
  Trash2, 
  Plus, 
  Eraser, 
  Layers, 
  Sparkles, 
  Maximize2,
  ChevronRight,
  Info
} from 'lucide-react';

const PROCEDIMENTO_PALETTE = [
  { id: 0, cor: '#3B82F6', corBg: 'rgba(59, 130, 246, 0.15)', corBorda: '#2563EB', label: 'Procedimento 1' },
  { id: 1, cor: '#EC4899', corBg: 'rgba(236, 72, 153, 0.15)', corBorda: '#DB2777', label: 'Procedimento 2' },
  { id: 2, cor: '#10B981', corBg: 'rgba(16, 185, 129, 0.15)', corBorda: '#059669', label: 'Procedimento 3' },
  { id: 3, cor: '#8B5CF6', corBg: 'rgba(139, 92, 246, 0.15)', corBorda: '#7C3AED', label: 'Procedimento 4' },
  { id: 4, cor: '#F59E0B', corBg: 'rgba(245, 158, 11, 0.15)', corBorda: '#D97706', label: 'Procedimento 5' },
];

/**
 * AnnotationCanvasAvaliacao: Canvas moderno de anotação e mapeamento facial
 * com suporte nativo a múltiplos procedimentos na mesma sessão/face.
 */
export function AnnotationCanvasAvaliacao({
  fotoUrl,
  procedimentos = [],
  pontos = [],
  onPontosChange,
  readOnly = false,
  vistaAtual = 'frente',
  alturaMaxima = 'min(70dvh, 650px)'
}) {
  const [procedimentoAtivoIndex, setProcedimentoAtivoIndex] = useState(0);
  const [modoBorracha, setModoBorracha] = useState(false);
  const [dosePadrao, setDosePadrao] = useState(1);
  const containerRef = useRef(null);
  const imgRef = useRef(null);

  // Mapeia procedimentos para paletas de cores estáveis
  const procedimentosComCores = useMemo(() => {
    if (!procedimentos || procedimentos.length === 0) {
      return [{
        index: 0,
        mapaProcedimentoId: null,
        nome: 'Procedimento Principal',
        unidadeMedida: 'U',
        corObj: PROCEDIMENTO_PALETTE[0]
      }];
    }
    return procedimentos.map((proc, idx) => ({
      ...proc,
      index: idx,
      corObj: PROCEDIMENTO_PALETTE[idx % PROCEDIMENTO_PALETTE.length],
      nome: proc.nomeProcedimento || proc.nome || proc.catalogoNome || `Procedimento ${idx + 1}`,
      unidadeMedida: proc.unidadeMedida || 'U'
    }));
  }, [procedimentos]);

  const procedimentoAtivo = procedimentosComCores[procedimentoAtivoIndex] || procedimentosComCores[0];

  // Filtra pontos da vista atual
  const pontosVista = useMemo(() => {
    return pontos.filter(p => (p.vistaCodigo || p.anguloFotoCodigo || 'frente') === vistaAtual);
  }, [pontos, vistaAtual]);

  // Totais por procedimento para o rodapé
  const totaisPorProcedimento = useMemo(() => {
    const map = {};
    procedimentosComCores.forEach(p => {
      map[p.index] = { nome: p.nome, cor: p.corObj.cor, unidade: p.unidadeMedida, total: 0, qtdPontos: 0 };
    });

    pontos.forEach(pt => {
      const idx = pt.procedimentoIndex ?? 0;
      if (map[idx]) {
        map[idx].total += Number(pt.quantidade || 0);
        map[idx].qtdPontos += 1;
      }
    });
    return Object.values(map);
  }, [procedimentosComCores, pontos]);

  // Adicionar ponto ao clicar na imagem
  const handleImageClick = useCallback((e) => {
    if (readOnly || modoBorracha) return;
    if (!imgRef.current) return;

    const rect = imgRef.current.getBoundingClientRect();
    const clientX = e.clientX;
    const clientY = e.clientY;

    if (clientX < rect.left || clientX > rect.right || clientY < rect.top || clientY > rect.bottom) {
      return;
    }

    const posX = ((clientX - rect.left) / rect.width) * 100;
    const posY = ((clientY - rect.top) / rect.height) * 100;

    const novoPonto = {
      id: `pt_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      posX: Number(posX.toFixed(2)),
      posY: Number(posY.toFixed(2)),
      quantidade: dosePadrao,
      tipoGeometria: 'ponto',
      vistaCodigo: vistaAtual,
      procedimentoIndex: procedimentoAtivo.index,
      mapaProcedimentoId: procedimentoAtivo.mapaProcedimentoId || null,
      vertices: [{ ordem: 1, posX: Number(posX.toFixed(2)), posY: Number(posY.toFixed(2)) }]
    };

    onPontosChange?.([...pontos, novoPonto]);
  }, [readOnly, modoBorracha, dosePadrao, vistaAtual, procedimentoAtivo, pontos, onPontosChange]);

  // Remover ponto (clique direto no ponto ou em modo borracha)
  const handlePontoClick = useCallback((pontoId, e) => {
    e.stopPropagation();
    if (readOnly) return;
    onPontosChange?.(pontos.filter(p => p.id !== pontoId));
  }, [readOnly, pontos, onPontosChange]);

  return (
    <div className="flex flex-col w-full bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl text-slate-100">
      
      {/* ── BARRA SUPERIOR: Seletor de Procedimento Ativo ── */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 bg-slate-950/80 border-b border-slate-800 backdrop-blur-md">
        <div className="flex items-center gap-2 overflow-x-auto pb-1 max-w-full">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5 mr-2">
            <Layers className="w-3.5 h-3.5 text-teal-400" />
            Procedimento:
          </span>
          {procedimentosComCores.map((proc) => {
            const isActive = proc.index === procedimentoAtivo.index;
            return (
              <button
                key={proc.index}
                type="button"
                onClick={() => {
                  setProcedimentoAtivoIndex(proc.index);
                  setModoBorracha(false);
                }}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all shadow-sm ${
                  isActive
                    ? 'ring-2 shadow-lg scale-105'
                    : 'opacity-70 hover:opacity-100 hover:bg-slate-800/80'
                }`}
                style={{
                  backgroundColor: isActive ? proc.corObj.corBg : 'rgba(30, 41, 59, 0.5)',
                  color: proc.corObj.cor,
                  ringColor: isActive ? proc.corObj.cor : 'transparent',
                  border: `1px solid ${isActive ? proc.corObj.corBorda : 'rgba(71, 85, 105, 0.4)'}`
                }}
              >
                <span
                  className="w-2.5 h-2.5 rounded-full"
                  style={{ backgroundColor: proc.corObj.cor }}
                />
                <span>{proc.nome}</span>
              </button>
            );
          })}
        </div>

        {/* Ferramentas: Dose e Borracha */}
        {!readOnly && (
          <div className="flex items-center gap-2 self-end sm:self-auto">
            <div className="flex items-center gap-1 bg-slate-800/70 border border-slate-700/60 px-2 py-1 rounded-lg">
              <span className="text-[11px] text-slate-400 font-medium">Dose:</span>
              <input
                type="number"
                min="0.1"
                step="0.5"
                value={dosePadrao}
                onChange={(e) => setDosePadrao(Math.max(0.1, Number(e.target.value)))}
                className="w-12 bg-slate-900 text-center text-xs font-bold text-teal-300 rounded border border-slate-700 py-0.5 focus:outline-none focus:ring-1 focus:ring-teal-400"
              />
              <span className="text-[11px] text-slate-400">{procedimentoAtivo.unidadeMedida}</span>
            </div>

            <button
              type="button"
              onClick={() => setModoBorracha(!modoBorracha)}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
                modoBorracha
                  ? 'bg-rose-500/20 text-rose-300 border border-rose-500/50 shadow-inner'
                  : 'bg-slate-800/70 text-slate-300 hover:bg-slate-700/80 border border-slate-700/60'
              }`}
              title="Modo Borracha (clique no ponto para apagar)"
            >
              <Eraser className="w-3.5 h-3.5" />
              <span>Borracha</span>
            </button>
          </div>
        )}
      </div>

      {/* ── ÁREA DO CANVAS COM ZOOM E PAN ── */}
      <div 
        ref={containerRef}
        className="relative w-full overflow-hidden bg-slate-950 flex items-center justify-center select-none"
        style={{ height: alturaMaxima }}
      >
        <TransformWrapper
          initialScale={1}
          minScale={0.8}
          maxScale={4}
          centerOnInit
          disabled={modoBorracha}
        >
          {({ zoomIn, zoomOut, resetTransform }) => (
            <>
              {/* Controles Flutuantes de Zoom */}
              <div className="absolute top-3 right-3 z-30 flex flex-col gap-1.5 bg-slate-900/80 p-1.5 rounded-xl border border-slate-800 backdrop-blur-md shadow-xl">
                <button
                  type="button"
                  onClick={() => zoomIn()}
                  className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-300 transition-colors"
                  title="Aproximar"
                >
                  <ZoomIn className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => zoomOut()}
                  className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-300 transition-colors"
                  title="Afastar"
                >
                  <ZoomOut className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => resetTransform()}
                  className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-300 transition-colors"
                  title="Redefinir visualização"
                >
                  <RotateCcw className="w-4 h-4" />
                </button>
              </div>

              <TransformComponent
                wrapperClass="!w-full !h-full flex items-center justify-center"
                contentClass="flex items-center justify-center"
              >
                <div 
                  className="relative inline-block cursor-crosshair"
                  onClick={handleImageClick}
                >
                  {fotoUrl ? (
                    <img
                      ref={imgRef}
                      src={fotoUrl}
                      alt={`Vista ${vistaAtual}`}
                      className="max-h-[min(65dvh,600px)] object-contain rounded-lg shadow-2xl pointer-events-auto"
                      crossOrigin="anonymous"
                    />
                  ) : (
                    <div className="w-96 h-96 bg-slate-900/60 border-2 border-dashed border-slate-800 rounded-2xl flex flex-col items-center justify-center text-slate-500 gap-3">
                      <Layers className="w-12 h-12 stroke-1 text-slate-600" />
                      <p className="text-sm font-medium">Nenhuma foto selecionada para esta vista</p>
                    </div>
                  )}

                  {/* Renderização das marcações sobre a imagem */}
                  {pontosVista.map((pt) => {
                    const procIndex = pt.procedimentoIndex ?? 0;
                    const procColor = PROCEDIMENTO_PALETTE[procIndex % PROCEDIMENTO_PALETTE.length];

                    return (
                      <div
                        key={pt.id}
                        onClick={(e) => handlePontoClick(pt.id, e)}
                        className="absolute -translate-x-1/2 -translate-y-1/2 cursor-pointer transition-transform hover:scale-125 z-20 group"
                        style={{
                          left: `${pt.posX}%`,
                          top: `${pt.posY}%`,
                        }}
                        title={`Procedimento: ${procedimentosComCores[procIndex]?.nome || 'Principal'} | Dose: ${pt.quantidade}`}
                      >
                        <div
                          className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black text-white shadow-lg border-2"
                          style={{
                            backgroundColor: procColor.cor,
                            borderColor: '#ffffff',
                            boxShadow: `0 0 10px ${procColor.cor}`
                          }}
                        >
                          {pt.quantidade}
                        </div>

                        {/* Tooltip no Hover */}
                        <div className="opacity-0 group-hover:opacity-100 pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 px-2 py-1 bg-slate-950/90 text-white text-[10px] font-semibold rounded whitespace-nowrap shadow-xl border border-slate-800 backdrop-blur-md transition-opacity">
                          {procedimentosComCores[procIndex]?.nome}: {pt.quantidade} {procedimentosComCores[procIndex]?.unidadeMedida}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </TransformComponent>
            </>
          )}
        </TransformWrapper>
      </div>

      {/* ── RODAPÉ: Somatórios Separados por Procedimento ── */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 bg-slate-950 border-t border-slate-800 text-xs">
        <div className="flex items-center gap-4 flex-wrap">
          <span className="text-slate-400 font-semibold uppercase tracking-wider text-[11px]">Totais da Sessão:</span>
          {totaisPorProcedimento.map((tot, idx) => (
            <div key={idx} className="flex items-center gap-1.5 bg-slate-900/80 px-2.5 py-1 rounded-lg border border-slate-800">
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: tot.cor }} />
              <span className="text-slate-300 font-medium">{tot.nome}:</span>
              <span className="font-bold text-white">
                {tot.total.toFixed(1)} {tot.unidade}
              </span>
              <span className="text-[10px] text-slate-500">({tot.qtdPontos} pts)</span>
            </div>
          ))}
        </div>

        <div className="text-[11px] text-slate-500 flex items-center gap-1">
          <Info className="w-3.5 h-3.5" />
          <span>Clique para marcar · Alterne o procedimento ativo na barra superior</span>
        </div>
      </div>

    </div>
  );
}
