import React, { useState } from 'react';
import { Step4Procedimento } from '../journey/Step4LGPD.jsx';
import { Step5Finalization } from '../journey/Step5Finalization.jsx';

/** Fluxo modular: registro do procedimento → orientações → encerramento. */
export function ConsultaProcedimentoFlow({
  // Step4
  pacienteIdForProcedures,
  nomeProcedimento,
  setNomeProcedimento,
  setNomeProcedimentoCatalogoId,
  observacoesExecucao,
  setObservacoesExecucao,
  procedureCapturedPhotos,
  procedurePhotoMax,
  onProcedureUploadFiles,
  onProcedureRemovePhoto,
  step4Errors,
  setStep4Errors,
  fotosAvaliacao,
  onProcedureFotoCategoriaSync,
  onProcedureAnnotatePhoto,
  mapaState = null,
  roleUserId = null,
  procedimentoFeitoId = null,
  catalogoId = null,
  planejamentoItemId = null,
  planejamentoId = null,
  procedimentosComPontos = [],
  sidebarInsetPx = 0,
  pendingMapaCapture = null,
  onMapaCaptureConsumed = () => {},
  onPrepareMapaCapture = () => {},
  onEnsureProcedimento = () => Promise.resolve(null),
  // Step5
  procedureDateIso,
  proximoRetornoDisplay,
  setProximoRetornoDisplay,
  orientacoes,
  orientacoesItens,
  setOrientacoesItens,
  orientacoesCarregadas,
  setOrientacoesCarregadas,
  step5Errors,
  setStep5Errors,
  pacienteNome,
  pacienteIdade,
  pacienteCpf,
  telefonePaciente,
  queixa,
  profissionalAssinaturaDataUrl,
  termoAssinaturaDataUrl,
  termoTitulo,
  nomeUsuario,
  onAnnotateEvaluationPhoto,
  onAnnotateProcedurePhoto,
  // Ações
  salvarProcedimentoEFotos,
  encerrarAtendimento,
  isSalvandoProcedimento = false,
  isFinishing = false,
  step5RetornoBloqueiaFinal = false,
  toast,
}) {
  const [phase, setPhase] = useState('registro');

  const handleContinuar = async () => {
    const nomeP = String(nomeProcedimento || '').trim();
    const obsP = String(observacoesExecucao || '').trim();
    if (!nomeP || !obsP) {
      setStep4Errors({
        nomeProcedimento: !nomeP,
        observacoesExecucao: !obsP,
      });
      toast.error('Preencha o nome do procedimento e as observações da execução para continuar.');
      return;
    }
    setStep4Errors({});
    try {
      await salvarProcedimentoEFotos();
      setPhase('orientacoes');
    } catch {
      // Erro já tratado em salvarProcedimentoEFotos
    }
  };

  const handleFinalizar = async () => {
    if (!orientacoes) {
      setStep5Errors({ orientacoes: !orientacoes });
      toast.error('Marque ao menos uma orientação pós-procedimento para continuar.');
      return;
    }
    if (step5RetornoBloqueiaFinal) {
      toast.error('Corrija a data do próximo retorno ou deixe o campo vazio.');
      return;
    }
    setStep5Errors({});
    try {
      await encerrarAtendimento();
    } catch {
      // Erro já tratado em encerrarAtendimento
    }
  };

  if (phase === 'registro') {
    return (
      <>
        <Step4Procedimento
          pacienteIdForProcedures={pacienteIdForProcedures}
          nomeProcedimento={nomeProcedimento}
          setNomeProcedimento={setNomeProcedimento}
          setNomeProcedimentoCatalogoId={setNomeProcedimentoCatalogoId}
          observacoesExecucao={observacoesExecucao}
          setObservacoesExecucao={setObservacoesExecucao}
          procedureCapturedPhotos={procedureCapturedPhotos}
          procedurePhotoMax={procedurePhotoMax}
          onProcedureUploadFiles={onProcedureUploadFiles}
          onProcedureRemovePhoto={onProcedureRemovePhoto}
          step4Errors={step4Errors}
          setStep4Errors={setStep4Errors}
          fotosAvaliacao={fotosAvaliacao}
          onProcedureFotoCategoriaSync={onProcedureFotoCategoriaSync}
          onProcedureAnnotatePhoto={onProcedureAnnotatePhoto}
          mapaState={mapaState}
          roleUserId={roleUserId}
          procedimentoFeitoId={procedimentoFeitoId}
          catalogoId={catalogoId}
          planejamentoItemId={planejamentoItemId}
          planejamentoId={planejamentoId}
          procedimentosComPontos={procedimentosComPontos}
          sidebarInsetPx={sidebarInsetPx}
          pendingMapaCapture={pendingMapaCapture}
          onMapaCaptureConsumed={onMapaCaptureConsumed}
          onPrepareMapaCapture={onPrepareMapaCapture}
          onEnsureProcedimento={onEnsureProcedimento}
        />
        <div className="mt-8 flex justify-end border-t border-app-border pt-8">
          <button
            type="button"
            onClick={handleContinuar}
            disabled={isSalvandoProcedimento}
            className="flex h-11 items-center justify-center gap-2 rounded-xl border border-transparent bg-[#00a88e] px-6 text-[14px] font-semibold text-white shadow-sm outline-none transition-all hover:bg-[#00967f] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSalvandoProcedimento ? 'Salvando…' : 'Continuar'}
          </button>
        </div>
      </>
    );
  }

  return (
    <>
      <Step5Finalization
        key={String(nomeProcedimento || '')}
        procedureDateIso={procedureDateIso}
        proximoRetornoDisplay={proximoRetornoDisplay}
        setProximoRetornoDisplay={setProximoRetornoDisplay}
        orientacoes={orientacoes}
        orientacoesItens={orientacoesItens}
        setOrientacoesItens={setOrientacoesItens}
        orientacoesCarregadas={orientacoesCarregadas}
        setOrientacoesCarregadas={setOrientacoesCarregadas}
        step5Errors={step5Errors}
        setStep5Errors={setStep5Errors}
        pacienteNome={pacienteNome}
        pacienteIdade={pacienteIdade}
        pacienteCpf={pacienteCpf}
        telefonePaciente={telefonePaciente}
        nomeProcedimento={nomeProcedimento ?? ''}
        observacoesProcedimento={observacoesExecucao ?? ''}
        queixa={queixa ?? ''}
        alertasAnamnese={[]}
        alertasAlergia={[]}
        profissionalAssinaturaDataUrl={profissionalAssinaturaDataUrl ?? ''}
        termoAssinaturaDataUrl={termoAssinaturaDataUrl ?? ''}
        profAssinaturaTimestamp={null}
        patAssinaturaTimestamp={null}
        termoTitulo={termoTitulo ?? ''}
        fotosAvaliacao={fotosAvaliacao ?? []}
        fotosProcedimento={procedureCapturedPhotos ?? []}
        nomeUsuario={nomeUsuario ?? ''}
        onAnnotateEvaluationPhoto={onAnnotateEvaluationPhoto}
        onAnnotateProcedurePhoto={onAnnotateProcedurePhoto}
        hideProximoRetorno
      />
      <div className="mt-8 flex justify-end border-t border-app-border pt-8">
        <button
          type="button"
          onClick={handleFinalizar}
          disabled={isFinishing || !orientacoes || step5RetornoBloqueiaFinal}
          className={`flex h-11 items-center justify-center gap-2 rounded-xl border border-transparent px-6 text-[14px] font-semibold shadow-sm outline-none transition-all ${
            orientacoes && !step5RetornoBloqueiaFinal && !isFinishing
              ? 'animate-pulse bg-[#22c55e] text-white hover:bg-[#16a34a]'
              : 'cursor-not-allowed bg-[#f1f5f9] text-[#64748b]'
          }`}
        >
          {isFinishing
            ? 'Salvando...'
            : !orientacoes
              ? 'Confirme as orientações para finalizar'
              : step5RetornoBloqueiaFinal
                ? 'Corrija a data de retorno'
                : 'Finalizar Atendimento ✓'}
        </button>
      </div>
    </>
  );
}
