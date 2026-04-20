import React from 'react';
import { ChevronLeft, ChevronRight, CheckCircle, AlertTriangle } from 'lucide-react';
import { useToast } from '../../contexts/useToast.js';
import { toLocalISODate } from '../../utils/dateLimits.js';
import { evaluateProximoRetornoStep5 } from '../../utils/proximoRetornoStep5.js';
import { getPatientInitials as defaultGetPatientInitials } from '../utils';
import { Step2Anamnese } from './Step2Anamnese';
import { Step3Evaluation } from './Step3Evaluation';
import { Step3Termos, Step4Procedimento } from './Step4LGPD';
import { Step5Finalization } from './Step5Finalization';

export function JourneyPatientContextHeader({ pacienteAtual, onCancelJourney, getPatientInitials }) {
  if (!pacienteAtual) return null;
  const initialsFn = getPatientInitials ?? defaultGetPatientInitials;
  const iniciais = initialsFn(pacienteAtual.nome || '') || '—';
  const idadeLabel =
    pacienteAtual.idade != null && pacienteAtual.idade !== '' ? `${pacienteAtual.idade} anos` : null;

  const alertas = Array.isArray(pacienteAtual.alertasClinicosAtivos)
    ? pacienteAtual.alertasClinicosAtivos
    : [];

  return (
    <div className="sticky top-0 z-10 mb-3 flex w-full shrink-0 items-center gap-2 border-b border-[#e2e8f0] bg-white px-4 py-3 sm:gap-3 sm:px-6">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#00a88e] text-[12px] font-bold text-white sm:h-9 sm:w-9 sm:text-[13px] md:h-10 md:w-10">
        {iniciais}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="max-w-[160px] truncate text-[14px] font-bold text-[#0f172a] sm:max-w-none md:max-w-none">
            {pacienteAtual.nome || '—'}
          </span>
          {idadeLabel ? (
            <span className="hidden text-[12px] text-[#64748b] sm:inline">{idadeLabel}</span>
          ) : null}
          {alertas.map((alerta, i) => {
            const label = [alerta.titulo, alerta.valor].filter(Boolean).join(': ');
            const truncated = label.length > 50 ? `${label.slice(0, 47)}…` : label;
            return (
              <span
                key={i}
                title={label}
                className="inline-flex max-w-[min(100%,240px)] shrink-0 items-center gap-1 truncate rounded-full bg-[#DC2626] px-2 py-0.5 text-[10px] font-bold text-white sm:text-[11px]"
              >
                <AlertTriangle className="h-3 w-3 shrink-0" strokeWidth={2.5} aria-hidden />
                {truncated}
              </span>
            );
          })}
        </div>
        <div className="text-[12px] text-[#94a3b8]">Em atendimento</div>
      </div>

      {typeof onCancelJourney === 'function' ? (
        <button
          type="button"
          onClick={onCancelJourney}
          className="flex min-h-[44px] shrink-0 items-center gap-1 rounded-lg px-2 text-[12px] font-medium text-[#64748b] active:bg-[#f8fafc] active:text-[#0f172a] sm:px-3"
        >
          ← Cancelar
        </button>
      ) : null}
    </div>
  );
}

/**
 * Jornada em 5 etapas (sem check-in). O app principal usa `AppRefactored`;
 * este componente permanece para integrações que injetam o fluxo completo via props.
 */
