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
  setProcedureCapturedPhotos,
  updateProcedureByIndex,
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

  encerrarAtendimento,
  isSalvandoProcedimento = false,
  isFinishing = false,
  step5RetornoBloqueiaFinal = false,
  toast,
}) {
  const [phase, setPhase] = useState('registro');

  const oldIndexRef = React.useRef(activeProcedimentoIndex);

  React.useEffect(() => {
    if (oldIndexRef.current !== activeProcedimentoIndex) {
      const oldIndex = oldIndexRef.current;
      
      // Salvar snapshot da aba antiga
      if (typeof updateProcedureByIndex === 'function') {
        updateProcedureByIndex(oldIndex, {
          mapaSnapshot: mapaState?.getSnapshotForPersist(),
          fotosSnapshot: procedureCapturedPhotos
        });
      }

      // Restaurar snapshot da nova aba
      const newProc = procedimentosLote[activeProcedimentoIndex] || {};
      if (mapaState?.restoreSnapshot) {
        mapaState.restoreSnapshot(newProc.mapaSnapshot);
      }
      if (typeof setProcedureCapturedPhotos === 'function') {
        setProcedureCapturedPhotos(newProc.fotosSnapshot || []);
      }

      oldIndexRef.current = activeProcedimentoIndex;
    }
  }, [activeProcedimentoIndex, procedimentosLote, mapaState, procedureCapturedPhotos, setProcedureCapturedPhotos, updateProcedureByIndex]);

  const handleContinuar = () => {
    const nomeP = String(nomeProcedimento || '').trim();
    const catId =
      catalogoId != null && String(catalogoId).trim() !== ''
        ? String(catalogoId).trim()
        : null;
    if (!nomeP || (!catId && !sugestaoProcedimentoEnviada)) {
      setStep4Errors({
        nomeProcedimento: !nomeP || (!catId && !sugestaoProcedimentoEnviada),
        catalogoId: !catId && !sugestaoProcedimentoEnviada,
      });
      toast.error('Selecione o procedimento no catálogo para continuar.');
      return;
    }
    setStep4Errors({});
    
    if (procedimentosLote && procedimentosLote.length > 1 && activeProcedimentoIndex < procedimentosLote.length - 1) {
      // Tem mais procedimentos, vai para o próximo
      const nextIndex = activeProcedimentoIndex + 1;
      setActiveProcedimentoIndex(nextIndex);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      // É o último (ou o único), vai para orientações
      setPhase('orientacoes');
    }
  };

  const handleFinalizar = async () => {
    try {
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
    } catch (e) {
      toast.error('Erro ao finalizar atendimento. Verifique os dados.');
      console.error(e);
    }
  };

  if (phase === 'registro') {
    return (
      <>
        {procedimentosLote && procedimentosLote.length > 1 && (
          <div className="flex border-b border-[#e2e8f0] mb-6 overflow-x-auto">
            {procedimentosLote.map((proc, index) => (
              <button
                key={index}
                onClick={() => {
                  setActiveProcedimentoIndex(index);
                }}
                className={`px-5 py-3 font-semibold text-[13px] whitespace-nowrap border-b-2 transition-colors ${
                  activeProcedimentoIndex === index
                    ? 'border-[#00a88e] text-[#00a88e]'
                    : 'border-transparent text-[#64748b] hover:text-[#334155] hover:border-[#cbd5e1]'
                }`}
              >
                {index + 1}. {proc.procedimentoNome || proc.nomeProcedimento || 'Procedimento'}
              </button>
            ))}
          </div>
        )}
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
            {isSalvandoProcedimento 
              ? 'Salvando…' 
              : procedimentosLote && procedimentosLote.length > 1 && activeProcedimentoIndex < procedimentosLote.length - 1
                ? 'Próximo Procedimento ➔'
                : 'Ir para Finalização e Orientações'}
          </button>
        </div>
      </>
    );
  }

  return (
    <>
      <Step5Finalization
        key={String(nomeProcedimento || '')}
        procedimentosLote={procedimentosLote}
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
