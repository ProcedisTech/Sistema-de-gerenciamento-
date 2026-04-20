import React, { useCallback, useEffect } from 'react';
import { useToast } from '../../contexts/useToast.js';
import { useMediaQuery } from '../../hooks/useMediaQuery';
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

/**
 * Editor fullscreen de anotação (canvas sobre imagem), compartilhado entre
 * avaliação, procedimento e resumo da finalização.
 */
export function JourneyPhotoAnnotationEditor({
  sidebarInsetPx = 220,
  /** Lista exibida (miniaturas + foto atual); índices alinhados a `saveListLength` / callbacks. */
  photos = [],
  editingIndex,
  setEditingIndex,
  /** Se `editingIndex` for null, usa este índice ao salvar (ex.: avaliação). */
  fallbackSelectedPhotoIndex = null,
  /** Comprimento da lista “real” para validar slot em `onAnnotatedCaptureSaved` (ex.: lista completa antes do slice). */
  saveListLength,
  imageSrc,
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
  selectedPatientCpf = '',
  cpf = '',
  setPatients,
  onSelectCapturedPhoto,
  onAnnotatedCaptureSaved,
  persistAnnotatedPhotoToGallery,
  onClose,
  /** Chamado após salvar com sucesso (ex.: Step3 avança para próxima foto não anotada). */
  onAfterSaveAnnotated,
}) {
  const toast = useToast();
  const isMdUp = useMediaQuery('(min-width: 768px)');

  const listLen = typeof saveListLength === 'number' ? saveListLength : photos?.length ?? 0;

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
    if (!imageSrc || !canvasRef.current || !containerRef.current) return undefined;
    const updateCanvasSize = () => {
      const { width, height } = containerRef.current.getBoundingClientRect();
      canvasRef.current.width = width;
      canvasRef.current.height = height;
      redrawCanvas();
    };
    updateCanvasSize();
    window.addEventListener('resize', updateCanvasSize);
    return () => window.removeEventListener('resize', updateCanvasSize);
  }, [imageSrc, canvasRef, containerRef, redrawCanvas]);

  const saveAnnotatedPhoto = async () => {
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
    const idx =
      typeof editingIndex === 'number' ? editingIndex : fallbackSelectedPhotoIndex;
    const hasSlot =
      typeof idx === 'number' &&
      idx >= 0 &&
      idx < listLen &&
      typeof onAnnotatedCaptureSaved === 'function';

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
    if (targetCpf && !hasSlot && typeof setPatients === 'function') {
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

    onAfterSaveAnnotated?.();
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

  if (editingIndex == null || !photos[editingIndex]) return null;

  const otherIndices = photos.map((_, i) => i).filter((i) => i !== editingIndex);

  return (
    <div
      className="fixed inset-0 z-[140] flex flex-col bg-[#0f172a]"
      style={{ left: isMdUp ? sidebarInsetPx : 0 }}
    >
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
          onClick={() => onClose?.()}
          className="flex h-11 w-full shrink-0 items-center justify-center gap-2 rounded-xl border border-transparent bg-[#00a88e] px-4 text-[14px] font-semibold text-white shadow-sm outline-none transition-all hover:bg-[#00967f] sm:w-auto sm:px-6 lg:min-h-0"
        >
          ← Voltar para fotos
        </button>
        <div className="min-w-0 w-full flex-1 overflow-x-auto [-webkit-overflow-scrolling:touch] sm:max-w-none">
          <div className="flex gap-2 pb-0.5">
            {otherIndices.map((i) => {
              const ph = photos[i];
              const ann = ph?.meta?.annotated === true;
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => {
                    setEditingIndex(i);
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
          onClick={saveAnnotatedPhoto}
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
