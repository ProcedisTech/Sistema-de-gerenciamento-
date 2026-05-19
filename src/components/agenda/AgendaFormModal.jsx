import React from 'react';
import { CalendarDays, CornerDownLeft, Trash2, X } from 'lucide-react';
import { formatLongDate } from './useAgendaPage';
import { ProcedimentoAutocomplete } from '../shared/ProcedimentoAutocomplete.jsx';
import { PacienteAgendaSection } from './PacienteAgendaSection.jsx';
import { ProfissionalPills } from './ProfissionalPills.jsx';
import { DuracaoPills } from './DuracaoPills.jsx';
import { AgendaFormStatusBar } from './AgendaFormStatusBar.jsx';

const BTN_ACTION =
  'inline-flex max-w-[min(100%,14rem)] shrink-0 justify-center whitespace-normal text-center leading-tight';

const DATE_TIME_INPUT_CLASS = [
  'relative w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-[13px] font-medium text-gray-900',
  'outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500/20',
  '[appearance:none] [-webkit-appearance:none]',
  '[&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:inset-0',
  '[&::-webkit-calendar-picker-indicator]:h-full [&::-webkit-calendar-picker-indicator]:w-full',
  '[&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-0',
].join(' ');

const KBD_CLASS =
  'rounded border border-gray-300 bg-gray-100 px-1.5 py-0.5 font-mono text-[10px] text-gray-700';

function FieldError({ error, children }) {
  return (
    <div>
      {children}
      {error ? <div className="mt-1 text-[11px] font-bold text-red-600">{error}</div> : null}
    </div>
  );
}

function FieldLabel({ children, required, optional }) {
  return (
    <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-gray-600">
      {children}
      {required ? <span className="text-red-500"> *</span> : null}
      {optional ? <span className="font-normal normal-case text-gray-400"> (opcional)</span> : null}
    </label>
  );
}

