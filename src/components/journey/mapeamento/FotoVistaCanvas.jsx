import React, { useLayoutEffect, useRef, useState } from 'react';

import { Camera, ImageIcon, Maximize2, Upload, X } from 'lucide-react';
import { ProtectedPatientMedia } from '../../ui/ProtectedPatientMedia.jsx';

import {
  clickToPercent,
  getObjectContainMetrics,
  percentToContainerPositionFromMetrics,
} from '../../../utils/mapeamentoCoords.js';

import { corParaProcedimento } from '../../../constants/mapeamentoPaletaCores.js';
import {
  formatQuantidadeEtiqueta,
  MARKER_HIT_AREA_PX,
  markerSizePx,
  normalizeTamanho,
} from '../../../constants/mapeamentoMarcador.js';

import { PontoQuantidadeModal } from './PontoQuantidadeModal.jsx';

import { PontoMarcadorPopover } from './PontoMarcadorPopover.jsx';



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

  fillViewport = false,

  onOpenGaleria,

  onRequestCapture,

  onRequestUpload,

  onRequestFullscreen,

  emptyTitle = 'Adicione uma foto para esta vista',

  emptySubtitle = 'Escolha da galeria, capture ou faça upload do dispositivo.',

  unidadeMedida,

  onUnidadeMedidaChange,

  presets,

  passo,

}) {

  const containerRef = useRef(null);

  const imgRef = useRef(null);

  const fileInputRef = useRef(null);

  const [pendingClick, setPendingClick] = useState(null);

  const [pontoSelecionado, setPontoSelecionado] = useState(null);

  const [imgLayout, setImgLayout] = useState(EMPTY_LAYOUT);



  const displayUrl = foto?.displayUrl;

  const effectiveAspect = imgLayout.url === displayUrl ? imgLayout.aspect : null;

  const layoutMetrics = imgLayout.url === displayUrl ? imgLayout.metrics : null;



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



  const handleImageClick = (e) => {
    if (pontoSelecionado) {
      setPontoSelecionado(null);
      return;
    }

    if (!procedimentoArmado?.id || !foto?.displayUrl) return;

    const coords = clickToPercent(
      e.clientX,
      e.clientY,
      containerRef.current,
      imgRef.current,
    );

    if (!coords) return;

    setPendingClick(coords);
  };



  const handleConfirmQty = (quantidade) => {

    if (!pendingClick || !procedimentoArmado?.id) return;

    onAddPonto?.(vistaAtual, {

      ...pendingClick,

      quantidade,

    });

    setPendingClick(null);

  };



  const handleMarkerClick = (ev, p) => {

    ev.stopPropagation();

    setPendingClick(null);

    setPontoSelecionado({

      localId: p.localId,

      catalogoId: p.catalogoId,

      nomeProcedimento: p.nomeProcedimento,

      ponto: p,

      posX: p.posX,

      posY: p.posY,

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



  const canMark = Boolean(procedimentoArmado?.id && displayUrl);



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

          <div className="flex flex-wrap justify-center gap-3">

            <button

              type="button"

              onClick={() => onOpenGaleria?.()}

              className="inline-flex items-center gap-2 rounded-xl border border-app-accent/40 bg-white px-4 py-2.5 text-[13px] font-semibold text-[#00a88e] shadow-sm hover:bg-app-nav-active"

            >

              <ImageIcon className="h-4 w-4" />

              Galeria

            </button>

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

        </div>

      ) : (

        <>

          <div

            className="flex min-h-0 flex-1 items-center justify-center rounded-xl bg-[#0f172a]"

            role="presentation"

          >

            <div

              ref={containerRef}

              className={`relative z-[1] ${containerSize} ${containerMaxH} max-w-full overflow-hidden rounded-xl pointer-events-auto ${canMark ? 'cursor-crosshair' : ''}`}

              style={effectiveAspect ? { aspectRatio: effectiveAspect } : undefined}

              onClick={handleImageClick}

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

              {allPontos.map((p) => {

                const cor = corParaProcedimento(p.catalogoId);

                const selected = pontoSelecionado?.localId === p.localId;

                const containerPos = resolveContainerPos(p.posX, p.posY);

                const tamanho = normalizeTamanho(p.tamanho);
                const sizePx = markerSizePx(tamanho);

                return (

                  <div

                    key={p.localId}

                    className={`absolute -translate-x-1/2 -translate-y-1/2 ${

                      selected ? 'z-[30]' : 'z-[10]'

                    }`}

                    style={{

                      left: `${containerPos.left}%`,

                      top: `${containerPos.top}%`,

                    }}

                  >

                    <div className="relative" style={{ width: sizePx, height: sizePx }}>

                      <span

                        className="pointer-events-none absolute bottom-[calc(100%+5px)] left-1/2 -translate-x-1/2 whitespace-nowrap rounded px-2 py-1 text-[14px] font-medium leading-none text-white shadow-sm"

                        style={{ backgroundColor: cor }}

                        aria-hidden

                      >

                        {formatQuantidadeEtiqueta(p.quantidade, unidadeMedida)}

                      </span>

                      <button

                        type="button"

                        title={`${p.nomeProcedimento} — ${p.quantidade}`}

                        className="absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-0 bg-transparent p-0"

                        style={{

                          width: MARKER_HIT_AREA_PX,

                          height: MARKER_HIT_AREA_PX,

                        }}

                        onClick={(ev) => handleMarkerClick(ev, p)}

                      >

                        <span

                          className={`block rounded-full border-2 shadow-md transition-transform ${

                            selected

                              ? 'scale-110 border-yellow-300 ring-2 ring-yellow-300/50'

                              : 'border-white'

                          }`}

                          style={{

                            width: sizePx,

                            height: sizePx,

                            backgroundColor: cor,

                          }}

                        />

                      </button>

                    </div>

                  </div>

                );

              })}

              <PontoMarcadorPopover

                open={Boolean(pontoSelecionado)}

                ponto={pontoSelecionado?.ponto}

                nomeProcedimento={pontoSelecionado?.nomeProcedimento}

                catalogoId={pontoSelecionado?.catalogoId}

                anchorLeft={popoverAnchor?.left}

                anchorTop={popoverAnchor?.top}

                onSave={handleSavePonto}

                onRemove={handleRemovePonto}

                onCancel={() => setPontoSelecionado(null)}

                unidadeMedida={unidadeMedida}

                onUnidadeMedidaChange={onUnidadeMedidaChange}

                presets={presets}

                passo={passo}

              />

            </div>

          </div>

          {showToolbar ? (

            <div className="mt-2 flex shrink-0 flex-wrap items-center justify-between gap-2 rounded-xl border border-app-border bg-white px-3 py-2 shadow-sm">

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

          ) : null}

        </>

      )}



      <PontoQuantidadeModal

        open={Boolean(pendingClick)}

        procedimentoArmado={procedimentoArmado}

        onConfirm={handleConfirmQty}

        onCancel={() => setPendingClick(null)}

        unidadeMedida={unidadeMedida}

        onUnidadeMedidaChange={onUnidadeMedidaChange}

        presets={presets}

        passo={passo}

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


