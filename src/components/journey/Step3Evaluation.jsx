import React, { useCallback, useMemo, useState } from 'react';
import { Eye } from 'lucide-react';
import { MapeamentoFacialPanel } from './mapeamento/MapeamentoFacialPanel.jsx';
import { PlanejamentoPacoteTabela } from './mapeamento/PlanejamentoPacoteTabela.jsx';
import {
  contaPontosProcedimento,
  somaQuantidadeProcedimento,
} from '../../utils/mapeamentoQuantidade.js';
import { planejamentosApi } from '../../services/api.js';
import { sessoesMapFromDetalhe } from '../../utils/planejamentoSessoes.js';

export function Step3Evaluation({
  observacoes = '',
  setObservacoes,
  pacienteId = null,
  roleUserId = null,
  sidebarInsetPx = 0,
  pendingCapture = null,
  onCaptureConsumed,
  onPrepareCapture,
  onGerarPlanoSuccess,
  onStepComplete,
  onAgendarPlanejamentoItem,
  profissionalLogadoNome = '',
}) {
  const [planoGeradoSnapshot, setPlanoGeradoSnapshot] = useState(null);
  const [sessoesPorItemId, setSessoesPorItemId] = useState({});

  const syncSessoesFromDetalhe = useCallback((planejamentoId) => {
    const pid = String(planejamentoId ?? '').trim();
    if (!pid) return Promise.resolve();
    return planejamentosApi
      .detalhe(pid)
      .then((det) => setSessoesPorItemId(sessoesMapFromDetalhe(det)))
      .catch((err) => console.warn('Falha ao sincronizar planejamento:', err));
  }, []);

  const handleGerarPlanoSuccess = useCallback(
    (result) => {
      onGerarPlanoSuccess?.(result);

      if (result?.planejamentoId) {
        setPlanoGeradoSnapshot({
          planejamentoId: result.planejamentoId,
          itemIdByCatalogo: result.itemIdByCatalogo ?? {},
          procedimentosComPontos: Array.isArray(result.procedimentosComPontos)
            ? result.procedimentosComPontos
            : [],
          partial: !!result.partial,
        });
        syncSessoesFromDetalhe(result.planejamentoId);
      }
    },
    [onGerarPlanoSuccess, syncSessoesFromDetalhe],
  );

  const linhasTabela = useMemo(() => {
    if (!planoGeradoSnapshot) return [];
    const procs = planoGeradoSnapshot.procedimentosComPontos ?? [];
    const itemIdByCatalogo = planoGeradoSnapshot.itemIdByCatalogo ?? {};
    return procs.map((proc) => {
      const planejamentoItemId =
        itemIdByCatalogo[proc.catalogoProcedimentoSaudeId] ?? null;
      return {
        catalogoProcedimentoSaudeId: proc.catalogoProcedimentoSaudeId,
        nomeProcedimento: proc.nomeProcedimento,
        pontosMapeados: contaPontosProcedimento(proc.pontosPorVista),
        quantidadeTotal: somaQuantidadeProcedimento(proc.pontosPorVista),
        planejamentoItemId,
        sessao: planejamentoItemId
          ? sessoesPorItemId[String(planejamentoItemId)] ?? null
          : null,
      };
    });
  }, [planoGeradoSnapshot, sessoesPorItemId]);

  const handleAgendarLinha = useCallback(
    (row) => {
      if (!row?.planejamentoItemId) return;
      const planejamentoId = planoGeradoSnapshot?.planejamentoId;
      onAgendarPlanejamentoItem?.(row, (payload) => {
        setSessoesPorItemId((prev) => ({
          ...prev,
          [String(row.planejamentoItemId)]: {
            agendaId: payload.agendaId,
            dataAgendamento: payload.dataAgendamento,
            horaInicio: payload.horaInicio,
            horaFim: payload.horaFim,
            statusCodigo: payload.statusCodigo ?? 'AGENDADO',
            profissionalRoleUserId: payload.profissionalRoleUserId,
          },
        }));
        if (planejamentoId) syncSessoesFromDetalhe(planejamentoId);
      });
    },
    [onAgendarPlanejamentoItem, planoGeradoSnapshot?.planejamentoId, syncSessoesFromDetalhe],
  );

  const handleAvancarTermos = useCallback(() => {
    if (typeof onStepComplete === 'function') {
      onStepComplete(planoGeradoSnapshot);
    }
  }, [onStepComplete, planoGeradoSnapshot]);

  const mostrarTabela = planoGeradoSnapshot != null;

  return (
    <div className="relative flex min-h-0 flex-col">
      <div className="mb-6 flex shrink-0 items-center gap-4 px-0.5">
        <div className="rounded-xl border border-app-border bg-app-nav-active p-2.5 text-app-accent shadow-sm">
          <Eye className="h-6 w-6" strokeWidth={2.5} />
        </div>
        <div>
          <h3 className="text-[18px] font-bold text-app-ink">Avaliação e Mapeamento</h3>
          <p className="text-[13px] font-medium text-[#64748b]">
            {mostrarTabela
              ? 'Revise o plano do pacote e agende os procedimentos'
              : 'Mapeie procedimentos por vista e gere o plano de tratamento'}
          </p>
        </div>
      </div>

      <MapeamentoFacialPanel
        pacienteId={pacienteId}
        roleUserId={roleUserId}
        observacao={observacoes}
        onObservacaoChange={setObservacoes}
        sidebarInsetPx={sidebarInsetPx}
        pendingCapture={pendingCapture}
        onCaptureConsumed={onCaptureConsumed}
        onPrepareCapture={onPrepareCapture}
        onGerarPlanoSuccess={handleGerarPlanoSuccess}
      />

      {mostrarTabela ? (
        <div className="mt-8 space-y-6 border-t border-app-border pt-8">
          {planoGeradoSnapshot.partial ? (
            <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-[13px] font-medium text-amber-900">
              Plano salvo, mas não foi ativado — este paciente já possui um plano ativo.
            </p>
          ) : null}

          <PlanejamentoPacoteTabela
            linhas={linhasTabela}
            onAgendarLinha={handleAgendarLinha}
            profissionalLogadoNome={profissionalLogadoNome}
            roleUserIdLogado={roleUserId}
          />

          <div className="flex justify-end pt-2">
            <button
              type="button"
              onClick={handleAvancarTermos}
              className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-app-accent px-6 py-3 text-[14px] font-semibold text-white shadow-sm hover:bg-[#00967f]"
            >
              Avançar para Termos
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
