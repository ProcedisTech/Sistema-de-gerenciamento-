import { useCallback, useEffect, useMemo, useState } from 'react';
import { agendasApi } from '../../../services/api.js';
import { executarComBypassDisp } from '../../../services/agendasHelpers.js';
import { buildAgendaCreateBody } from '../../../utils/agendaDashboardMapping.js';
import { formatHoraSlotLabel } from '../../../utils/agendaNovoV2Helpers.js';
import { addMinutesToTime } from '../../../utils/agendaMapping.js';
import { useToast } from '../../../contexts/useToast.js';

export default function ConfirmarAgendamentoBar({
  modo,
  data,
  abrirConfirmacaoForaDisp,
  onCancel,
  onSuccess,
  compact = false,
}) {
  const toast = useToast();
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  const hi = formatHoraSlotLabel(modo?.horaSelecionada);
  const procs = useMemo(() => modo?.procedimentosSelecionados || [], [modo?.procedimentosSelecionados]);

  useEffect(() => {
    setFormError('');
  }, [
    modo?.horaSelecionada,
    modo?.slotProfissional?.roleUserId,
    modo?.pacienteSelecionado?.id,
    procs.length,
  ]);

  const canConfirm = Boolean(
    modo?.pacienteSelecionado?.id &&
      procs.length >= 1 &&
      modo?.horaSelecionada &&
      modo?.slotProfissional?.roleUserId,
  );

  const handleSubmit = useCallback(async () => {
    if (!canConfirm) return;
    if (!data || !hi || !modo.slotProfissional?.roleUserId || procs.length === 0) {
      setFormError('Dados do horário incompletos.');
      return;
    }
    if (!modo.pacienteSelecionado?.id) {
      setFormError('Selecione o paciente.');
      return;
    }

    setSubmitting(true);
    setFormError('');
    try {
      let startHh = String(hi).slice(0, 5);
      const confirmFn = abrirConfirmacaoForaDisp || (async () => true);

      for (let i = 0; i < procs.length; i += 1) {
        const proc = procs[i];
        const dMin = Math.max(5, Number(proc.duracaoMin) || 60);

        const body = buildAgendaCreateBody({
          dataAgendamento: data,
          horaInicio: startHh,
          duracaoMin: dMin,
          profissionalRoleUserId: modo.slotProfissional.roleUserId,
          observacao: modo.observacao || '',
          pacienteId: modo.pacienteSelecionado.id,
          catalogoProcedimentoSaudeId: proc.catalogoId || undefined,
          agendaIdOrigem: i === 0 ? (modo.reagendamentoOrigem?.agendaId ?? undefined) : undefined,
        });

        const created = await executarComBypassDisp(
          () => agendasApi.create(body),
          () => agendasApi.create(body, { forcar: true }),
          confirmFn,
        );
        if (created === null) return;

        startHh = addMinutesToTime(startHh, dMin);
      }

      toast.success(
        modo.reagendamentoOrigem ? 'Agendamento(s) reagendado(s).' : 'Agendamento(s) criado(s).',
      );
      onSuccess?.();
    } catch (err) {
      setFormError(err?.message || 'Não foi possível salvar o agendamento.');
    } finally {
      setSubmitting(false);
    }
  }, [abrirConfirmacaoForaDisp, canConfirm, data, hi, modo, onSuccess, procs, toast]);

  const procSummary = procs.map((p) => p.nomeProcedimento).join(', ');
  const summaryParts = [
    modo?.pacienteSelecionado?.nome,
    procSummary || null,
    hi || null,
    modo?.slotProfissional?.nomeProfissional,
  ].filter(Boolean);

  return (
    <div
      className={`shrink-0 border-t border-ink-200 bg-white ${
        compact ? 'p-3' : 'p-4'
      }`}
    >
      {summaryParts.length > 0 ? (
        <p className="mb-2 truncate text-xs font-medium text-ink-600">{summaryParts.join(' · ')}</p>
      ) : null}
      {formError ? <p className="mb-2 text-xs text-red-600">{formError}</p> : null}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={onCancel}
          disabled={submitting}
          className="flex-1 rounded-lg border border-ink-200 px-4 py-2.5 text-sm font-medium text-ink-700 hover:bg-ink-50 disabled:opacity-50"
        >
          Cancelar modo
        </button>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={submitting || !canConfirm}
          className="flex-1 rounded-lg bg-vivid-teal-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-vivid-teal-700 disabled:opacity-50"
        >
          {submitting ? 'Salvando…' : 'Confirmar agendamento'}
        </button>
      </div>
    </div>
  );
}
