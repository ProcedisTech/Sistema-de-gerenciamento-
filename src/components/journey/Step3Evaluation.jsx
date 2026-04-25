import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Eye, Image as ImageIcon, Trash2, Camera, Plus, ChevronRight, Check, X, Upload } from 'lucide-react';
import { useToast } from '../../contexts/useToast.js';
import { JourneyPhotoAnnotationEditor } from './JourneyPhotoAnnotationEditor.jsx';

const MAX_PHOTOS = 6;

function isPhotoAnnotated(ph, idx, evaluationAnnotatedPhotoUrl, evaluationSelectedPhotoIndex) {
  if (ph?.meta?.annotated === true) return true;
  if (ph?.annotatedUrl) return true;
  if (evaluationSelectedPhotoIndex === idx && evaluationAnnotatedPhotoUrl) return true;
  return false;
}

export function Step3Evaluation({
  /** Offset à esquerda em px (largura da sidebar) a partir de `md`, para fullscreen do editor. */
  sidebarInsetPx = 220,
  observacoes = '',
  setObservacoes,
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
      /* Todas as fotos atuais já estão anotadas: volta à captura (nunca review automático).
         Review só em handleStartEvaluation quando o usuário clica em "Iniciar Avaliação". */
      setPhase('capture');
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
    return (
      <JourneyPhotoAnnotationEditor
        sidebarInsetPx={sidebarInsetPx}
        photos={photos}
        editingIndex={editingIndex}
        setEditingIndex={setEditingIndex}
        fallbackSelectedPhotoIndex={evaluationSelectedPhotoIndex}
        saveListLength={allPhotos.length}
        imageSrc={imageSrc}
        activeTool={activeTool}
        setActiveTool={setActiveTool}
        activeColor={activeColor}
        setActiveColor={setActiveColor}
        pointSize={pointSize}
        setPointSize={setPointSize}
        showPointNumbers={showPointNumbers}
        setShowPointNumbers={setShowPointNumbers}
        eraserSize={eraserSize}
        setEraserSize={setEraserSize}
        cursorPos={cursorPos}
        setCursorPos={setCursorPos}
        isHoveringCanvas={isHoveringCanvas}
        setIsHoveringCanvas={setIsHoveringCanvas}
        paths={paths}
        setPaths={setPaths}
        isDrawing={isDrawing}
        setIsDrawing={setIsDrawing}
        canvasRef={canvasRef}
        containerRef={containerRef}
        evaluationAnnotatedPhotoUrl={evaluationAnnotatedPhotoUrl}
        setEvaluationAnnotatedPhotoUrl={setEvaluationAnnotatedPhotoUrl}
        selectedPatientCpf={selectedPatientCpf}
        cpf={cpf}
        setPatients={setPatients}
        onSelectCapturedPhoto={(i) => {
          setEvaluationSelectedPhotoIndex(i);
          onSelectCapturedPhoto?.(i);
        }}
        onAnnotatedCaptureSaved={onAnnotatedCaptureSaved}
        persistAnnotatedPhotoToGallery={persistAnnotatedPhotoToGallery}
        onClose={() => {
          setPhase('capture');
          setEditingIndex(null);
          setPaths([]);
        }}
        onAfterSaveAnnotated={() => {
          afterSaveNavigateRef.current = true;
        }}
      />
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

      <div className="mb-6 space-y-1.5">
        <label className="text-[13px] font-bold text-[#475569]">
          Observações e expectativas do paciente
        </label>
        <textarea
          rows={4}
          value={observacoes}
          onChange={(e) => typeof setObservacoes === 'function' && setObservacoes(e.target.value)}
          placeholder="Descreva as expectativas do paciente, procedimentos planejados, observações clínicas relevantes..."
          className="w-full resize-y rounded-xl border border-slate-200 bg-[#f8fafc] px-4 py-3 text-[14px] font-medium text-[#0f172a] outline-none transition-all focus:border-[#3b82f6] focus:ring-4 focus:ring-[#3b82f6]/10"
        />
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
