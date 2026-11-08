import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, ArrowLeftRight, Check, UserCheck, X } from 'lucide-react';
import { AgendaAvatarInitials } from './AgendaAvatarInitials.jsx';
import { isAgendaForaDisponibilidadeError } from '../../utils/agendaErrors.js';

const MOTIVO_CHIPS = [
  { id: 'imprevisto', label: 'Imprevisto do profissional' },
  { id: 'solicitacao', label: 'Solicitação do paciente' },
  { id: 'redistribuicao', label: 'Redistribuição de fila' },
  { id: 'outro', label: 'Outro motivo' },
];

function formatHm(hm) {
  return String(hm || '').slice(0, 5);
}

/**
 * Modal de Substituição de Profissional na Agenda (padrão aprovado no protótipo).
 */
export function TrocarProfissionalAgendaModal({
  open,
  appointment,
  equipeList = [],
  canEncaixarForaDisp = false,
  isSubmitting = false,
  onClose,
  onConfirm,
}) {
  const [selectedRoleUserId, setSelectedRoleUserId] = useState('');
  const [selectedChipId, setSelectedChipId] = useState('imprevisto');
  const [outroTexto, setOutroTexto] = useState('');
  const [foraDispWarning, setForaDispWarning] = useState(null);
  const [confirmarEncaixe, setConfirmarEncaixe] = useState(false);
  const [localError, setLocalError] = useState('');

  const currentRoleUserId = String(appointment?.profissionalRoleUserId || appointment?.roleUserId || '').trim();
  const currentProfNome = appointment?.profissionalNome || 'Profissional atual';

  const elegiveis = useMemo(() => {
    const list = Array.isArray(equipeList) ? equipeList : [];
    return list.filter(
      (p) =>
        p &&
        p.apareceNaAgenda !== false &&
        String(p.roleUserId || '').trim() !== '' &&
        String(p.roleUserId || '').trim() !== currentRoleUserId,
    );
  }, [equipeList, currentRoleUserId]);

  const titularInfo = useMemo(() => {
    const list = Array.isArray(equipeList) ? equipeList : [];
    return list.find((p) => String(p?.roleUserId || '').trim() === currentRoleUserId) || null;
  }, [equipeList, currentRoleUserId]);

  useEffect(() => {
    if (!open || !appointment) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSelectedRoleUserId(elegiveis[0]?.roleUserId ? String(elegiveis[0].roleUserId) : '');
    setSelectedChipId('imprevisto');
    setOutroTexto('');
    setForaDispWarning(null);
    setConfirmarEncaixe(false);
    setLocalError('');
  }, [open, appointment?.agendaId, appointment?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!open || !appointment) return null;

  const isOutro = selectedChipId === 'outro';
  const motivoFinal = isOutro
    ? String(outroTexto || '').trim()
    : MOTIVO_CHIPS.find((c) => c.id === selectedChipId)?.label || '';

  const motivoValido = motivoFinal.length >= 3;
  const encaixePendente = Boolean(foraDispWarning && (!canEncaixarForaDisp || !confirmarEncaixe));
  const canSubmit =
    Boolean(selectedRoleUserId) &&
    motivoValido &&
    !encaixePendente &&
    !isSubmitting;

  const horaLabel = formatHm(appointment.horaInicio);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!canSubmit) return;
    setLocalError('');

    try {
      const res = await onConfirm?.({
        agendaId: appointment.agendaId || appointment.id,
        novoProfissionalRoleUserId: selectedRoleUserId,
        motivo: motivoFinal,
        forcar: Boolean(foraDispWarning && confirmarEncaixe),
      });
      if (res?.ok) {
        onClose?.();
      } else if (res?.foraDaDisponibilidade) {
        setForaDispWarning(
          res.message ||
            `O profissional selecionado já possui compromisso às ${horaLabel} ou está fora da grade regular.`,
        );
      } else if (res?.error) {
        setLocalError(res.error);
      }
    } catch (err) {
      if (isAgendaForaDisponibilidadeError(err)) {
        setForaDispWarning(
          `O profissional selecionado já possui compromisso às ${horaLabel} ou está fora da grade regular.`,
        );
        return;
      }
      setLocalError(err?.body?.detail || err?.body?.message || err?.message || 'Não foi possível transferir o profissional.');
    }
  }

  return (
    <div className="fixed inset-0 z-[260] flex items-center justify-center bg-slate-900/45 p-4 backdrop-blur-[2px]">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="trocar-profissional-modal-title"
        className="flex max-h-[92dvh] w-full max-w-[540px] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
      >
        <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-teal-50 text-teal-700">
                <ArrowLeftRight className="h-4 w-4" aria-hidden />
              </span>
              <h3 id="trocar-profissional-modal-title" className="text-[16px] font-bold text-slate-900">
                Substituir Profissional do Atendimento
              </h3>
            </div>
            <p className="mt-1 truncate text-[12.5px] text-slate-500">
              {appointment.pacienteNome || 'Paciente'} · {horaLabel} ({appointment.procedimentoNome || 'Consulta'})
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="shrink-0 rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            aria-label="Fechar modal"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="custom-scrollbar flex-1 space-y-4 overflow-y-auto px-5 py-4">
          <div>
            <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-slate-500">
              1. Selecione quem assumirá o atendimento
            </p>

            <div className="mb-2 flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50/70 px-3.5 py-2.5">
              <div className="flex min-w-0 items-center gap-2.5">
                <AgendaAvatarInitials name={currentProfNome} size={34} />
                <div className="min-w-0">
                  <p className="truncate text-[13px] font-bold text-slate-800">
                    {currentProfNome} (Atual)
                  </p>
                  <p className="truncate text-[11.5px] text-slate-500">
                    {titularInfo?.especialidade || titularInfo?.roleNome || 'Profissional agendado'}
                  </p>
                </div>
              </div>
              <span className="shrink-0 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-700">
                Titular atual do agendamento
              </span>
            </div>

            {elegiveis.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-4 text-center text-[12.5px] text-slate-500">
                Nenhum outro profissional elegível na agenda desta clínica.
              </div>
            ) : (
              <div className="space-y-2">
                {elegiveis.map((prof) => {
                  const rid = String(prof.roleUserId);
                  const isSelected = rid === selectedRoleUserId;
                  return (
                    <button
                      key={rid}
                      type="button"
                      onClick={() => {
                        setSelectedRoleUserId(rid);
                        setForaDispWarning(null);
                        setConfirmarEncaixe(false);
                        setLocalError('');
                      }}
                      className={`flex w-full items-center justify-between gap-3 rounded-xl border px-3.5 py-2.5 text-left transition-all ${
                        isSelected
                          ? 'border-teal-600 bg-teal-50/50 ring-2 ring-teal-500/20'
                          : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/60'
                      }`}
                    >
                      <div className="flex min-w-0 items-center gap-2.5">
                        <AgendaAvatarInitials name={prof.nome} size={34} />
                        <div className="min-w-0">
                          <p className="truncate text-[13px] font-bold text-slate-900">{prof.nome}</p>
                          <p className="truncate text-[11.5px] text-slate-500">
                            {prof.especialidade || prof.roleNome || 'Profissional clínico'}
                          </p>
                        </div>
                      </div>
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                          isSelected
                            ? 'bg-teal-600 text-white'
                            : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {isSelected ? <Check className="h-3 w-3" aria-hidden /> : null}
                        {isSelected ? 'Selecionado' : 'Selecionar'}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {foraDispWarning ? (
            <div className="rounded-xl border border-amber-300 bg-amber-50/90 p-3.5 text-amber-900">
              <div className="flex items-start gap-2">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" aria-hidden />
                <div className="min-w-0 flex-1">
                  <p className="text-[12.5px] font-bold text-amber-900">
                    Alerta de Disponibilidade / Choque de Grade
                  </p>
                  <p className="mt-0.5 text-[12px] leading-relaxed text-amber-800">
                    {foraDispWarning}
                  </p>
                  {canEncaixarForaDisp ? (
                    <label className="mt-2.5 flex cursor-pointer items-center gap-2 text-[12px] font-bold text-amber-900">
                      <input
                        type="checkbox"
                        checked={confirmarEncaixe}
                        onChange={(e) => setConfirmarEncaixe(e.target.checked)}
                        className="h-4 w-4 rounded border-amber-400 text-amber-600 focus:ring-amber-500"
                      />
                      <span>Confirmar transferência como Encaixe autorizado na agenda</span>
                    </label>
                  ) : (
                    <p className="mt-2 text-[11.5px] font-semibold text-rose-700">
                      Seu perfil não possui permissão para forçar encaixe fora da disponibilidade deste profissional.
                    </p>
                  )}
                </div>
              </div>
            </div>
          ) : null}

          <div>
            <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-slate-500">
              2. Motivo da substituição (registrado na auditoria) *
            </p>
            <div className="flex flex-wrap gap-2">
              {MOTIVO_CHIPS.map((chip) => {
                const active = selectedChipId === chip.id;
                return (
                  <button
                    key={chip.id}
                    type="button"
                    onClick={() => {
                      setSelectedChipId(chip.id);
                      setLocalError('');
                    }}
                    className={`rounded-full border px-3 py-1.5 text-[12px] font-semibold transition-all ${
                      active
                        ? 'border-teal-600 bg-teal-600 text-white shadow-xs'
                        : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    {chip.label}
                  </button>
                );
              })}
            </div>

            {isOutro ? (
              <div className="mt-3">
                <label
                  htmlFor="trocar-prof-outro-motivo"
                  className="mb-1 block text-[11.5px] font-bold text-slate-700"
                >
                  Descreva o motivo da substituição *
                </label>
                <textarea
                  id="trocar-prof-outro-motivo"
                  rows={2}
                  maxLength={500}
                  value={outroTexto}
                  onChange={(e) => setOutroTexto(e.target.value)}
                  placeholder="Ex.: Dra. precisou ausentar-se para emergência odontológica e solicitou cobertura..."
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-[12.5px] text-slate-900 placeholder:text-slate-400 focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
                />
                <div className="mt-1 flex items-center justify-between text-[11px] text-slate-500">
                  <span>
                    {outroTexto.trim().length < 3
                      ? 'Informe ao menos 3 caracteres para registrar na auditoria.'
                      : 'Justificativa pronta para auditoria.'}
                  </span>
                  <span>{outroTexto.length}/500</span>
                </div>
              </div>
            ) : null}
          </div>

          {localError ? (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-[12px] font-semibold text-rose-700">
              {localError}
            </div>
          ) : null}

          <div className="flex items-center justify-end gap-2 border-t border-slate-100 pt-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="h-10 rounded-xl border border-slate-200 bg-white px-4 text-[13px] font-semibold text-slate-600 hover:bg-slate-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={!canSubmit}
              className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-teal-600 px-4 text-[13px] font-semibold text-white shadow-sm transition-all hover:bg-teal-700 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400"
            >
              <UserCheck className="h-4 w-4" aria-hidden />
              {isSubmitting ? 'Transferindo...' : 'Confirmar Substituição'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

