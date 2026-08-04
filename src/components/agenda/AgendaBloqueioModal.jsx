import React from 'react';
import { Loader2, X } from 'lucide-react';
import { ProfissionalSearchInput } from './ProfissionalSearchInput.jsx';
import { CalendarioMensal } from './CalendarioMensal.jsx';
import { DuracaoPills } from './DuracaoPills.jsx';

function FieldWrap({ error, children }) {
  return (
    <div className="space-y-1">
      {children}
      {error ? <p className="text-[11px] font-bold text-red-600">{error}</p> : null}
    </div>
  );
}

function FieldLabel({ children, required }) {
  return (
    <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-ink-500">
      {children}
      {required ? <span className="text-red-500"> *</span> : null}
    </p>
  );
}

export function AgendaBloqueioModal({ agenda }) {
  React.useEffect(() => {
    if (!agenda.bloqueioModalOpen) return undefined;
    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        agenda.closeBloqueioModal();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [agenda.bloqueioModalOpen, agenda.closeBloqueioModal]);

  if (!agenda.bloqueioModalOpen) return null;

  const form = agenda.bloqueioForm || {};
  const errors = agenda.bloqueioFormErrors || {};
  const saving = Boolean(agenda.submittingBloqueio);
  const verifying = Boolean(agenda.bloqueioSubmitVerifying);
  const conflictLoading = Boolean(agenda.bloqueioConflitosLoading);
  const conflictCount = agenda.bloqueioConflitosCount;
  const conflictFetchError = Boolean(agenda.bloqueioConflitosFetchError);
  const resyncMessage = String(agenda.bloqueioConflitosResyncMessage || '').trim();
  const roleId = String(agenda.roleUserIdAgenda || '').trim();
  const diaInteiro = Boolean(form.diaInteiro);

  const showConflictNotice = roleId && form.data;
  const conflictKnown = typeof conflictCount === 'number' && !conflictLoading && !conflictFetchError;
  const destructiveCount = conflictKnown && conflictCount > 0;
  const primaryLabel =
    destructiveCount && !saving && !verifying
      ? `Cancelar ${conflictCount} e bloquear`
      : 'Salvar';
  const primaryBusyLabel = verifying ? 'Verificando…' : 'Salvando…';

  return (
    <div
      className="fixed inset-0 z-[220] flex items-center justify-center p-3 sm:p-5"
      role="dialog"
      aria-modal="true"
      aria-labelledby="bloqueio-modal-title"
    >
      <button
        type="button"
        className="absolute inset-0 bg-black/50"
        onClick={agenda.closeBloqueioModal}
        aria-label="Fechar modal"
        tabIndex={-1}
      />
      <div className="relative flex max-h-[95vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-ink-100 px-6 py-4">
          <div className="min-w-0">
            <h2 id="bloqueio-modal-title" className="font-display text-lg font-black text-ink-900">
              Bloquear horário
            </h2>
            <p className="mt-1 text-sm text-ink-500">
              O horário ficará indisponível para novos agendamentos.
            </p>
          </div>
          <button
            type="button"
            onClick={agenda.closeBloqueioModal}
            className="rounded-xl p-2 text-ink-500 hover:bg-ink-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-vivid-teal-500"
            aria-label="Fechar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-6 py-5">
          <FieldWrap error={errors.profissional}>
            <FieldLabel required>Profissional</FieldLabel>
            <ProfissionalSearchInput
              roleUserIdAgenda={agenda.roleUserIdAgenda}
              equipeList={agenda.equipeList}
              equipeLoading={agenda.equipeLoading}
              equipeError={agenda.equipeError}
              onSelecionar={(id) => agenda.setRoleUserIdAgenda(id)}
              onClear={() => agenda.setRoleUserIdAgenda('')}
            />
          </FieldWrap>

          <label className="flex cursor-pointer items-center gap-2 text-sm font-semibold text-ink-700">
            <input
              type="checkbox"
              checked={diaInteiro}
              onChange={(e) => agenda.updateBloqueioForm('diaInteiro', e.target.checked)}
              className="rounded border-ink-300 text-vivid-teal-600 focus:ring-vivid-teal-500"
            />
            Bloquear o dia inteiro
          </label>

          <FieldWrap error={errors.data}>
            <FieldLabel required>Data</FieldLabel>
            {roleId ? (
              <div className="flex min-h-[280px] flex-col">
                <CalendarioMensal
                  heatmap={agenda.bloqueioCalendarioHeatmap}
                  loading={agenda.dispMonthLoading}
                  error={agenda.dispMonthError}
                  onPrevMonth={agenda.goDispPrevMonth}
                  onNextMonth={agenda.goDispNextMonth}
                  onRetry={agenda.retryBloqueioDispMonth}
                  diaSelecionado={form.data}
                  onSelecionarDia={agenda.selectBloqueioDia}
                  showDensityLegend
                />
              </div>
            ) : (
              <p className="rounded-xl border border-dashed border-ink-200 bg-ink-50 px-4 py-8 text-center text-sm text-ink-500">
                Selecione um profissional para ver o calendário.
              </p>
            )}
          </FieldWrap>

          {!diaInteiro ? (
            <>
              <FieldWrap error={errors.horaInicio}>
                <FieldLabel required>Início</FieldLabel>
                <input
                  type="time"
                  value={String(form.horaInicio || '').slice(0, 5)}
                  onChange={(e) => agenda.updateBloqueioForm('horaInicio', e.target.value)}
                  className="w-full rounded-xl border border-ink-200 px-3 py-2.5 text-sm font-medium text-ink-900 outline-none focus:border-vivid-teal-400 focus:ring-2 focus:ring-vivid-teal-100"
                />
              </FieldWrap>

              <FieldWrap error={errors.duracaoMin}>
                <FieldLabel required>Duração</FieldLabel>
                <DuracaoPills
                  value={form.duracaoMin}
                  onChange={(min) => agenda.updateBloqueioForm('duracaoMin', min)}
                />
              </FieldWrap>
            </>
          ) : null}

          <FieldWrap error={errors.motivo}>
            <FieldLabel required>Motivo</FieldLabel>
            <textarea
              rows={3}
              value={form.motivo || ''}
              onChange={(e) => agenda.updateBloqueioForm('motivo', e.target.value)}
              placeholder="Ex.: almoço, consulta externa, férias"
              maxLength={500}
              className="w-full resize-y rounded-xl border border-ink-200 px-3 py-2.5 text-sm text-ink-900 outline-none placeholder:text-ink-300 focus:border-vivid-teal-400 focus:ring-2 focus:ring-vivid-teal-100"
            />
          </FieldWrap>

          {showConflictNotice ? (
            <div className="space-y-2">
              {conflictLoading ? (
                <p className="text-sm text-ink-500">Calculando…</p>
              ) : resyncMessage ? (
                <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-900">
                  {resyncMessage}
                </p>
              ) : conflictFetchError || conflictCount == null ? (
                <p className="text-sm text-ink-500">
                  Não foi possível estimar quantos agendamentos serão cancelados. O bloqueio ainda
                  pode cancelar conflitos existentes.
                </p>
              ) : destructiveCount ? (
                <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-900">
                  Isto cancelará <strong>{conflictCount}</strong> agendamento
                  {conflictCount === 1 ? '' : 's'} neste horário. Os pacientes serão notificados
                  conforme o fluxo da clínica.
                </p>
              ) : (
                <p className="text-sm text-ink-500">
                  Nenhum agendamento será cancelado neste intervalo.
                </p>
              )}
            </div>
          ) : null}
        </div>

        <div className="flex shrink-0 flex-wrap justify-end gap-2 border-t border-ink-100 px-6 py-4">
          <button
            type="button"
            onClick={agenda.closeBloqueioModal}
            disabled={saving}
            className="rounded-xl border border-ink-200 px-4 py-2.5 text-sm font-bold text-ink-600 hover:bg-ink-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink-400 disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => void agenda.saveBloqueio()}
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-xl bg-vivid-teal-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-vivid-teal-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-vivid-teal-500 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {saving || verifying ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                {primaryBusyLabel}
              </>
            ) : (
              primaryLabel
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
