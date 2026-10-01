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
  setProcedimentoDoCatalogo,
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
  onValidarTermosCatalogo,
  execucaoBloqueadaPorTermos = false,
  titulosTermosFaltantes = [],
  onIrParaTermosGate,
  consentimentosAguardandoExecucao = [],
  sugestaoProcedimentoEnviada = false,
  onSugestaoEnviada = () => {},
  onProcedureOpenCamera,
  onClearMapaCaptureIntent,
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

  const handleContinuar = async () => {
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

    if (typeof onValidarTermosCatalogo === 'function') {
      const todosCats = (procedimentosLote || [])
        .map((p) => p.nomeProcedimentoCatalogoId || p.catalogoProcedimentoSaudeId || p.catalogoId)
        .filter(Boolean);
      if (catId && !todosCats.includes(catId)) todosCats.push(catId);

      for (const cid of todosCats) {
        const ok = await onValidarTermosCatalogo(cid, nomeP);
        if (!ok) return;
      }
    }
    setStep4Errors({});
    setPhase('orientacoes');
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
      
      if (execucaoBloqueadaPorTermos) {
        toast.error('Assine os termos obrigatórios antes de finalizar o procedimento.');
        return;
      }
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
          <div className="mb-5 p-3 rounded-xl border border-teal-100 bg-teal-50/50 flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-teal-800">
              Sessão Clínica Unificada:
            </span>
            {procedimentosLote.map((proc, index) => {
              const isSelected = index === activeProcedimentoIndex;
              return (
                <button
                  key={index}
                  type="button"
                  onClick={() => setActiveProcedimentoIndex(index)}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-teal-600 text-white border border-teal-700 shadow-xs'
                      : 'bg-white border border-teal-200 text-teal-900 hover:bg-teal-50 shadow-2xs'
                  }`}
                >
                  <span className={`w-2 h-2 rounded-full shrink-0 ${isSelected ? 'bg-white' : 'bg-teal-500'}`} />
                  {proc.procedimentoNome || proc.nomeProcedimento || `Procedimento ${index + 1}`}
                </button>
              );
            })}
          </div>
        )}
        <Step4Procedimento
          pacienteIdForProcedures={pacienteIdForProcedures}
          nomeProcedimento={procedimentosLote?.[activeProcedimentoIndex]?.procedimentoNome || nomeProcedimento}
          setNomeProcedimento={setNomeProcedimento}
          setNomeProcedimentoCatalogoId={setNomeProcedimentoCatalogoId}
          setProcedimentoDoCatalogo={setProcedimentoDoCatalogo}
          onValidarTermosCatalogo={onValidarTermosCatalogo}
          execucaoBloqueadaPorTermos={execucaoBloqueadaPorTermos}
          titulosTermosFaltantes={titulosTermosFaltantes}
          onIrParaTermosGate={onIrParaTermosGate}
          consentimentosAguardandoExecucao={consentimentosAguardandoExecucao}
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
          onProcedureOpenCamera={execucaoBloqueadaPorTermos ? undefined : onProcedureOpenCamera}
          onClearMapaCaptureIntent={onClearMapaCaptureIntent}
        />
        <div className="mt-8 flex justify-end border-t border-app-border pt-8">
          <button
            type="button"
            onClick={handleContinuar}
            disabled={isSalvandoProcedimento || execucaoBloqueadaPorTermos}
            className="flex h-11 items-center justify-center gap-2 rounded-xl border border-transparent bg-[#00a88e] px-6 text-[14px] font-semibold text-white shadow-sm outline-none transition-all hover:bg-[#00967f] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSalvandoProcedimento ? 'Salvando…' : 'Ir para Finalização e Orientações'}
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