export function JourneyView({
  currentStep,
  anamneseRef,
  queixa,
  setQueixa,
  expectativas,
  setExpectativas,
  observacoes = '',
  setObservacoes,
  pacienteId = null,
  step2Errors,
  setStep2Errors,
  savedAnamneseState,
  onSavedAnamneseStateChange,
  respostasAnamnese,
  salvarRespostaAnamnese,
  setRespostasAnamnese,
  onQueixaVisibilityChange,
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
  patients = [],
  setPatients,
  evaluationCapturedPhotos,
  evaluationSelectedPhotoIndex,
  setEvaluationSelectedPhotoIndex,
  onSelectCapturedPhoto,
  onDeleteCapturedPhoto,
  onAnnotatedCaptureSaved,
  persistAnnotatedPhotoToGallery,
  EVALUATION_PHOTO_MAX,
  termoLido,
  setTermoLido,
  termoAssinado,
  setTermoAssinado,
  termoAssinaturaDataUrl,
  setTermoAssinaturaDataUrl,
  profissionalAssinaturaDataUrl,
  setProfissionalAssinaturaDataUrl,
  step4Errors,
  setStep4Errors,
  termoTitulo,
  termoConteudo,
  termoSelecionadoId = null,
  setTermoSelecionadoId = () => {},
  nomeProcedimento,
  setNomeProcedimento,
  observacoesExecucao,
  setObservacoesExecucao,
  onProcedureUploadFiles,
  onProcedureRemovePhoto,
  /** Fotos do step 4; se omitido, usa `evaluationCapturedPhotos` (legado). */
  procedureCapturedPhotos: procedureCapturedPhotosStep4,
  uploadProcedureFiles: uploadProcedureFilesStep4,
  removeProcedurePhoto: removeProcedurePhotoStep4,
  orientacoes,
  setOrientacoes,
  procedureDateIso = toLocalISODate(),
  proximoRetornoDisplay: proximoRetornoDisplayProp,
  setProximoRetornoDisplay: setProximoRetornoDisplayProp,
  step5Errors,
  setStep5Errors,
  prevStep,
  handleNextStep,
  handleFinishJourney,
  isFinishing,
  pacienteAtual = null,
  onCancelJourney,
  getPatientInitials,
}) {
  const toast = useToast();

  const [localProximoRetornoDisplay, setLocalProximoRetornoDisplay] = React.useState('');
  const proximoRetornoDisplay =
    proximoRetornoDisplayProp !== undefined
      ? proximoRetornoDisplayProp
      : localProximoRetornoDisplay;
  const setProximoRetornoDisplay =
    setProximoRetornoDisplayProp ?? setLocalProximoRetornoDisplay;

  const step5RetornoBloqueiaFinal = React.useMemo(
    () =>
      evaluateProximoRetornoStep5(procedureDateIso, proximoRetornoDisplay).blocksFinish,
    [procedureDateIso, proximoRetornoDisplay]
  );

  const onFinishJourney = () => {
    if (!orientacoes) {
      toast.error(
        'Para prosseguir, confirme que recebeu e compreendeu as orientações pós-procedimento.'
      );
      return;
    }
    if (step5RetornoBloqueiaFinal) {
      toast.error('Corrija a data do próximo retorno ou deixe o campo vazio.');
      return;
    }
    handleFinishJourney();
  };

  const onNext = () => {
    if (currentStep === 3) {
      if (termoSelecionadoId == null || String(termoSelecionadoId).trim() === '') {
        toast.error('Selecione um termo de consentimento');
        return;
      }
      const hasProf = Boolean(profissionalAssinaturaDataUrl && String(profissionalAssinaturaDataUrl).length > 50);
      const hasPac = Boolean(termoAssinaturaDataUrl && String(termoAssinaturaDataUrl).length > 50);
      if (!termoLido || !hasProf || !hasPac) {
        toast.error('Confirme a leitura do termo e as assinaturas do profissional e do paciente.');
        return;
      }
    }
    if (currentStep === 4) {
      if (!String(nomeProcedimento || '').trim() || !String(observacoesExecucao || '').trim()) {
        toast.error('Preencha o nome do procedimento e as observações da execução.');
        return;
      }
    }
    handleNextStep();
  };

  return (
    <div className="relative pb-24 md:pb-28">
      <JourneyPatientContextHeader
        pacienteAtual={pacienteAtual}
        onCancelJourney={onCancelJourney}
        getPatientInitials={getPatientInitials}
      />

      <div key={currentStep} className="animate-in fade-in slide-in-from-right-4 duration-200">
      {currentStep === 1 && (
        <Step2Anamnese
          ref={anamneseRef}
          queixa={queixa}
          setQueixa={setQueixa}
          expectativas={expectativas}
          setExpectativas={setExpectativas}
          pacienteId={pacienteId ?? pacienteAtual?.id ?? null}
          step2Errors={step2Errors}
          setStep2Errors={setStep2Errors}
          savedAnamneseState={savedAnamneseState}
          onSavedAnamneseStateChange={onSavedAnamneseStateChange}
          respostasAnamnese={respostasAnamnese}
          salvarRespostaAnamnese={salvarRespostaAnamnese}
          setRespostasAnamnese={setRespostasAnamnese}
          onQueixaVisibilityChange={onQueixaVisibilityChange}
        />
      )}

      {currentStep === 2 && (
        <Step3Evaluation
          imageSrc={imageSrc}
          setImageSrc={setImageSrc}
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
          patients={patients}
          setPatients={setPatients}
          evaluationCapturedPhotos={evaluationCapturedPhotos}
          evaluationSelectedPhotoIndex={evaluationSelectedPhotoIndex}
          setEvaluationSelectedPhotoIndex={setEvaluationSelectedPhotoIndex}
          onSelectCapturedPhoto={onSelectCapturedPhoto}
          onDeleteCapturedPhoto={onDeleteCapturedPhoto}
          onAnnotatedCaptureSaved={onAnnotatedCaptureSaved}
          persistAnnotatedPhotoToGallery={persistAnnotatedPhotoToGallery}
          evaluationPhotoMax={EVALUATION_PHOTO_MAX}
          observacoes={observacoes}
          setObservacoes={setObservacoes}
        />
      )}

      {currentStep === 3 && (
        <Step3Termos
          termoLido={termoLido}
          setTermoLido={setTermoLido}
          termoAssinaturaDataUrl={termoAssinaturaDataUrl}
          setTermoAssinaturaDataUrl={setTermoAssinaturaDataUrl}
          setTermoAssinado={setTermoAssinado}
          profissionalAssinaturaDataUrl={profissionalAssinaturaDataUrl}
          setProfissionalAssinaturaDataUrl={setProfissionalAssinaturaDataUrl}
          step4Errors={step4Errors}
          setStep4Errors={setStep4Errors}
          termoTitulo={termoTitulo}
          termoConteudo={termoConteudo}
          onTermoChange={(id) => setTermoSelecionadoId(id)}
        />
      )}

      {currentStep === 4 && (
        <Step4Procedimento
          pacienteIdForProcedures={pacienteId ?? pacienteAtual?.id ?? null}
          nomeProcedimento={nomeProcedimento}
          setNomeProcedimento={setNomeProcedimento}
          observacoesExecucao={observacoesExecucao}
          setObservacoesExecucao={setObservacoesExecucao}
          procedureCapturedPhotos={procedureCapturedPhotosStep4 ?? evaluationCapturedPhotos}
          procedurePhotoMax={EVALUATION_PHOTO_MAX}
          onProcedureUploadFiles={uploadProcedureFilesStep4 ?? onProcedureUploadFiles}
          onProcedureRemovePhoto={removeProcedurePhotoStep4 ?? onProcedureRemovePhoto}
          step4Errors={step4Errors}
          setStep4Errors={setStep4Errors}
        />
      )}

      {currentStep === 5 && (
        <Step5Finalization
          procedureDateIso={procedureDateIso}
          proximoRetornoDisplay={proximoRetornoDisplay}
          setProximoRetornoDisplay={setProximoRetornoDisplay}
          orientacoes={orientacoes}
          setOrientacoes={setOrientacoes}
          step5Errors={step5Errors}
          setStep5Errors={setStep5Errors}
        />
      )}
      </div>

      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-[30] hidden md:block md:pl-[280px]">
        <div className="pointer-events-auto border-t border-[#e2e8f0] bg-white px-6 py-4 shadow-[0_-4px_24px_rgba(15,23,42,0.06)]">
          <div className="mx-auto grid w-full max-w-[960px] grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-4">
            <div className="flex justify-start">
              <button
                type="button"
                onClick={prevStep}
                disabled={currentStep === 1 || isFinishing}
                className={`flex items-center justify-center gap-2 rounded-xl border-[2px] px-5 py-2.5 text-[13px] font-semibold outline-none transition-all ${
                  currentStep === 1 || isFinishing
                    ? 'cursor-not-allowed border-[#e2e8f0] bg-[#f8fbfb] text-[#94a3b8]'
                    : 'border-[#e2e8f0] bg-white text-[#00a88e] hover:border-[#00a88e]/40 hover:bg-[#f0fdf9]'
                }`}
              >
                <ChevronLeft className="h-4 w-4" strokeWidth={3} /> Anterior
              </button>
            </div>
            <p className="text-center text-[12px] font-medium text-[#94a3b8]">
              Etapa {currentStep} de 5
            </p>
            <div className="flex justify-end">
              {currentStep < 5 ? (
                <button
                  type="button"
                  onClick={onNext}
                  className="flex h-11 items-center justify-center gap-2 rounded-xl bg-[#00a88e] px-6 text-[14px] font-semibold text-white shadow-sm outline-none transition-all hover:bg-[#00967f]"
                >
                  Próximo <ChevronRight className="h-4 w-4" strokeWidth={3} />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={onFinishJourney}
                  disabled={!orientacoes || isFinishing || step5RetornoBloqueiaFinal}
                  className={`flex h-11 items-center justify-center gap-2 rounded-xl px-6 text-[14px] font-semibold shadow-sm outline-none transition-all ${
                    orientacoes && !isFinishing && !step5RetornoBloqueiaFinal
                      ? 'animate-pulse bg-[#00a88e] text-white hover:bg-[#00967f]'
                      : 'cursor-not-allowed bg-[#f1f5f9] text-[#64748b]'
                  }`}
                >
                  {isFinishing
                    ? 'Salvando...'
                    : !orientacoes
                      ? 'Confirme as orientações para finalizar'
                      : step5RetornoBloqueiaFinal
                        ? 'Corrija a data de retorno'
                        : 'Finalizar Atendimento'}
                  <CheckCircle className="h-4 w-4" strokeWidth={3} />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