function capitalizeFirst(s) {
  if (!s) return '';
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function formatSubtitleDateTime(iso, horaHm) {
  if (!iso || !horaHm) return '';
  const long = formatLongDate(iso, { weekday: 'long' });
  const [, m, d] = iso.split('-').map(Number);
  const ddmm = `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}`;
  const hi = String(horaHm).slice(0, 5);
  return `${capitalizeFirst(long.split(',')[0] || long)}, ${ddmm} às ${hi}`;
}

function resolveProfissionalNome(agenda) {
  const id = String(agenda.roleUserIdAgenda || '').trim();
  if (!id) return '';
  const fromEquipe = (agenda.equipeList || []).find((p) => String(p.roleUserId) === id);
  if (fromEquipe?.nome) return fromEquipe.nome;
  return agenda.editingAppointment?.profissionalNome || '';
}

function HeaderChip({ label, active }) {
  return (
    <span
      className={`rounded px-3 py-1 font-mono text-xs ${
        active ? 'bg-teal-100 text-teal-700' : 'bg-gray-100 text-gray-600'
      }`}
    >
      {label}
    </span>
  );
}

function ShortcutSubtitle() {
  return (
    <p className="mt-1 text-[12px] font-medium text-gray-500">
      <kbd className={KBD_CLASS}>Tab</kbd> navega ·{' '}
      <kbd className={KBD_CLASS}>Ctrl</kbd>+<kbd className={KBD_CLASS}>Enter</kbd> salva
    </p>
  );
}

/**
 * Modal "Novo Agendamento" / edição — mesmo UI usado na agenda.
 * `agenda.patientSelectLocked`: quando true (abrir do perfil), paciente somente leitura.
 */
export function AgendaFormModal({ agenda, onExcluirClick }) {
  const horaInicioInputRef = React.useRef(null);
  const [pacienteCreateModalOpen, setPacienteCreateModalOpen] = React.useState(false);
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

  const modalTitle = isEdit ? 'Editar agendamento' : 'Novo agendamento';
  const profNome = resolveProfissionalNome(agenda);
  const hasProfDataHora =
    Boolean(profNome) && Boolean(agenda.form.data) && Boolean(agenda.form.horaInicio);
  const subtitleDynamic = hasProfDataHora
    ? `${formatSubtitleDateTime(agenda.form.data, agenda.form.horaInicio)} · ${profNome.startsWith('Dr') ? profNome : `Dr. ${profNome}`}`
    : null;

  const chipPacienteActive = Boolean(
    String(agenda.form.pacienteId || '').trim() || String(agenda.form.pacienteNome || '').trim()
  );
  const chipDataHoraActive = Boolean(agenda.form.data && agenda.form.horaInicio);

  const horarioConflita = Boolean(agenda.horarioConflita);
  const horarioInputClass = `${DATE_TIME_INPUT_CLASS} ${
    horarioConflita ? 'border-amber-500 bg-amber-50/40 ring-1 ring-amber-300' : ''
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
      <button
        type="button"
        className={`absolute inset-0 bg-black/40 ${pacienteCreateModalOpen ? 'pointer-events-none' : ''}`}
        onClick={agenda.closeModal}
        aria-label="Fechar modal"
        tabIndex={pacienteCreateModalOpen ? -1 : 0}
      />
      <div className="relative flex max-h-[92vh] w-full max-w-[960px] flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-gray-200 p-5">
          <div className="min-w-0 flex-1">
            <h3 className="text-[18px] font-black text-gray-900">{modalTitle}</h3>
            {subtitleDynamic ? (
              <p className="mt-1 text-[12px] font-medium text-gray-500">{subtitleDynamic}</p>
            ) : (
              <ShortcutSubtitle />
            )}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <HeaderChip label="paciente" active={chipPacienteActive} />
            <HeaderChip label="data · hora" active={chipDataHoraActive} />
            <button
              type="button"
              onClick={agenda.closeModal}
              className="rounded-xl p-2 text-gray-500 hover:bg-gray-50"
              aria-label="Fechar"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-5 pb-24 lg:pb-5">
          {agenda.formErrors._global ? (
            <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 p-3 text-[13px] font-bold text-amber-900">
              {agenda.formErrors._global}
            </div>
          ) : null}

          <div className="grid gap-6 lg:grid-cols-2">
            <div className="space-y-6">
              <FieldError error={agenda.formErrors.pacienteId}>
                <FieldLabel required>Paciente</FieldLabel>
                <PacienteAgendaSection
                  locked={lockPatient}
                  pacienteId={agenda.form.pacienteId}
                  pacienteNome={agenda.form.pacienteNome}
                  telefone={agenda.form.telefone}
                  context={agenda.pacienteContext}
                  contextLoading={agenda.pacienteContextLoading}
                  onSelect={agenda.selectPaciente}
                  onClear={agenda.clearPacienteSelection}
                  onCreateModalOpenChange={setPacienteCreateModalOpen}
                />
              </FieldError>

              <FieldError error={agenda.formErrors.catalogoProcedimentoSaudeIds}>
                <FieldLabel required>{isEdit ? 'Procedimento' : 'Procedimentos'}</FieldLabel>
                <ProcedimentoAutocomplete
                  value={agenda.form.procedimentoNome || ''}
                  onInputChange={(nome) => agenda.updateForm('procedimentoNome', nome)}
                  onCommit={(nome, catalogoId) => {
                    agenda.updateForm('procedimentoNome', nome);
                    addProcedimentoChip(catalogoId, nome);
                  }}
                  placeholder="Ex: Botox, Preenchimento..."
                  catalogoOptions={agenda.procedimentoOptions.map((o) => ({
                    id: o.id,
                    nomeProcedimento: o.nome,
                  }))}
                  error={Boolean(agenda.formErrors.catalogoProcedimentoSaudeIds)}
                  showCatalogCommitBadge={false}
                />
                {selectedProcedimentos.length > 0 ? (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {selectedProcedimentos.map((id) => (
                      <span
                        key={id}
                        className="inline-flex items-center gap-1 rounded-full bg-teal-50 px-2.5 py-1 text-[11px] font-semibold text-teal-700"
                      >
                        {procedimentoChipLabel(id)}
                        <button
                          type="button"
                          onClick={() => removeProcedimentoChip(id)}
                          className="rounded-full p-0.5 hover:bg-teal-100"
                          aria-label="Remover procedimento"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                ) : null}
              </FieldError>

              <FieldError error={agenda.formErrors.profissional}>
                <FieldLabel>Profissional</FieldLabel>
                <ProfissionalPills
                  profissionais={agenda.equipeList}
                  value={agenda.roleUserIdAgenda}
                  onChange={agenda.setRoleUserIdAgenda}
                  loading={agenda.equipeLoading}
                  error={agenda.equipeError}
                  orphanLabel={agenda.editingAppointment?.profissionalNome}
                />
              </FieldError>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <FieldLabel required>Data</FieldLabel>
                  <input
                    type="date"
                    min={agenda.todayIso}
                    value={agenda.form.data}
                    onChange={(event) => agenda.updateForm('data', event.target.value)}
                    className={DATE_TIME_INPUT_CLASS}
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
                  <FieldLabel required>Horário</FieldLabel>
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
                </FieldError>
              </div>

              <FieldError error={agenda.formErrors.duracaoMin}>
                <FieldLabel required>Duração</FieldLabel>
                <DuracaoPills
                  value={agenda.form.duracaoMin}
                  onChange={(min) => agenda.updateForm('duracaoMin', min)}
                />
              </FieldError>
            </div>

            <div className="hidden min-h-[320px] flex-col items-center justify-center rounded-xl border border-dashed border-gray-300 bg-gray-50 p-10 lg:flex">
              <CalendarDays className="mb-4 h-8 w-8 text-gray-400" strokeWidth={1.5} aria-hidden />
              <p className="max-w-[220px] text-center text-[13px] leading-snug text-gray-500">
                <span className="block font-medium">Disponibilidade</span>
                <span className="block">aparecerá aqui em breve</span>
              </p>
            </div>
          </div>

          <div className="mt-6">
            <FieldLabel optional>Observações</FieldLabel>
            <textarea
              value={agenda.form.observacao}
              onChange={(event) => agenda.updateForm('observacao', event.target.value)}
              rows={3}
              className="w-full resize-none rounded-lg border border-gray-200 px-3 py-2.5 text-[13px] font-medium text-gray-900 outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500/20"
            />
          </div>
        </div>

        <div className="sticky bottom-0 z-[2] shrink-0 border-t border-gray-200 bg-white p-4 lg:static lg:p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 flex-wrap items-center gap-3">
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
              <AgendaFormStatusBar
                form={agenda.form}
                roleUserIdAgenda={agenda.roleUserIdAgenda}
                horarioConflita={agenda.horarioConflita}
                slotsOcupadosLoading={agenda.slotsOcupadosLoading}
                horarioConflitoCom={agenda.horarioConflitoCom}
              />
            </div>
            <div className="flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={agenda.closeModal}
                className={`${BTN_ACTION} rounded-lg border border-gray-200 px-4 py-2.5 text-[13px] font-bold text-gray-500 hover:bg-gray-50`}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={agenda.saveAppointment}
                className={`${BTN_ACTION} items-center gap-2 rounded-lg bg-teal-600 px-4 py-2.5 text-[13px] font-bold text-white hover:bg-teal-700`}
              >
                Salvar
                <CornerDownLeft className="h-4 w-4 shrink-0" aria-hidden />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
