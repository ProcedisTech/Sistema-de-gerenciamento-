import React from 'react';
import { Trash2, X } from 'lucide-react';
import { AGENDA_DURACAO_MINUTOS_OPCOES } from './useAgendaPage';
import { ProcedimentoAutocomplete } from '../shared/ProcedimentoAutocomplete.jsx';

const BTN_ACTION =
  'inline-flex max-w-[min(100%,14rem)] shrink-0 justify-center whitespace-normal text-center leading-tight';

function FieldError({ error, children }) {
  return (
    <div>
      {children}
      {error ? <div className="mt-1 text-[11px] font-bold text-red-600">{error}</div> : null}
    </div>
  );
}

/**
 * Modal "Novo Agendamento" / edição — mesmo UI usado na agenda.
 * `agenda.patientSelectLocked`: quando true (abrir do perfil), paciente somente leitura e sem bloqueio.
 */
export function AgendaFormModal({ agenda, onExcluirClick }) {
  const horaInicioInputRef = React.useRef(null);
  if (!agenda.modalMode) return null;
  const isEdit = agenda.modalMode === 'edit';
  const lockPatient = Boolean(agenda.patientSelectLocked) && !isEdit;

  const openHoraInicioPicker = () => {
    const el = horaInicioInputRef.current;
    if (!el) return;
    if (typeof el.showPicker === 'function') {
      try {
        el.showPicker();
        return;
      } catch {
        // Safari / contexto sem gesto
      }
    }
    el.focus();
  };
  const modalTitle = isEdit ? 'Editar Agendamento' : 'Novo Agendamento';
  const modalSubtitle = 'Preencha os dados obrigatorios para atualizar a agenda.';
  const horarioConflita = Boolean(agenda.horarioConflita);
  const horarioInputClass = `mt-1 w-full rounded-lg border px-3 py-2.5 text-[13px] font-semibold outline-none focus:border-[#0FA37F] ${
    horarioConflita ? 'border-amber-500 bg-amber-50/40 ring-1 ring-amber-300' : 'border-[#E8E8E8]'
  }`;

  const selectedProcedimentos = Array.isArray(agenda.form.catalogoProcedimentoSaudeIds)
    ? agenda.form.catalogoProcedimentoSaudeIds
    : [];

  const addProcedimentoChip = (catalogoId, nome) => {
    const id = String(catalogoId || '').trim();
    if (!id && nome) {
      const newId = `new:${nome}`;
      const merged = isEdit
        ? [newId]
        : [...selectedProcedimentos, newId].filter((v, i, arr) => arr.indexOf(v) === i);
      agenda.updateForm('catalogoProcedimentoSaudeIds', merged);
      return;
    }
    if (!id) return;
    const merged = isEdit
      ? [id]
      : [...selectedProcedimentos, id].filter((v, i, arr) => arr.indexOf(v) === i);
    agenda.updateForm('catalogoProcedimentoSaudeIds', merged);
    if (nome) agenda.updateForm('procedimentoNome', nome);
  };

  const removeProcedimentoChip = (catalogoId) => {
    const id = String(catalogoId || '').trim();
    agenda.updateForm(
      'catalogoProcedimentoSaudeIds',
      selectedProcedimentos.filter((v) => v !== id)
    );
  };

  const procedimentoChipLabel = (id) =>
    id.startsWith('new:')
      ? id.substring(4) + ' (Novo)'
      : agenda.procedimentoOptions.find((o) => String(o.id) === String(id))?.nome || id;

  return (
    <div className="fixed inset-0 z-[220] flex items-center justify-center p-4">
      <button type="button" className="absolute inset-0 bg-black/40" onClick={agenda.closeModal} aria-label="Fechar modal" />
      <div className="relative max-h-[92vh] w-full max-w-[720px] overflow-y-auto rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-[#E8E8E8] p-5">
          <div>
            <h3 className="text-[18px] font-black text-[#1A1A2E]">{modalTitle}</h3>
            <p className="text-[12px] font-medium text-[#888888]">{modalSubtitle}</p>
          </div>
          <button type="button" onClick={agenda.closeModal} className="rounded-xl p-2 text-[#64748b] hover:bg-[#F5F6FA]">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="grid gap-4 p-5 md:grid-cols-2">
          {agenda.formErrors._global ? (
            <div className="md:col-span-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-[13px] font-bold text-amber-900">
              {agenda.formErrors._global}
            </div>
          ) : null}

          {agenda.slotsOcupadosLoading ? (
            <div className="md:col-span-2 text-[11px] font-semibold text-[#888888]">Carregando ocupação do dia…</div>
          ) : null}

          <FieldError error={agenda.formErrors.pacienteId}>
            <label className="text-[12px] font-bold text-[#1A1A2E]">Paciente*</label>
            {lockPatient ? (
              <div className="mt-1 rounded-lg border border-[#E8E8E8] bg-[#F5F6FA] px-3 py-2.5 text-[13px] font-semibold text-[#1A1A2E]">
                <span className="block">{agenda.form.pacienteNome || '—'}</span>
                {agenda.form.telefone ? (
                  <span className="mt-1 block text-[12px] font-medium text-[#64748b]">{agenda.form.telefone}</span>
                ) : null}
              </div>
            ) : (
              <>
                <select
                  value={agenda.form.pacienteId}
                  onChange={(event) => agenda.updateForm('pacienteId', event.target.value)}
                  className="mt-1 w-full rounded-lg border border-[#E8E8E8] bg-white px-3 py-2.5 text-[13px] font-semibold text-[#1A1A2E] outline-none focus:border-[#0FA37F]"
                >
                  <option value="">Selecione</option>
                  {agenda.patientOptions.map((patient) => (
                    <option key={patient.id} value={patient.id}>
                      {patient.nome}
                    </option>
                  ))}
                </select>
                {agenda.patientOptions.length === 0 ? (
                  <p className="mt-1 text-[11px] font-medium text-[#888888]">
                    Cadastre pacientes na aba Pacientes para agendar.
                  </p>
                ) : null}
              </>
            )}
          </FieldError>

          <FieldError error={agenda.formErrors.catalogoProcedimentoSaudeIds}>
            <label className="text-[12px] font-bold text-[#1A1A2E]">{isEdit ? 'Procedimento*' : 'Procedimentos*'}</label>
            <div className="mt-1">
              <ProcedimentoAutocomplete
                value={agenda.form.procedimentoNome || ''}
                onChange={(nome, catalogoId) => {
                  agenda.updateForm('procedimentoNome', nome);
                  addProcedimentoChip(catalogoId, nome);
                }}
                placeholder="Ex: Botox, Preenchimento..."
                catalogoOptions={agenda.procedimentoOptions.map((o) => ({
                  id: o.id,
                  nomeProcedimento: o.nome,
                }))}
                error={Boolean(agenda.formErrors.catalogoProcedimentoSaudeIds)}
              />
              {selectedProcedimentos.length > 0 ? (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {selectedProcedimentos.map((id) => (
                    <span
                      key={id}
                      className="inline-flex items-center gap-1 rounded-full bg-[#e6f7f3] px-2.5 py-1 text-[11px] font-semibold text-[#0f766e]"
                    >
                      {procedimentoChipLabel(id)}
                      <button
                        type="button"
                        onClick={() => removeProcedimentoChip(id)}
                        className="rounded-full p-0.5 hover:bg-[#ccf0e6]"
                        aria-label="Remover procedimento"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                </div>
              ) : null}
            </div>
          </FieldError>

          <div>
            <label className="text-[12px] font-bold text-[#1A1A2E]">Data*</label>
            <input
              type="date"
              min={agenda.todayIso}
              value={agenda.form.data}
              onChange={(event) => agenda.updateForm('data', event.target.value)}
              className="mt-1 w-full rounded-lg border border-[#E8E8E8] px-3 py-2.5 text-[13px] font-semibold outline-none focus:border-[#0FA37F]"
            />
            {(() => {
              const past = Boolean(agenda.form.data) && agenda.form.data < agenda.todayIso;
              const msg =
                agenda.formErrors.data ||
                (past ? 'Data inválida — não é possível agendar para o passado.' : '');
              return msg ? <p className="mt-1 text-sm text-red-500">{msg}</p> : null;
            })()}
          </div>

          <FieldError error={agenda.formErrors.horaInicio}>
            <label className="text-[12px] font-bold text-[#1A1A2E]" htmlFor="agenda-hora-inicio">
              Horário*
            </label>
            <input
              id="agenda-hora-inicio"
              ref={horaInicioInputRef}
              type="time"
              value={agenda.form.horaInicio}
              title={horarioConflita ? 'Horário ocupado' : undefined}
              onChange={(event) => agenda.updateForm('horaInicio', event.target.value)}
              onClick={openHoraInicioPicker}
              className={horarioInputClass}
            />
            {horarioConflita ? (
              <p className="mt-1 text-[11px] font-bold text-amber-700">Horário ocupado</p>
            ) : null}
            {horarioConflita && agenda.proximoHorarioLivre ? (
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <p className="text-[11px] font-semibold text-[#64748b]">
                  Próximo horário livre sugerido:{' '}
                  <span className="font-bold text-[#1A1A2E]">{agenda.proximoHorarioLivre}</span>
                </p>
                <button
                  type="button"
                  onClick={() => agenda.updateForm('horaInicio', agenda.proximoHorarioLivre)}
                  className="rounded-md border border-amber-300 bg-white px-2 py-1 text-[10px] font-bold text-amber-900 hover:bg-amber-50"
                >
                  Aplicar sugestão
                </button>
              </div>
            ) : null}
          </FieldError>

          <FieldError error={agenda.formErrors.duracaoMin}>
            <label className="text-[12px] font-bold text-[#1A1A2E]" htmlFor="agenda-duracao-min">
              Duração (min)*
            </label>
            <select
              id="agenda-duracao-min"
              value={String(agenda.form.duracaoMin ?? '')}
              onChange={(event) => agenda.updateForm('duracaoMin', event.target.value)}
              className="mt-1 w-full cursor-pointer rounded-lg border border-[#E8E8E8] bg-white px-3 py-2.5 text-[13px] font-semibold outline-none focus:border-[#0FA37F]"
            >
              {AGENDA_DURACAO_MINUTOS_OPCOES.map((m) => (
                <option key={m} value={m}>
                  {m} min
                </option>
              ))}
            </select>
          </FieldError>

          <div>
            <label className="text-[12px] font-bold text-[#1A1A2E]">Telefone</label>
            <input
              value={agenda.form.telefone}
              onChange={(event) => agenda.updateForm('telefone', event.target.value)}
              disabled={lockPatient}
              className="mt-1 w-full rounded-lg border border-[#E8E8E8] px-3 py-2.5 text-[13px] font-semibold outline-none focus:border-[#0FA37F] disabled:cursor-not-allowed disabled:bg-[#f1f5f9]"
            />
          </div>

          <div className="md:col-span-2">
            <label className="text-[12px] font-bold text-[#1A1A2E]">Observações</label>
            <textarea
              value={agenda.form.observacao}
              onChange={(event) => agenda.updateForm('observacao', event.target.value)}
              rows={3}
              className="mt-1 w-full resize-none rounded-lg border border-[#E8E8E8] px-3 py-2.5 text-[13px] font-semibold outline-none focus:border-[#0FA37F]"
            />
          </div>
        </div>

        <div className="flex flex-col-reverse flex-wrap gap-2 border-t border-[#E8E8E8] p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 flex-1 flex-wrap gap-2 sm:flex-none">
            {isEdit ? (
              <button
                type="button"
                onClick={() => {
                  if (typeof onExcluirClick === 'function') onExcluirClick();
                }}
                className={`${BTN_ACTION} items-center gap-2 rounded-lg border border-red-200 px-4 py-2.5 text-[13px] font-bold text-red-600 hover:bg-red-50`}
              >
                <Trash2 className="h-4 w-4 shrink-0" /> Excluir agendamento
              </button>
            ) : null}
          </div>
          <div className="flex w-full min-w-0 flex-wrap justify-end gap-2 sm:w-auto sm:max-w-full">
            <button
              type="button"
              onClick={agenda.closeModal}
              className={`${BTN_ACTION} rounded-lg border border-[#E8E8E8] px-4 py-2.5 text-[13px] font-bold text-[#64748b] hover:bg-[#F5F6FA]`}
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={agenda.saveAppointment}
              className={`${BTN_ACTION} rounded-lg bg-[#0FA37F] px-4 py-2.5 text-[13px] font-bold text-white hover:bg-[#0d8f6f]`}
            >
              {isEdit ? 'Salvar alterações' : 'Salvar'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
