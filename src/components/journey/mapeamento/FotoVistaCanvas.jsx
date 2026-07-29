import React, { useLayoutEffect, useEffect, useRef, useState } from 'react';
import { TransformWrapper, TransformComponent } from 'react-zoom-pan-pinch';

import { Camera, ImageIcon, Maximize2, Upload, X, Eye, EyeOff } from 'lucide-react';
import { ProtectedPatientMedia } from '../../ui/ProtectedPatientMedia.jsx';

import {
  clickToPercent,
  getObjectContainMetrics,
  percentToContainerPositionFromMetrics,
} from '../../../utils/mapeamentoCoords.js';

import { simplifyCurveRDP, distance } from '../../../utils/geometry.js';

import { PontoQuantidadeModal } from './PontoQuantidadeModal.jsx';
import { PontoMarcadorPopover } from './PontoMarcadorPopover.jsx';
import { MapaToolbarModo } from './MapaToolbarModo.jsx';
import { TracadoEmProgresso } from './TracadoEmProgresso.jsx';
import { MapaComparacaoModal } from './MapaComparacaoModal.jsx';
import { MapaRetornoOverlay } from './MapaRetornoOverlay.jsx';
import { MapaMarcacoesOverlay } from './MapaMarcacoesOverlay.jsx';



const EMPTY_LAYOUT = { url: null, aspect: null, metrics: null };

const METRIC_KEYS = ['cw', 'ch', 'drawW', 'drawH', 'offsetX', 'offsetY'];

const METRIC_TOLERANCE = 0.5;

function metricsFromContainer(container, img) {
  const full = getObjectContainMetrics(container, img);
  if (!full) return null;
  const { cw, ch, drawW, drawH, offsetX, offsetY } = full;
  return { cw, ch, drawW, drawH, offsetX, offsetY };
}

function buildLayout(displayUrl, img, container) {
  if (!displayUrl || !img?.naturalWidth || !container) return null;
  return {
    url: displayUrl,
    aspect: `${img.naturalWidth} / ${img.naturalHeight}`,
    metrics: metricsFromContainer(container, img),
  };
}

function metricEqual(a, b) {
  return Math.abs(Number(a) - Number(b)) <= METRIC_TOLERANCE;
}

function layoutsEqual(a, b) {
  if (a === b) return true;
  if (!a || !b) return false;
  if (a.url !== b.url || a.aspect !== b.aspect) return false;
  if (a.metrics === b.metrics) return true;
  if (!a.metrics && !b.metrics) return true;
  if (!a.metrics || !b.metrics) return false;
  return METRIC_KEYS.every((key) => metricEqual(a.metrics[key], b.metrics[key]));
}

function commitImgLayoutIfChanged(setImgLayout, container, img, displayUrl) {
  if (!displayUrl || !img?.naturalWidth || !container) return;
  setImgLayout((prev) => {
    const next = buildLayout(displayUrl, img, container);
    if (!next) return prev;
    if (layoutsEqual(prev, next)) return prev;
    return next;
  });
}

