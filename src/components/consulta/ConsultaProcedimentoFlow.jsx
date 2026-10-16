import React, { useState } from 'react';
import { ShieldCheck, CheckCircle2, Info, AlertCircle, Trash2, X } from 'lucide-react';
import { Step4Procedimento } from '../journey/Step4LGPD.jsx';
import { Step5Finalization } from '../journey/Step5Finalization.jsx';
import { statusTermoPorProcedimento } from '../../utils/termoResolucao.js';

/** Fluxo modular: registro do procedimento → orientações → encerramento. */
export function ConsultaProcedimentoFlow({
  // Step4
  pacienteIdForProcedures,
  nomeProcedimento,
  setNomeProcedimento,
  setNomeProcedimentoCatalogoId,
  setProcedimentoDoCatalogo,
  procedimentosLote = [],
  setProcedimentosLote = () => {},
  journeyPlanejamentoCtx = null,
  activeProcedimentoIndex = 0,
  setActiveProcedimentoIndex = () => {},
  observacoesExecucao,
  setObservacoesExecucao,
  procedureCapturedPhotos,
  setProcedureCapturedPhotos: _setProcedureCapturedPhotos,
  updateProcedureByIndex: _updateProcedureByIndex,
  procedurePhotoMax,
  onProcedureUploadFiles,
  onProcedureRemovePhoto,
  step4Errors = {},
  setStep4Errors = () => {},
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
  resolucao = null,
  onIrParaTermosGate,
  consentimentosAguardandoExecucao = [],
  onProcedureOpenCamera,
  onClearMapaCaptureIntent,
  /** F5: `(foto) => url` da reserva (/arquivo); repassada ao Step4Procedimento. */
  urlArquivoReserva = null,
  // Step5
  procedureDateIso,
  /** Orientações por item: `{ itemId, nome, orient: lista | null, legado }`, um por linha de procedimento. */
  itensOrientacoes = [],
  /** Grava a lista inteira do item `indice` (o núcleo manda o PATCH). */
  setOrientacoesDoItem = () => {},
  /** Índices dos itens sem orientação marcada (bloqueiam o encerrar). */
  itensSemOrientacaoMarcada = [],
  _proximoRetornoDisplay,
  _setProximoRetornoDisplay,
  step5Errors = {},
  setStep5Errors = () => {},
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
  toast,
}) {
  const [phase, setPhase] = useState('registro');
  const [confirmacaoLoteOpen, setConfirmacaoLoteOpen] = useState(false);

  const indicesSemMarcada = Array.isArray(itensSemOrientacaoMarcada) ? itensSemOrientacaoMarcada : [];
  const orientacoesOk = indicesSemMarcada.length === 0;
  const nomesSemMarcada = indicesSemMarcada
    .map((i) => String(itensOrientacoes?.[i]?.nome || '').trim() || `Procedimento ${i + 1}`)
    .join(', ');

  const handleContinuar = async () => {
    const nomeP = String(nomeProcedimento || '').trim();
    const catId =
      catalogoId != null && String(catalogoId).trim() !== ''
        ? String(catalogoId).trim()
        : null;
    const temProcedimento = Boolean(nomeP) || (Array.isArray(procedimentosLote) && procedimentosLote.length > 0);
    if (!temProcedimento) {
      setStep4Errors({
        nomeProcedimento: true,
        catalogoId: true,
      });
      toast.error('Selecione o procedimento no catálogo para continuar.');
      return;
    }

    if (typeof onValidarTermosCatalogo === 'function') {
      const todosCats = (procedimentosLote || [])
        .map((p) => p.nomeProcedimentoCatalogoId || p.catalogoProcedimentoSaudeId || p.catalogoId || p.id)
        .filter(Boolean);
      if (catId && !todosCats.includes(catId)) todosCats.push(catId);

      const ok = await onValidarTermosCatalogo(todosCats, nomeP);
      if (!ok) return;
    }
    setStep4Errors({});
    if (procedimentosLote && procedimentosLote.length > 1 && activeProcedimentoIndex < procedimentosLote.length - 1) {
      setActiveProcedimentoIndex(activeProcedimentoIndex + 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      setPhase('orientacoes');
    }
  };

  const handleRemoverDoLote = async (procId) => {
    const pid = String(procId);
    const novaLista = (procedimentosLote || []).filter(
      (p) => String(p.catalogoProcedimentoSaudeId || p.nomeProcedimentoCatalogoId || p.catalogoId || p.id) !== pid,
    );
    if (typeof setProcedimentosLote === 'function') {
      setProcedimentosLote(novaLista);
    }
    if (typeof onValidarTermosCatalogo === 'function') {
      const todosIds = novaLista
        .map((p) => p.catalogoProcedimentoSaudeId || p.nomeProcedimentoCatalogoId || p.catalogoId || p.id)
        .filter((id) => id && id !== 'undefined' && id !== 'null');
      await onValidarTermosCatalogo(todosIds, novaLista.map((p) => p.nomeProcedimento || p.procedimentoNome || p.nome).join(' + '), {
        abrirModal: false,
        procedimentosSessaoOverride: novaLista,
      });
    }
    if (novaLista.length === 0) {
      setConfirmacaoLoteOpen(false);
      setPhase('registro');
    }
  };

  const handleConfirmarEFinalizar = async () => {
    try {
      setConfirmacaoLoteOpen(false);
      if (typeof encerrarAtendimento === 'function') {
        await encerrarAtendimento();
      }
    } catch (e) {
      toast?.error?.('Erro ao finalizar atendimento. Verifique os dados.');
      console.error(e);
    }
  };

  const handleFinalizar = async () => {
    try {
      if (!orientacoesOk) {
        setStep5Errors({ orientacoes: true });
        toast.error(`Marque ao menos uma orientação em: ${nomesSemMarcada}`);
        return;
      }
      setStep5Errors({});
      
      if (execucaoBloqueadaPorTermos) {
        toast.error('Assine os termos obrigatórios antes de finalizar o procedimento.');
        return;
      }

      // Review Gate: se há múltiplos procedimentos OU qualquer procedimento vinculado a plano de tratamento
      const precisaConfirmacao = (procedimentosLote || []).length > 1 ||
        (procedimentosLote || []).some((p) => Boolean(p.planejamentoItemId));

      if (precisaConfirmacao) {
        setConfirmacaoLoteOpen(true);
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
          <div className="flex border-b border-[#e2e8f0] mb-6 overflow-x-auto">
            {procedimentosLote.map((proc, index) => (
              <button
                key={index}
                type="button"
                onClick={() => {
                  setActiveProcedimentoIndex(index);
                }}
                className={`px-5 py-3 font-semibold text-[13px] whitespace-nowrap border-b-2 transition-colors ${
                  activeProcedimentoIndex === index
                    ? 'border-[#00a88e] text-[#00a88e]'
                    : 'border-transparent text-[#64748b] hover:text-[#334155] hover:border-[#cbd5e1]'
                }`}
              >
                {index + 1}. {proc.procedimentoNome || proc.nomeProcedimento || proc.nome || 'Procedimento'}
              </button>
            ))}
          </div>
        )}
        <Step4Procedimento
          pacienteIdForProcedures={pacienteIdForProcedures}
          nomeProcedimento={procedimentosLote?.[activeProcedimentoIndex]?.procedimentoNome || nomeProcedimento}
          setNomeProcedimento={setNomeProcedimento}
          setNomeProcedimentoCatalogoId={setNomeProcedimentoCatalogoId}
          setProcedimentoDoCatalogo={setProcedimentoDoCatalogo}
          procedimentosSessao={procedimentosLote}
          setProcedimentosSessao={setProcedimentosLote}
          journeyPlanejamentoCtx={journeyPlanejamentoCtx}
          onValidarTermosCatalogo={onValidarTermosCatalogo}
          execucaoBloqueadaPorTermos={execucaoBloqueadaPorTermos}
          titulosTermosFaltantes={titulosTermosFaltantes}
          resolucao={resolucao}
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
          onProcedureOpenCamera={execucaoBloqueadaPorTermos ? undefined : onProcedureOpenCamera}
          onClearMapaCaptureIntent={onClearMapaCaptureIntent}
          urlArquivoReserva={urlArquivoReserva}
          itemId={procedimentosLote?.[activeProcedimentoIndex]?.itemId || null}
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
        itensOrientacoes={itensOrientacoes}
        setOrientacoesDoItem={setOrientacoesDoItem}
        itensSemOrientacaoMarcada={indicesSemMarcada}
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
      />
      <div className="mt-8 flex justify-end border-t border-app-border pt-8">
        <button
          type="button"
          onClick={handleFinalizar}
          disabled={isFinishing || !orientacoesOk}
          title={orientacoesOk ? undefined : `Marque ao menos uma orientação em: ${nomesSemMarcada}`}
          className={`flex h-11 items-center justify-center gap-2 rounded-xl border border-transparent px-6 text-[14px] font-semibold shadow-sm outline-none transition-all ${
            orientacoesOk && !isFinishing
              ? 'animate-pulse bg-[#22c55e] text-white hover:bg-[#16a34a]'
              : 'cursor-not-allowed bg-[#f1f5f9] text-[#64748b]'
          }`}
        >
          {isFinishing
            ? 'Salvando...'
            : !orientacoesOk
              ? 'Confirme as orientações para finalizar'
              : 'Finalizar Atendimento ✓'}
        </button>
      </div>

      {confirmacaoLoteOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="review-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-200"
        >
          <div className="relative w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl border border-slate-100 space-y-5">
            <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-teal-50 text-teal-600">
                  <ShieldCheck className="h-6 w-6 stroke-[2]" />
                </div>
                <div>
                  <h3 id="review-modal-title" className="text-base font-bold text-slate-900">
                    Conferência de Procedimentos do Atendimento
                  </h3>
                  <p className="text-xs font-medium text-slate-500">
                    Confira os atos clínicos que serão registrados no prontuário e baixados no plano de tratamento:
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setConfirmacaoLoteOpen(false)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
                aria-label="Fechar modal"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="max-h-[320px] overflow-y-auto space-y-2.5 pr-1 divide-y divide-slate-100">
              {(procedimentosLote || []).map((proc, idx) => {
                const catId = proc.catalogoProcedimentoSaudeId || proc.nomeProcedimentoCatalogoId || proc.catalogoId || proc.id;
                const nomeProc = proc.nomeProcedimento || proc.procedimentoNome || proc.nome || 'Procedimento';
                const isPlano = Boolean(proc.planejamentoItemId) || proc.isAvulso === false;
                const statusTermo = statusTermoPorProcedimento(catId, resolucao);

                return (
                  <div key={catId || idx} className="pt-2.5 first:pt-0 flex items-start justify-between gap-3">
                    <div className="space-y-1 min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-bold text-slate-900 truncate">
                          {nomeProc}
                        </span>
                        {isPlano ? (
                          <span className="inline-flex items-center rounded bg-teal-100 px-2 py-0.5 text-[10px] font-bold text-teal-800 border border-teal-200">
                            Plano de Tratamento
                          </span>
                        ) : (
                          <span className="inline-flex items-center rounded bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600 border border-slate-200">
                            Avulso
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-3 text-xs flex-wrap">
                        {isPlano && (
                          <span className="text-teal-700 font-medium text-[11px]">
                            • Dará baixa como Realizado no plano ativo
                          </span>
                        )}
                        <span className="inline-flex items-center gap-1 text-[11px]">
                          {statusTermo.status === 'assinado' ? (
                            <span className="text-emerald-700 font-semibold inline-flex items-center gap-1">
                              <CheckCircle2 className="h-3 w-3 text-emerald-600" /> {statusTermo.rotulo}
                            </span>
                          ) : statusTermo.status === 'pendente' ? (
                            <span className="text-rose-700 font-semibold inline-flex items-center gap-1">
                              <AlertCircle className="h-3 w-3 text-rose-600" /> {statusTermo.rotulo}
                            </span>
                          ) : (
                            <span className="text-blue-700 font-medium inline-flex items-center gap-1">
                              <Info className="h-3 w-3 text-blue-500" /> {statusTermo.rotulo}
                            </span>
                          )}
                        </span>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleRemoverDoLote(catId)}
                      className="inline-flex items-center gap-1 text-xs font-semibold text-rose-600 hover:text-rose-800 hover:bg-rose-50 px-2 py-1 rounded transition-colors shrink-0"
                      title="Remover deste atendimento (retorna para o plano de tratamento se for do plano)"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      <span>Remover</span>
                    </button>
                  </div>
                );
              })}
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setConfirmacaoLoteOpen(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-colors"
              >
                Voltar para Ajustar
              </button>
              <button
                type="button"
                onClick={handleConfirmarEFinalizar}
                disabled={isFinishing || (procedimentosLote || []).length === 0}
                className="flex items-center gap-2 px-5 py-2.5 text-xs font-bold text-white bg-[#00a88e] hover:bg-[#00967f] rounded-xl shadow-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isFinishing ? 'Salvando...' : 'Confirmar e Finalizar Atendimento ✓'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
