import React from 'react';
import { Loader2, X } from 'lucide-react';
import { ProfissionalPills } from './ProfissionalPills.jsx';
import { DuracaoPills } from './DuracaoPills.jsx';
import { addMinutesToTime } from '../../utils/agendaMapping.js';

function FieldWrap({ error, children }) {
  return (
    <div className="space-y-1">
      {children}
      {error ? <p className="text-xs font-medium text-red-600">{error}</p> : null}
    </div>
  );
}

function FieldLabel({ children, required }) {
  return (
    <label className="mb-1.5 block text-[12px] font-bold text-gray-700">
      {children}
      {required ? <span className="text-red-500"> *</span> : null}
    </label>
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

  const onDuracaoChange = (min) => {
    agenda.updateBloqueioForm('duracaoMin', min);
    const hi = String(form.horaInicio || '09:00').slice(0, 5);
    agenda.updateBloqueioForm('horaFim', addMinutesToTime(hi, min));
  };

  return (
    <div className="fixed inset-0 z-[220] flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-black/40"
        onClick={agenda.closeBloqueioModal}
        aria-label="Fechar modal"
      />
      <div
        role="dialog"
        aria-labelledby="bloqueio-modal-title"
        className="relative flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
      >
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-gray-200 p-5">
          <div className="min-w-0">
            <h3 id="bloqueio-modal-title" className="text-[18px] font-black text-gray-900">
              Bloquear horário
            </h3>
            <p className="mt-1 text-[12px] font-medium text-gray-500">
              O horário ficará indisponível para novos agendamentos.
            </p>
          </div>
          <button
            type="button"
            onClick={agenda.closeBloqueioModal}
            className="rounded-xl p-2 text-gray-500 hover:bg-gray-50"
            aria-label="Fechar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-5">
          <FieldWrap error={errors.profissional}>
            <FieldLabel required>Profissional</FieldLabel>
            <ProfissionalPills
              profissionais={agenda.equipeList}
              value={agenda.roleUserIdAgenda}
              onChange={agenda.setRoleUserIdAgenda}
              loading={agenda.equipeLoading}
              error={agenda.equipeError}
            />
          </FieldWrap>

          <FieldWrap error={errors.data}>
            <FieldLabel required>Data</FieldLabel>
            <input
              type="date"
              min={agenda.todayIso}
              value={form.data || ''}
              onChange={(e) => agenda.updateBloqueioForm('data', e.target.value)}
              className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-[13px] font-medium text-gray-900 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/30"
            />
          </FieldWrap>

          <FieldWrap error={errors.horaInicio}>
            <FieldLabel required>Início</FieldLabel>
            <input
              type="time"
              value={String(form.horaInicio || '').slice(0, 5)}
              onChange={(e) => {
                const hi = e.target.value;
                agenda.updateBloqueioForm('horaInicio', hi);
                if (!form.useCustomEnd) {
                  agenda.updateBloqueioForm(
                    'horaFim',
                    addMinutesToTime(hi, Number(form.duracaoMin) || 60)
                  );
                }
              }}
              className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-[13px] font-medium text-gray-900 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/30"
            />
          </FieldWrap>

          <div>
            <label className="mb-2 flex cursor-pointer items-center gap-2 text-[12px] font-semibold text-gray-700">
              <input
                type="checkbox"
                checked={Boolean(form.useCustomEnd)}
                onChange={(e) => agenda.updateBloqueioForm('useCustomEnd', e.target.checked)}
                className="rounded border-gray-300 text-teal-600 focus:ring-teal-500"
              />
              Horário personalizado (informar fim)
            </label>
            {form.useCustomEnd ? (
              <FieldWrap error={errors.horaFim}>
                <FieldLabel required>Fim</FieldLabel>
                <input
                  type="time"
                  value={String(form.horaFim || '').slice(0, 5)}
                  onChange={(e) => agenda.updateBloqueioForm('horaFim', e.target.value)}
                  className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-[13px] font-medium text-gray-900 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/30"
                />
              </FieldWrap>
            ) : (
              <FieldWrap error={errors.duracaoMin}>
                <FieldLabel required>Duração</FieldLabel>
                <DuracaoPills value={form.duracaoMin} onChange={onDuracaoChange} />
              </FieldWrap>
            )}
          </div>

          <FieldWrap error={errors.motivo}>
            <FieldLabel required>Motivo</FieldLabel>
            <textarea
              rows={3}
              value={form.motivo || ''}
              onChange={(e) => agenda.updateBloqueioForm('motivo', e.target.value)}
              placeholder="Ex.: almoço, consulta externa, férias"
              className="w-full resize-y rounded-xl border border-gray-200 px-3 py-2.5 text-[13px] text-gray-900 placeholder:text-gray-400 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/30"
            />
          </FieldWrap>
        </div>

        <div className="flex shrink-0 flex-wrap justify-end gap-2 border-t border-gray-200 p-5">
          <button
            type="button"
            onClick={agenda.closeBloqueioModal}
            disabled={saving}
            className="rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-[13px] font-bold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => void agenda.saveBloqueio()}
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-xl bg-slate-700 px-5 py-2.5 text-[13px] font-bold text-white hover:bg-slate-800 disabled:opacity-50"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Salvar
          </button>
        </div>
      </div>
    </div>
  );
}