export function FotoVistaCanvasCore({

  vistaAtual,

  foto,

  procedimentoArmado,

  pontosVista = [],

  onAddPonto,

  onEditarPonto,

  onRemovePonto,

  className = '',

  showToolbar = true,

  readOnly = false,

  fillViewport = false,

  onOpenGaleria,

  onRequestCapture,

  onRequestUpload,

  onRequestFullscreen,

  emptyTitle = 'Adicione uma foto para esta vista',

  emptySubtitle = 'Escolha da galeria, capture ou faça upload do dispositivo.',
  
  previewMode = false,

  tamanhoGlobalPonto = 1.0,

  unidadeMedida,

  onUnidadeMedidaChange,

  pacienteId,

  catalogoId,

  isRetorno,

  passo,

  externalModo,

  onModoChange,
  
  configMarcacao,
  
  mostrarValores: externalMostrarValores,
}) {
  const containerRef = useRef(null);
  const imgRef = useRef(null);
  const fileInputRef = useRef(null);

  const [pendingClick, setPendingClick] = useState(null);
  const [pontoSelecionado, setPontoSelecionado] = useState(null);
  const [imgLayout, setImgLayout] = useState(EMPTY_LAYOUT);
  
  // Novos estados do modo traço e valores
  const [internalModo, setInternalModo] = useState('ponto');
  const [internalMostrarValores, setInternalMostrarValores] = useState(true);
  
  const modo = externalModo !== undefined ? externalModo : internalModo;
  const setModo = onModoChange !== undefined ? onModoChange : setInternalModo;
  const mostrarValores = externalMostrarValores !== undefined ? externalMostrarValores : internalMostrarValores;
  const [pendingTraco, setPendingTraco] = useState(null);

  // Refs e states para desenho livre (freehand)
  const isDrawing = useRef(false);
  const liveVerticesRef = useRef([]); // Guarda os vértices sem depender do ciclo do React
  const [liveVertices, setLiveVertices] = useState([]); // Apenas para re-render visual
  
  // Overlay Historico
  const [comparacaoModalOpen, setComparacaoModalOpen] = useState(false);
  const [mapaComparacaoSelecionado, setMapaComparacaoSelecionado] = useState(null);

  const displayUrl = foto?.displayUrl;
  const effectiveAspect = imgLayout.url === displayUrl ? imgLayout.aspect : null;
  const layoutMetrics = imgLayout.url === displayUrl ? imgLayout.metrics : null;

  useEffect(() => {
    const handleEsc = (e) => {
      if (e.key === 'Escape' && isDrawing.current) {
        isDrawing.current = false;
        liveVerticesRef.current = [];
        setLiveVertices([]);
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, []);

  useEffect(() => {
    if (modo !== 'traco') {
      isDrawing.current = false;
      liveVerticesRef.current = [];
      setTimeout(() => setLiveVertices([]), 0);
    }
  }, [modo]);

  useLayoutEffect(() => {
    if (!displayUrl) return undefined;

    const container = containerRef.current;
    if (!container) return undefined;

    const syncLayout = () => {
      commitImgLayoutIfChanged(setImgLayout, container, imgRef.current, displayUrl);
    };

    if (imgRef.current?.complete && imgRef.current.naturalWidth) {
      syncLayout();
    }

    const ro = new ResizeObserver(syncLayout);
    ro.observe(container);
    return () => ro.disconnect();
  }, [displayUrl, fillViewport]);



  const allPontos = [];

  (pontosVista || []).forEach((grupo) => {

    (grupo.pontos || []).forEach((p) => {

      allPontos.push({

        ...p,

        catalogoId: grupo.catalogoProcedimentoSaudeId,

        nomeProcedimento: grupo.nomeProcedimento,

      });

    });

  });



  const resolveContainerPos = (posX, posY) => {

    const pos = percentToContainerPositionFromMetrics(posX, posY, layoutMetrics);

    if (pos) return pos;

    return { left: posX, top: posY };

  };



  const handlePointerDown = (e) => {
    if (readOnly) return;

    if (previewMode && onRequestFullscreen) {
      onRequestFullscreen();
      return;
    }

    if (pontoSelecionado) {
      setPontoSelecionado(null);
      return;
    }

    if (!procedimentoArmado?.id || !foto?.displayUrl) return;

    if (modo === 'ponto') {
      const coords = clickToPercent(e.clientX, e.clientY, containerRef.current, imgRef.current);
      if (!coords) return;
      
      if (configMarcacao?.confirmarDose === false) {
        onAddPonto?.(vistaAtual, {
          ...coords,
          quantidade: configMarcacao.dosePadrao || 1,
          tamanho: tamanhoGlobalPonto,
          profundidade: configMarcacao.profundidade ? Number(configMarcacao.profundidade) : undefined,
          tipoGeometria: 'ponto',
        });
      } else {
        setPendingClick(coords);
      }
      return;
    }

    if (modo === 'traco') {
      const coords = clickToPercent(e.clientX, e.clientY, containerRef.current, imgRef.current);
      if (!coords) return;
      
      e.currentTarget.setPointerCapture(e.pointerId);
      isDrawing.current = true;
      const initialPoint = { x: coords.posX, y: coords.posY };
      liveVerticesRef.current = [initialPoint];
      setLiveVertices([initialPoint]);
    }
  };

  const handlePointerMove = (e) => {
    if (readOnly) return;
    if (!isDrawing.current || modo !== 'traco') return;

    const coords = clickToPercent(e.clientX, e.clientY, containerRef.current, imgRef.current);
    if (!coords) return;

    const prev = liveVerticesRef.current;
    if (prev.length === 0) return;
    
    const last = prev[prev.length - 1];
    const p = { x: coords.posX, y: coords.posY };
    
    // Throttle: adiciona vértice apenas se moveu mais que 1% (~8px dependendo da tela)
    if (distance(last, p) > 1.0) {
      const newArray = [...prev, p];
      liveVerticesRef.current = newArray;
      setLiveVertices(newArray);
    }
  };

  const handlePointerUpOrCancel = (e) => {
    if (readOnly) return;
    if (!isDrawing.current || modo !== 'traco') return;
    
    isDrawing.current = false;
    e.currentTarget.releasePointerCapture(e.pointerId);

    const finalVertices = liveVerticesRef.current;
    // Se tiver arrastado o suficiente
    if (finalVertices.length > 1) {
      // RDP para simplificar. 0.5 de tolerância (em %).
      const simplified = simplifyCurveRDP(finalVertices, 0.5);
      if (simplified.length > 1) {
        if (configMarcacao?.confirmarDose === false) {
          onAddPonto?.(vistaAtual, {
            vertices: simplified,
            quantidade: configMarcacao.dosePadrao || 1,
            tamanho: tamanhoGlobalPonto,
            tipoGeometria: 'traco',
          });
        } else {
          setPendingTraco(simplified);
        }
      }
    }
    
    liveVerticesRef.current = [];
    setLiveVertices([]);
  };



  const handleConfirmQty = (quantidade, tamanho) => {
    if (!procedimentoArmado?.id) return;
    
    if (pendingClick) {
      onAddPonto?.(vistaAtual, {
        ...pendingClick,
        quantidade,
        tamanho: tamanho ?? tamanhoGlobalPonto,
        tipoGeometria: 'ponto',
      });
      setPendingClick(null);
    } else if (pendingTraco) {
      onAddPonto?.(vistaAtual, {
        vertices: pendingTraco,
        quantidade,
        tamanho,
        tipoGeometria: 'traco',
      });
      setPendingTraco(null);
    }
  };



  const handleMarkerClick = (ev, p) => {
    ev.stopPropagation();
    if (readOnly) return;

    if (modo === 'borracha') {
      onRemovePonto?.(p.catalogoId, vistaAtual, p.localId);
      return;
    }

    setPendingClick(null);

    let posX = p.posX;
    let posY = p.posY;
    
    // Se for traço, a âncora do popover será no último vértice (onde fica o marcador visual)
    if (p.tipoGeometria === 'traco' && p.vertices?.length > 0) {
      const lastV = p.vertices[p.vertices.length - 1];
      posX = lastV.posX ?? lastV.x;
      posY = lastV.posY ?? lastV.y;
    }

    setPontoSelecionado({
      localId: p.localId,
      catalogoId: p.catalogoId,
      nomeProcedimento: p.nomeProcedimento,
      ponto: p,
      posX,
      posY,
    });
  };



  const handleSavePonto = ({ quantidade, tamanho }) => {

    if (!pontoSelecionado) return;

    onEditarPonto?.(pontoSelecionado.catalogoId, vistaAtual, pontoSelecionado.localId, {
      quantidade,
      tamanho,
    });

    setPontoSelecionado(null);

  };



  const handleRemovePonto = () => {

    if (!pontoSelecionado) return;

    onRemovePonto?.(pontoSelecionado.catalogoId, vistaAtual, pontoSelecionado.localId);

    setPontoSelecionado(null);

  };



  const handleFileChange = (e) => {

    const file = e.target.files?.[0];

    e.target.value = '';

    if (file) onRequestUpload?.(file);

  };



  const canMark = Boolean(!readOnly && procedimentoArmado?.id && displayUrl);

  const effectiveShowToolbar = showToolbar && !readOnly;



  const handleImgLoad = () => {
    commitImgLayoutIfChanged(setImgLayout, containerRef.current, imgRef.current, displayUrl);
  };



  const containerMaxH = fillViewport ? 'max-h-full' : 'max-h-[min(70dvh,640px)]';

  const containerSize = fillViewport ? 'h-full w-full' : 'mx-auto w-full';



  const popoverAnchor = pontoSelecionado

    ? resolveContainerPos(pontoSelecionado.posX, pontoSelecionado.posY)

    : null;



  return (

    <div className={`flex min-h-[280px] flex-1 flex-col ${className}`}>

      {!displayUrl ? (

        <div className="flex flex-1 flex-col items-center justify-center gap-5 rounded-xl border border-dashed border-app-accent/30 bg-app-canvas p-8 text-center min-h-[320px]">

          <div className="rounded-xl bg-app-nav-active p-4 text-app-accent">

            <ImageIcon className="h-10 w-10" strokeWidth={1.25} />

          </div>

          <div>

            <p className="text-[15px] font-bold text-app-ink">{emptyTitle}</p>

            <p className="mt-1 text-[13px] font-medium text-[#64748b]">{emptySubtitle}</p>

          </div>

          {!readOnly ? (
            <div className="flex flex-wrap justify-center gap-3">

              {typeof onOpenGaleria === 'function' ? (
              <button

                type="button"

                onClick={() => onOpenGaleria()}

                className="inline-flex items-center gap-2 rounded-xl border border-app-accent/40 bg-white px-4 py-2.5 text-[13px] font-semibold text-[#00a88e] shadow-sm hover:bg-app-nav-active"

              >

                <ImageIcon className="h-4 w-4" />

                Galeria

              </button>
              ) : null}

              <button

                type="button"

                onClick={() => onRequestCapture?.()}

                className="inline-flex items-center gap-2 rounded-xl bg-app-accent px-4 py-2.5 text-[13px] font-semibold text-white shadow-sm hover:bg-[#00967f]"

              >

                <Camera className="h-4 w-4" />

                Capturar

              </button>

              <button

                type="button"

                onClick={() => fileInputRef.current?.click()}

                className="inline-flex items-center gap-2 rounded-xl border border-app-border bg-white px-4 py-2.5 text-[13px] font-semibold text-[#475569] shadow-sm hover:bg-[#f8fafc]"

              >

                <Upload className="h-4 w-4" />

                Upload

              </button>

              <input

                ref={fileInputRef}

                type="file"

                accept="image/*"

                className="hidden"

                onChange={handleFileChange}

              />

            </div>
          ) : null}

        </div>

      ) : (

        <>

          <div
            className="flex min-h-0 flex-1 items-center justify-center rounded-xl bg-[#0f172a] overflow-hidden"
            role="presentation"
          >
            <TransformWrapper
              panning={{ disabled: modo !== 'mover' }}
              doubleClick={{ disabled: true }}
              wheel={{ step: 0.05, smoothStep: 0.01 }}
              minScale={1}
              maxScale={5}
            >
              {({ state }) => (
                <TransformComponent wrapperClass="w-full h-full" contentClass="w-full h-full flex items-center justify-center">
                  <div
                    ref={containerRef}

              className={`relative z-[1] ${containerSize} ${containerMaxH} max-w-full overflow-hidden rounded-xl pointer-events-auto ${canMark ? 'cursor-crosshair' : ''} touch-none`}
              style={effectiveAspect ? { aspectRatio: effectiveAspect } : undefined}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUpOrCancel}
              onPointerCancel={handlePointerUpOrCancel}
              role="presentation"
            >
              <ProtectedPatientMedia
                ref={imgRef}
                interactive={true}
                src={displayUrl}
                alt=""
                className="z-0 h-full w-full pointer-events-none"
                imgClassName="h-full w-full object-contain pointer-events-none"
                onLoad={handleImgLoad}
              />

              <MapaRetornoOverlay 
                mapaComparacao={mapaComparacaoSelecionado} 
                layoutMetrics={layoutMetrics} 
              />

              <TracadoEmProgresso 
                vertices={liveVertices} 
                layoutMetrics={layoutMetrics} 
              />

              <MapaMarcacoesOverlay
                pontos={allPontos}
                layoutMetrics={layoutMetrics}
                density="full"
                mostrarValores={mostrarValores}
                unidadeMedida={unidadeMedida}
                interactive={!readOnly}
                selectedLocalId={pontoSelecionado?.localId ?? null}
                onMarkerPointerDown={handleMarkerClick}
              />

              <div style={{ transform: `scale(${1 / (state?.scale || 1)})`, transformOrigin: 'bottom center', position: 'absolute', top: `${popoverAnchor?.top}%`, left: `${popoverAnchor?.left}%`, zIndex: 40 }}>
                <PontoMarcadorPopover
                  open={Boolean(pontoSelecionado)}
                  ponto={pontoSelecionado?.ponto}
                  nomeProcedimento={pontoSelecionado?.nomeProcedimento}
                  catalogoId={pontoSelecionado?.catalogoId}
                  anchorLeft={0}
                  anchorTop={0}
                  onSave={handleSavePonto}
                  onRemove={handleRemovePonto}
                  onCancel={() => setPontoSelecionado(null)}
                  unidadeMedida={unidadeMedida}
                  onUnidadeMedidaChange={onUnidadeMedidaChange}
                  passo={passo}
                />
              </div>

            </div>
          </TransformComponent>
        )}
      </TransformWrapper>
    </div>

          {effectiveShowToolbar ? (
            <div className="mt-2 flex shrink-0 flex-wrap items-center justify-between gap-2 rounded-xl border border-app-border bg-white px-3 py-2 shadow-sm">
              <div className="flex flex-wrap items-center gap-4">
                <button
                  type="button"
                  title={mostrarValores ? "Ocultar valores na foto" : "Mostrar valores na foto"}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (externalMostrarValores === undefined) {
                      setInternalMostrarValores((prev) => !prev);
                    }
                  }}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[#e2e8f0] bg-white text-[#64748b] shadow-sm transition-colors hover:bg-slate-50 hover:text-app-accent-deep pointer-events-auto"
                >
                  {mostrarValores ? <Eye className="h-4 w-4" strokeWidth={2} /> : <EyeOff className="h-4 w-4" strokeWidth={2} />}
                </button>
                <MapaToolbarModo modo={modo} setModo={setModo} />
                <div className="h-6 w-px bg-app-border"></div>
                <div className="flex flex-wrap gap-2">

                <button

                  type="button"

                  onClick={() => onOpenGaleria?.()}

                  className="rounded-lg px-3 py-1.5 text-[12px] font-semibold text-[#64748b] hover:bg-[#f8fafc]"

                >

                  Trocar foto

                </button>

                <button

                  type="button"

                  onClick={() => fileInputRef.current?.click()}

                  className="inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-[12px] font-semibold text-[#64748b] hover:bg-[#f8fafc]"

                >

                  <Upload className="h-3.5 w-3.5" />

                  Upload

                </button>

                <input

                  ref={fileInputRef}

                  type="file"

                  accept="image/*"

                  className="hidden"

                  onChange={handleFileChange}

                />

              </div>

              <div className="flex flex-wrap items-center gap-2">
                {(isRetorno || (pacienteId && catalogoId)) ? (
                  <button
                    type="button"
                    onClick={() => setComparacaoModalOpen(true)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[12px] font-semibold text-[#64748b] hover:bg-slate-50 transition-colors"
                  >
                    Comparar com mapa anterior
                  </button>
                ) : null}

                {onRequestFullscreen ? (

                <button

                  type="button"

                  onClick={onRequestFullscreen}

                  className="inline-flex items-center gap-1.5 rounded-lg bg-app-nav-active px-3 py-1.5 text-[12px] font-semibold text-[#00a88e] hover:bg-[#e6f7f5]"

                >

                  <Maximize2 className="h-3.5 w-3.5" />

                  Tela cheia

                </button>

              ) : null}

            </div>
          </div>
        </div>
      ) : null}

    </>
  )}



      <PontoQuantidadeModal
        open={Boolean(pendingClick || pendingTraco)}
        procedimentoArmado={procedimentoArmado}
        modo={pendingTraco ? 'traco' : 'ponto'}
        onConfirm={handleConfirmQty}
        onCancel={() => {
          setPendingClick(null);
          setPendingTraco(null);
        }}
        unidadeMedida={unidadeMedida}
        onUnidadeMedidaChange={onUnidadeMedidaChange}
        passo={passo}
      />

      <MapaComparacaoModal
        open={comparacaoModalOpen}
        onClose={() => setComparacaoModalOpen(false)}
        pacienteId={pacienteId}
        catalogoId={catalogoId}
        onSelectMapa={(item) => {
          setMapaComparacaoSelecionado(item);
          setComparacaoModalOpen(false);
        }}
      />
    </div>
  );
}



export function FotoVistaCanvas(props) {

  return (

    <div className="flex min-h-[320px] flex-1 flex-col rounded-xl border border-app-border bg-white p-4 shadow-app-card">

      <FotoVistaCanvasCore {...props} />

    </div>

  );

}



/** Modal simples para escolher foto da galeria do paciente. */

export function GaleriaVistaPickerModal({ open, items, loading, onSelect, onClose }) {

  if (!open) return null;



  return (

    <div className="fixed inset-0 z-[145] flex items-center justify-center bg-black/50 p-4">

      <div

        role="dialog"

        aria-modal="true"

        className="flex max-h-[85vh] w-full max-w-lg flex-col rounded-2xl border border-app-border bg-white shadow-app-card"

      >

        <div className="flex items-center justify-between border-b border-[#e2e8f0] px-4 py-3">

          <h3 className="text-[15px] font-bold text-app-ink">Escolher da galeria</h3>

          <button type="button" onClick={onClose} className="rounded-lg p-1 text-[#64748b] hover:bg-slate-100">

            <X className="h-5 w-5" />

          </button>

        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-4">

          {loading ? (

            <p className="text-[13px] text-[#94a3b8]">Carregando…</p>

          ) : !items?.length ? (

            <p className="text-[13px] text-[#94a3b8]">Nenhuma foto na galeria.</p>

          ) : (

            <div className="grid grid-cols-3 gap-2">

              {items.map((item) => (

                <button

                  key={item.serverId}

                  type="button"

                  onClick={() => onSelect?.(item)}

                  className="aspect-square overflow-hidden rounded-xl border border-[#e2e8f0] bg-[#f1f5f9] hover:ring-2 hover:ring-app-accent"

                >

                  {item.thumbSrc ? (

                    <ProtectedPatientMedia src={item.thumbSrc} alt="" imgClassName="h-full w-full object-cover" />

                  ) : (

                    <span className="flex h-full items-center justify-center text-[11px] text-[#94a3b8]">…</span>

                  )}

                </button>

              ))}

            </div>

          )}

        </div>

      </div>

    </div>

  );

}


