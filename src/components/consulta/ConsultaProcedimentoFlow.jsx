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
  procedimentosLote = [],
  activeProcedimentoIndex = 0,
  setActiveProcedimentoIndex = () => {},
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
  sugestaoProcedimentoEnviada = false,
  onSugestaoEnviada = () => {},
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
    const catId =
      catalogoId != null && String(catalogoId).trim() !== ''
        ? String(catalogoId).trim()
        : null;
    if (!nomeP || !obsP || (!catId && !sugestaoProcedimentoEnviada)) {
      setStep4Errors({
        nomeProcedimento: !nomeP || (!catId && !sugestaoProcedimentoEnviada),
        catalogoId: !catId && !sugestaoProcedimentoEnviada,
        observacoesExecucao: !obsP,
      });
      toast.error('Selecione o procedimento no catálogo e preencha as observações para continuar.');
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
    try {
      const hasNext = procedimentosLote && procedimentosLote.length > 1 && activeProcedimentoIndex < procedimentosLote.length - 1;
      
      if (hasNext) {
        if (typeof salvarProcedimentoEFotos === 'function') {
           const success = await salvarProcedimentoEFotos();
           if (!success) {
             return;
           }
        }
        
        toast.success('Procedimento salvo com sucesso! Preencha o próximo.');
        setObservacoesExecucao('');
        const nextIndex = activeProcedimentoIndex + 1;
        setActiveProcedimentoIndex(nextIndex);
        if (procedimentosLote && procedimentosLote[nextIndex]) {
          setNomeProcedimento(procedimentosLote[nextIndex].procedimentoNome || '');
          setNomeProcedimentoCatalogoId(procedimentosLote[nextIndex].catalogoProcedimentoSaudeId || null);
        }
        setPhase('registro');
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } else {
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
        
        if (typeof encerrarAtendimento === 'function') {
          await encerrarAtendimento();
        }
      }
    } catch (e) {
      toast.error('Erro ao finalizar atendimento. Verifique os dados.');
      console.error(e);
    }
  };

  if (phase === 'registro') {
    return (
      <>
        {/* The tabs were removed as requested by the user, because the procedure is selected in the form itself. */}
        <Step4Procedimento
          pacienteIdForProcedures={pacienteIdForProcedures}
          nomeProcedimento={procedimentosLote?.[activeProcedimentoIndex]?.procedimentoNome || nomeProcedimento}
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
          onSugestaoEnviada={onSugestaoEnviada}
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
                : procedimentosLote && procedimentosLote.length > 1 && activeProcedimentoIndex < procedimentosLote.length - 1
                  ? 'Salvar e Próximo Procedimento ➔'
                  : 'Finalizar Atendimento ✓'}
        </button>
      </div>
    </>
  );
}
