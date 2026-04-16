import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Eye, Image as ImageIcon, Trash2, Camera, Plus, ChevronRight, Check, X, Upload } from 'lucide-react';
import { useToast } from '../../contexts/useToast.js';
import { formatPacienteGaleriaError } from '../../utils/pacienteGaleria.js';

const colors = [
  '#ef4444',
  '#f97316',
  '#f59e0b',
  '#eab308',
  '#84cc16',
  '#22c55e',
  '#10b981',
  '#14b8a6',
  '#06b6d4',
  '#0ea5e9',
  '#3b82f6',
  '#6366f1',
  '#8b5cf6',
  '#a855f7',
  '#d946ef',
  '#ec4899',
  '#f43f5e',
];

const MAX_PHOTOS = 6;

function isPhotoAnnotated(ph, idx, evaluationAnnotatedPhotoUrl, evaluationSelectedPhotoIndex) {
  if (ph?.meta?.annotated === true) return true;
  if (ph?.annotatedUrl) return true;
  if (evaluationSelectedPhotoIndex === idx && evaluationAnnotatedPhotoUrl) return true;
  return false;
}

export function Step3Evaluation({
  imageSrc,
  setImageSrc,
  activeTool,
  setActiveTool,
  activeColor,
  setActiveColor,
  pointSize,
  setPointSize,
  showPointNumbers,
  setShowPointNumbers,
  eraserSize,
  setEraserSize,
  cursorPos,
  setCursorPos,
  isHoveringCanvas,
  setIsHoveringCanvas,
  paths,
  setPaths,
  isDrawing,
  setIsDrawing,
  canvasRef,
  containerRef,
  evaluationAnnotatedPhotoUrl,
  setEvaluationAnnotatedPhotoUrl,
  selectedPatientCpf,
  cpf,
  setPatients,
  evaluationCapturedPhotos,
  evaluationSelectedPhotoIndex,
  setEvaluationSelectedPhotoIndex,
  onSelectCapturedPhoto,
  onDeleteCapturedPhoto,
  onAnnotatedCaptureSaved,
  persistAnnotatedPhotoToGallery,
  evaluationPhotoMax,
  /** Opcional: avança o passo da jornada após revisão (ex.: `handleNextStep`). */
  onStepComplete,
  /** Opcional: envia arquivos para a mesma fila da câmera (ex.: `cameraState.uploadPhotoFiles`). */
  onUploadFiles,
}) {
  const toast = useToast();
  const [phase, setPhase] = useState('capture');
  const [editingIndex, setEditingIndex] = useState(null);
  const [patientAgreed, setPatientAgreed] = useState(false);
  const reviewTopRef = useRef(null);
  const afterSaveNavigateRef = useRef(false);
  const prevPhaseRef = useRef(phase);

  const cap = Math.min(MAX_PHOTOS, Number(evaluationPhotoMax) || MAX_PHOTOS);
  const allPhotos = Array.isArray(evaluationCapturedPhotos) ? evaluationCapturedPhotos : [];
  const photos = allPhotos.slice(0, cap);

  const getPointerCoordinates = (event) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return null;
    const touch = event?.touches?.[0] || event?.changedTouches?.[0];
    const clientX = touch?.clientX ?? event?.clientX;
    const clientY = touch?.clientY ?? event?.clientY;
    if (typeof clientX !== 'number' || typeof clientY !== 'number') return null;
    return { x: clientX - rect.left, y: clientY - rect.top };
  };

  const redrawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    let currentPointNumber = 1;
    paths.forEach((path) => {
      ctx.beginPath();
      ctx.strokeStyle = path.tool === 'erase' ? 'rgba(0,0,0,1)' : path.color;
      ctx.fillStyle = path.tool === 'erase' ? 'rgba(0,0,0,1)' : path.color;
      ctx.lineWidth = path.width;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.globalCompositeOperation = path.tool === 'erase' ? 'destination-out' : 'source-over';
      if (path.tool === 'point' && path.points.length > 0) {
        const pt = path.points[0];
        const radius = path.size || 12;
        ctx.arc(pt.x, pt.y, radius, 0, 2 * Math.PI);
        ctx.fill();
        if (showPointNumbers) {
          ctx.globalCompositeOperation = 'source-over';
          const fontSize = Math.max(12, Math.min(radius * 1.2, 20));
          ctx.font = `bold ${fontSize}px sans-serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          if (radius >= 12) {
            ctx.fillStyle = '#ffffff';
            ctx.shadowColor = 'rgba(0,0,0,0.4)';
            ctx.shadowBlur = 3;
            ctx.fillText(currentPointNumber.toString(), pt.x, pt.y + 1);
            ctx.shadowBlur = 0;
          } else {
            ctx.fillStyle = path.color;
            ctx.shadowColor = 'rgba(255,255,255,0.9)';
            ctx.shadowBlur = 4;
            ctx.fillText(currentPointNumber.toString(), pt.x + radius + 10, pt.y - radius - 5);
            ctx.shadowBlur = 0;
          }
        }
        currentPointNumber++;
      } else if (path.points.length > 0) {
        ctx.moveTo(path.points[0].x, path.points[0].y);
        for (let i = 1; i < path.points.length; i++) ctx.lineTo(path.points[i].x, path.points[i].y);
        ctx.stroke();
      }
    });
    ctx.globalCompositeOperation = 'source-over';
  }, [canvasRef, paths, showPointNumbers]);

  useEffect(() => {
    if (phase !== 'editor' || !imageSrc || !canvasRef.current || !containerRef.current) return undefined;
    const updateCanvasSize = () => {
      const { width, height } = containerRef.current.getBoundingClientRect();
      canvasRef.current.width = width;
      canvasRef.current.height = height;
      redrawCanvas();
    };
    updateCanvasSize();
    window.addEventListener('resize', updateCanvasSize);
    return () => window.removeEventListener('resize', updateCanvasSize);
  }, [phase, imageSrc, canvasRef, containerRef, redrawCanvas]);

  useLayoutEffect(() => {
    if (phase === 'review' && reviewTopRef.current) {
      reviewTopRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [phase]);

  useEffect(() => {
    if (phase === 'review' && prevPhaseRef.current !== 'review') {
      setPatientAgreed(false);
    }
    prevPhaseRef.current = phase;
  }, [phase]);

  useLayoutEffect(() => {
    if (!afterSaveNavigateRef.current) return;
    afterSaveNavigateRef.current = false;
    const list = Array.isArray(evaluationCapturedPhotos) ? evaluationCapturedPhotos : [];
    const nextIdx = list.findIndex((ph, i) => i < cap && ph?.meta?.annotated !== true);
    if (nextIdx >= 0) {
      setEditingIndex(nextIdx);
      setEvaluationSelectedPhotoIndex(nextIdx);
      onSelectCapturedPhoto?.(nextIdx);
      setPaths([]);
    } else {
      setPhase('review');
      setEditingIndex(null);
    }
  }, [evaluationCapturedPhotos, cap, onSelectCapturedPhoto, setEvaluationSelectedPhotoIndex, setPaths]);

  useEffect(() => {
    if (editingIndex != null && photos.length > 0 && editingIndex >= photos.length) {
      setEditingIndex(null);
      if (phase === 'editor') setPhase('capture');
    }
  }, [editingIndex, photos.length, phase]);

  const openEditorAt = (idx) => {
    if (idx < 0 || idx >= photos.length) return;
    setEditingIndex(idx);
    setPhase('editor');
    setEvaluationSelectedPhotoIndex(idx);
    onSelectCapturedPhoto?.(idx);
    setPaths([]);
  };

  const allAnnotatedInView = () =>
    photos.length > 0 && photos.every((_, i) => allPhotos[i]?.meta?.annotated === true);

  const firstUnannotatedIndex = () => photos.findIndex((_, i) => allPhotos[i]?.meta?.annotated !== true);

  const handleStartEvaluation = () => {
    if (photos.length < 1) return;
    if (allAnnotatedInView()) {
      setPhase('review');
      setEditingIndex(null);
      return;
    }
    const u = firstUnannotatedIndex();
    if (u >= 0) openEditorAt(u);
  };

  const saveAnnotatedEvaluationPhoto = async () => {
    if (!imageSrc) return;
    const overlayCanvas = canvasRef.current;
    if (!overlayCanvas) return;
    if (!paths || paths.length === 0) {
      toast.warning('Desenhe algo no canvas antes de salvar.');
      return;
    }

    const outCanvas = document.createElement('canvas');
    outCanvas.width = overlayCanvas.width;
    outCanvas.height = overlayCanvas.height;
    const ctx = outCanvas.getContext('2d');
    if (!ctx) return;

    const baseImg = new Image();
    baseImg.src = imageSrc;
    await new Promise((resolve, reject) => {
      baseImg.onload = () => resolve();
      baseImg.onerror = () => reject(new Error('Falha ao carregar imagem base.'));
    });

    const baseW = baseImg.naturalWidth || baseImg.width;
    const baseH = baseImg.naturalHeight || baseImg.height;
    const scale = Math.min(outCanvas.width / baseW, outCanvas.height / baseH);
    const drawW = baseW * scale;
    const drawH = baseH * scale;
    const dx = (outCanvas.width - drawW) / 2;
    const dy = (outCanvas.height - drawH) / 2;

    ctx.clearRect(0, 0, outCanvas.width, outCanvas.height);
    ctx.drawImage(baseImg, dx, dy, drawW, drawH);
    ctx.drawImage(overlayCanvas, 0, 0);

    const blob = await new Promise((resolve) => outCanvas.toBlob((b) => resolve(b), 'image/jpeg', 0.92));
    if (!blob) return;

    const url = URL.createObjectURL(blob);
    const idx = typeof editingIndex === 'number' ? editingIndex : evaluationSelectedPhotoIndex;
    const listLen = evaluationCapturedPhotos?.length ?? 0;
    const hasSlot =
      typeof idx === 'number' && idx >= 0 && idx < listLen && typeof onAnnotatedCaptureSaved === 'function';

    if (hasSlot) {
      onAnnotatedCaptureSaved({ index: idx, newUrl: url, blob });
    } else if (evaluationAnnotatedPhotoUrl) {
      try {
        URL.revokeObjectURL(evaluationAnnotatedPhotoUrl);
      } catch {
        // ignore
      }
    }
    setEvaluationAnnotatedPhotoUrl(url);

    const targetCpf = (selectedPatientCpf || cpf || '').trim();
    if (targetCpf && !hasSlot) {
      setPatients((prev) =>
        prev.map((p) =>
          (p.cpf || '').trim() !== targetCpf ? p : { ...p, evaluationAnnotatedPhotoUrl: url }
        )
      );
    }

    let uploadedToServer = false;
    if (typeof persistAnnotatedPhotoToGallery === 'function') {
      try {
        const r = await persistAnnotatedPhotoToGallery(blob);
        if (r?.ok) uploadedToServer = true;
        else if (r?.reason === 'no_server_id') {
          toast.info(
            'Paciente sem ID no servidor: a foto anotada ficou só neste aparelho. Após cadastrar, envie pela galeria do perfil ou salve de novo aqui.'
          );
        }
      } catch (e) {
        toast.error(formatPacienteGaleriaError(e));
      }
    }

    toast.success(
      uploadedToServer
        ? 'Foto anotada salva na ficha e enviada à galeria no servidor.'
        : 'Foto anotada salva na ficha do paciente.'
    );

    afterSaveNavigateRef.current = true;
  };

  const startDrawing = (e) => {
    const pointer = getPointerCoordinates(e);
    if (!pointer || !canvasRef.current) return;
    const { x, y } = pointer;
    setIsDrawing(true);
    if (activeTool === 'point') {
      setPaths((prev) => [
        ...prev,
        { tool: 'point', points: [{ x, y }], color: activeColor, size: pointSize, width: 3 },
      ]);
    } else {
      setPaths((prev) => [
        ...prev,
        {
          tool: activeTool,
          points: [{ x, y }],
          color: activeColor,
          width: activeTool === 'erase' ? eraserSize : 3,
        },
      ]);
    }
  };

  const handleMouseMove = (e) => {
    const pointer = getPointerCoordinates(e);
    if (!pointer || !canvasRef.current) return;
    const { x, y } = pointer;
    setCursorPos({ x, y });
    if (!isDrawing || !canvasRef.current) return;
    if (activeTool === 'point') return;
    setPaths((prev) => {
      const newPaths = [...prev];
      if (newPaths.length > 0) {
        const lastPath = newPaths[newPaths.length - 1];
        lastPath.points.push({ x, y });
      }
      return newPaths;
    });
  };

  const endDrawing = () => setIsDrawing(false);

  const handleMouseLeave = () => {
    setIsDrawing(false);
    setIsHoveringCanvas(false);
  };

  const handleMouseEnter = () => setIsHoveringCanvas(true);

  const handleDeletePhoto = (idx) => {
    onDeleteCapturedPhoto?.(idx);
    if (editingIndex === idx) {
      setEditingIndex(null);
      setPhase('capture');
      setPaths([]);
    }
  };

  const hasAnyAnnotatedGlobal = () => photos.some((_, i) => allPhotos[i]?.meta?.annotated === true);

  const handleConcluirReview = () => {
    if (!patientAgreed) return;
    if (typeof onStepComplete === 'function') {
      onStepComplete();
      return;
    }
    toast.info('Use o botão Próximo na barra inferior para continuar.');
  };

  const handlePularAvaliacao = () => {
    if (typeof onStepComplete === 'function') {
      onStepComplete();
    } else {
      toast.info('Use o botão Próximo na barra inferior para pular esta etapa.');
    }
  };

  /* ─── FASE 2: editor fullscreen ─── */
  if (phase === 'editor' && editingIndex != null && photos[editingIndex]) {
    const otherIndices = photos.map((_, i) => i).filter((i) => i !== editingIndex);
    return (
      <div className="fixed inset-0 z-[140] flex flex-col bg-[#0f172a] md:left-16 lg:left-[220px]">
        <div className="flex shrink-0 flex-col gap-2 border-b border-slate-700 bg-[#1e293b] px-3 py-2 text-white">
          <div className="flex flex-wrap items-center gap-2">
            {(['draw', 'point', 'erase']).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setActiveTool(t)}
                className={`flex min-h-[44px] shrink-0 items-center rounded-md px-3 text-[12px] font-semibold transition-colors lg:min-h-0 ${
                  activeTool === t ? 'bg-white text-[#1e293b]' : 'text-slate-300 active:text-white lg:hover:text-white'
                }`}
              >
                {t === 'draw' ? 'Desenhar' : t === 'point' ? 'Ponto' : 'Apagar'}
              </button>
            ))}
            <span className="hidden h-4 w-px shrink-0 bg-slate-500 sm:block" aria-hidden />
            <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1">
              {colors.slice(0, 12).map((color) => (
                <button
                  key={color}
                  type="button"
                  onClick={() => {
                    setActiveColor(color);
                    setActiveTool(activeTool === 'erase' ? 'draw' : activeTool);
                  }}
                  className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-white/10 outline-none lg:h-7 lg:w-7 ${
                    activeColor === color && activeTool !== 'erase'
                      ? 'ring-2 ring-white ring-offset-1 ring-offset-[#1e293b]'
                      : ''
                  }`}
                  aria-label={`Cor ${color}`}
                >
                  <span
                    className="h-5 w-5 rounded-full sm:h-5 sm:w-5"
                    style={{ backgroundColor: color }}
                  />
                </button>
              ))}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {(activeTool === 'point' || activeTool === 'erase') && (
              <input
                type="range"
                min={activeTool === 'point' ? '3' : '5'}
                max={activeTool === 'point' ? '40' : '100'}
                value={activeTool === 'point' ? pointSize : eraserSize}
                onChange={(e) =>
                  activeTool === 'point'
                    ? setPointSize(parseInt(e.target.value, 10))
                    : setEraserSize(parseInt(e.target.value, 10))
                }
                className="max-w-full min-w-[120px] flex-1 shrink-0 accent-white sm:max-w-[140px]"
              />
            )}
            {activeTool === 'point' && (
              <button
                type="button"
                onClick={() => setShowPointNumbers(!showPointNumbers)}
                className={`flex min-h-[44px] shrink-0 items-center rounded-md px-3 text-[12px] font-semibold lg:min-h-0 lg:px-2 ${
                  showPointNumbers ? 'bg-white/20 text-white' : 'text-slate-300 active:text-white lg:hover:text-white'
                }`}
              >
                Nº
              </button>
            )}
            <button
              type="button"
              onClick={() => setPaths((prev) => prev.slice(0, -1))}
              className="min-h-[44px] rounded-md px-2 text-[12px] font-medium text-slate-300 active:text-white lg:min-h-0 lg:hover:text-white"
            >
              Desfazer
            </button>
            <button
              type="button"
              onClick={() => setPaths([])}
              className="min-h-[44px] rounded-md px-2 text-[12px] font-medium text-slate-300 active:text-white lg:min-h-0 lg:hover:text-white"
            >
              Limpar
            </button>
            <span className="ml-auto shrink-0 text-[12px] text-slate-400">
              Foto {editingIndex + 1} de {photos.length}
            </span>
          </div>
        </div>

        <div className="relative flex-1 min-h-[45dvh] overflow-hidden sm:min-h-0">
          <div className="relative h-full min-h-[50vh] w-full" ref={containerRef}>
            <img src={imageSrc || ''} alt="" className="absolute inset-0 h-full w-full object-contain" />
            <canvas
              ref={canvasRef}
              onMouseDown={startDrawing}
              onMouseMove={handleMouseMove}
              onMouseUp={endDrawing}
              onMouseLeave={handleMouseLeave}
              onMouseEnter={handleMouseEnter}
              onTouchStart={startDrawing}
              onTouchMove={handleMouseMove}
              onTouchEnd={handleMouseLeave}
              className={`absolute inset-0 h-full w-full touch-none ${
                activeTool === 'erase' || activeTool === 'point' ? 'cursor-none' : 'cursor-crosshair'
              }`}
              style={{ zIndex: 10 }}
            />
            {isHoveringCanvas && (activeTool === 'erase' || activeTool === 'point') && (
              <div
                className="pointer-events-none absolute z-20 rounded-full shadow-sm"
                style={{
                  width: activeTool === 'erase' ? eraserSize : pointSize * 2,
                  height: activeTool === 'erase' ? eraserSize : pointSize * 2,
                  left: cursorPos.x - (activeTool === 'erase' ? eraserSize / 2 : pointSize),
                  top: cursorPos.y - (activeTool === 'erase' ? eraserSize / 2 : pointSize),
                  border: `2px solid ${activeTool === 'erase' ? 'rgba(255,255,255,0.8)' : activeColor}`,
                  backgroundColor: activeTool === 'erase' ? 'rgba(255,255,255,0.25)' : `${activeColor}55`,
                }}
              />
            )}
          </div>
        </div>

        <div className="flex shrink-0 flex-col gap-3 border-t border-[#e2e8f0] bg-white px-3 py-3 sm:flex-row sm:items-center">
          <button
            type="button"
            onClick={() => {
              setPhase('capture');
              setEditingIndex(null);
              setPaths([]);
            }}
            className="min-h-[44px] shrink-0 self-start text-[13px] font-medium text-[#64748b] active:text-[#0f172a] lg:min-h-0 lg:hover:text-[#0f172a]"
          >
            ← Voltar para fotos
          </button>
          <div className="min-w-0 w-full flex-1 overflow-x-auto [-webkit-overflow-scrolling:touch] sm:max-w-none">
            <div className="flex gap-2 pb-0.5">
              {otherIndices.map((i) => {
                const ph = photos[i];
                const ann = allPhotos[i]?.meta?.annotated === true;
                return (
                  <button
                    key={i}
                    type="button"
                    onClick={() => {
                      setEditingIndex(i);
                      setEvaluationSelectedPhotoIndex(i);
                      onSelectCapturedPhoto?.(i);
                      setPaths([]);
                    }}
                    className={`relative h-12 w-12 min-h-[48px] min-w-[48px] shrink-0 overflow-hidden rounded-lg border-2 lg:min-h-0 lg:min-w-0 ${
                      i === editingIndex ? 'border-[#00a88e]' : 'border-[#e2e8f0]'
                    }`}
                  >
                    <img src={ph?.url} alt="" className="h-full w-full object-cover" />
                    {ann ? (
                      <span className="absolute bottom-0.5 right-0.5 rounded bg-emerald-600 px-1 text-[9px] font-bold text-white">
                        ✓
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          </div>
          <button
            type="button"
            onClick={saveAnnotatedEvaluationPhoto}
            disabled={!paths || paths.length === 0}
            className={`min-h-[48px] w-full shrink-0 rounded-lg px-4 text-[14px] font-semibold transition-colors sm:min-h-[44px] sm:w-auto ${
              paths && paths.length > 0
                ? 'bg-[#00a88e] text-white active:bg-[#00967f] sm:hover:bg-[#00967f]'
                : 'cursor-not-allowed bg-[#e2e8f0] text-[#94a3b8]'
            }`}
          >
            Salvar anotação
          </button>
        </div>
      </div>
    );
  }

  /* ─── FASE 3: review ─── */
  if (phase === 'review') {
    const annotated = hasAnyAnnotatedGlobal();
    return (
      <div ref={reviewTopRef} className="flex min-h-0 flex-col pb-4">
        <div className="mb-6">
          <h3 className="text-[20px] font-bold text-[#0f172a]">Avaliação registrada</h3>
          <p className="text-[14px] font-medium text-[#64748b]">Revise as marcações com o paciente antes de prosseguir</p>
        </div>

        {!annotated ? (
          <div className="mb-6 rounded-xl border border-[#e2e8f0] bg-[#f8fafc] p-6 text-center">
            <p className="mb-4 text-[14px] font-medium text-[#64748b]">Nenhuma foto anotada nesta avaliação.</p>
            <button
              type="button"
              onClick={handlePularAvaliacao}
              className="rounded-lg bg-[#00a88e] px-5 py-2.5 text-[14px] font-semibold text-white hover:bg-[#00967f]"
            >
              Pular avaliação →
            </button>
          </div>
        ) : (
          <>
            <div className="mb-8 grid grid-cols-2 gap-4 md:grid-cols-3">
              {photos
                .map((ph, i) => ({ ph, i }))
                .filter(({ i }) => allPhotos[i]?.meta?.annotated === true)
                .map(({ ph, i }) => (
                  <div key={`${ph.url}_${i}`} className="relative aspect-square overflow-hidden rounded-xl bg-[#0f172a]">
                    <img src={ph.url} alt="" className="h-full w-full object-contain" />
                    <span className="absolute left-2 top-2 rounded-md bg-black/60 px-2 py-0.5 text-[11px] font-bold text-white">
                      Foto {i + 1}
                    </span>
                    <button
                      type="button"
                      onClick={() => openEditorAt(i)}
                      className="absolute bottom-2 right-2 rounded-lg bg-white/95 px-2 py-1 text-[11px] font-semibold text-[#0f172a] shadow hover:bg-white"
                    >
                      Reeditar
                    </button>
                  </div>
                ))}
            </div>

            <div className="rounded-xl border-2 border-[#00a88e]/40 bg-[#f0fdf9] p-5">
              <button
                type="button"
                onClick={() => setPatientAgreed(!patientAgreed)}
                className="flex w-full items-start gap-3 text-left"
              >
                <span
                  className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border-2 ${
                    patientAgreed ? 'border-[#00a88e] bg-[#00a88e]' : 'border-[#94a3b8] bg-white'
                  }`}
                >
                  {patientAgreed ? <Check className="h-3 w-3 text-white" strokeWidth={3} /> : null}
                </span>
                <span className="text-[14px] font-semibold leading-snug text-[#0f172a]">
                  O paciente confirma que revisou e concorda com o plano de avaliação acima
                </span>
              </button>
            </div>

            <div className="mt-6 flex justify-end">
              <button
                type="button"
                disabled={!patientAgreed}
                onClick={handleConcluirReview}
                className={`rounded-xl px-6 py-3 text-[14px] font-semibold transition-colors ${
                  patientAgreed
                    ? 'bg-[#00a88e] text-white hover:bg-[#00967f]'
                    : 'cursor-not-allowed bg-[#e2e8f0] text-[#94a3b8]'
                }`}
              >
                Concluir Avaliação
              </button>
            </div>
          </>
        )}
      </div>
    );
  }

  /* ─── FASE 1: capture ─── */
  return (
    <div className="relative flex min-h-0 flex-col">
      <div className="mb-6 flex shrink-0 items-center gap-4 px-0.5">
        <div className="rounded-xl border border-[#e2e8f0] bg-[#eff6ff] p-2.5 text-[#3b82f6]">
          <Eye className="h-6 w-6" strokeWidth={2.5} />
        </div>
        <div>
          <h3 className="text-[18px] font-bold text-[#0f172a]">Avaliação e Mapeamento</h3>
          <p className="text-[13px] font-medium text-[#64748b]">Capture, anote e revise com o paciente</p>
        </div>
      </div>

      {photos.length === 0 ? (
        <div className="mx-auto flex max-w-md flex-col items-center rounded-2xl border border-[#e2e8f0] bg-white px-8 py-12 text-center shadow-sm">
          <Camera className="mb-4 h-16 w-16 text-[#00a88e]" strokeWidth={1.25} />
          <h4 className="mb-2 text-[17px] font-bold text-[#0f172a]">Capture as fotos do paciente</h4>
          <ul className="mb-4 w-full space-y-2 text-left text-[13px] font-medium text-[#475569]">
            <li>· Frente (visão frontal)</li>
            <li>· Perfil esquerdo</li>
            <li>· Perfil direito</li>
            <li>· Vista inferior (queixo)</li>
            <li>· Detalhe da área de aplicação</li>
          </ul>
          <p className="text-[13px] font-medium text-[#64748b]">
            Use o botão câmera ou faça upload. Máximo {cap} fotos.
          </p>
          <label className="mt-4 inline-flex cursor-pointer items-center gap-2 rounded-lg bg-[#00a88e] px-4 py-2.5 text-[13px] font-semibold text-white transition-colors hover:bg-[#00967f]">
            <Upload className="h-4 w-4" strokeWidth={2.5} />
            Fazer upload de foto
            <input
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => {
                const files = Array.from(e.target.files || []).filter((f) => f.type.startsWith('image/'));
                e.target.value = '';
                if (!files.length) return;
                if (typeof onUploadFiles === 'function') {
                  onUploadFiles(files);
                }
              }}
            />
          </label>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
          {photos.map((ph, idx) => (
            <div
              key={`${ph.url}_${idx}`}
              className="group relative aspect-square overflow-hidden rounded-xl bg-[#f1f5f9]"
            >
              <img src={ph.url} alt="" className="h-full w-full object-cover" />
              <span className="absolute left-2 top-2 flex h-6 min-w-[1.5rem] items-center justify-center rounded-md bg-black/55 px-1.5 text-[11px] font-bold text-white">
                {idx + 1}
              </span>
              {isPhotoAnnotated(ph, idx, evaluationAnnotatedPhotoUrl, evaluationSelectedPhotoIndex) ? (
                <span className="absolute bottom-2 left-2 rounded-md bg-emerald-600 px-2 py-0.5 text-[10px] font-bold text-white">
                  ✓ Anotada
                </span>
              ) : null}
              <button
                type="button"
                onClick={() => handleDeletePhoto(idx)}
                className="absolute right-1 top-1 flex h-10 w-10 items-center justify-center rounded-full bg-[#dc2626] text-white shadow-md active:bg-[#b91c1c] sm:right-2 sm:top-2 sm:h-7 sm:w-7 sm:hover:bg-[#b91c1c]"
                aria-label="Remover foto"
              >
                <X className="h-4 w-4" strokeWidth={2.5} />
              </button>
              <button
                type="button"
                onClick={() => openEditorAt(idx)}
                className="absolute inset-0 flex items-center justify-center bg-black/35 opacity-100 transition-all sm:bg-black/0 sm:opacity-0 sm:group-hover:bg-black/45 sm:group-hover:opacity-100"
              >
                <span className="rounded-lg bg-white px-3 py-2 text-[12px] font-bold text-[#0f172a] shadow sm:py-1.5">Anotar</span>
              </button>
            </div>
          ))}
          {photos.length < cap ? (
            <div className="relative aspect-square">
              <label className="flex h-full w-full cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-[#cbd5e1] bg-[#f8fafc] text-[#94a3b8] hover:border-[#00a88e]/40 hover:bg-[#f0fdf9]">
                <Plus className="mb-1 h-8 w-8" strokeWidth={2} />
                <span className="text-[11px] font-semibold">Adicionar</span>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={(e) => {
                    const files = Array.from(e.target.files || []).filter((f) => f.type.startsWith('image/'));
                    e.target.value = '';
                    if (!files.length) return;
                    if (typeof onUploadFiles === 'function') {
                      onUploadFiles(files);
                    }
                  }}
                />
              </label>
            </div>
          ) : null}
        </div>
      )}

      {photos.length >= 1 ? (
        <div className="mt-8 flex justify-center">
          <button
            type="button"
            onClick={handleStartEvaluation}
            className="inline-flex min-h-[48px] w-full max-w-md items-center justify-center gap-2 rounded-xl bg-[#00a88e] px-6 py-3 text-[14px] font-semibold text-white shadow-sm active:bg-[#00967f] sm:min-h-[44px] sm:w-auto sm:hover:bg-[#00967f]"
          >
            Iniciar Avaliação
            <ChevronRight className="h-4 w-4" strokeWidth={2.5} />
          </button>
        </div>
      ) : null}
    </div>
  );
}
