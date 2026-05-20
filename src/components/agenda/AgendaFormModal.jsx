import React, { useCallback, useRef } from 'react';
import { CalendarDays, CornerDownLeft, Trash2, X } from 'lucide-react';
import { ProcedimentoAutocomplete } from '../shared/ProcedimentoAutocomplete.jsx';
import { PacienteAgendaSection } from './PacienteAgendaSection.jsx';
import { ProfissionalPills } from './ProfissionalPills.jsx';
import { DuracaoPills } from './DuracaoPills.jsx';
import { AgendaFormStatusBar } from './AgendaFormStatusBar.jsx';
import { AgendaDisponibilidadePanel } from './AgendaDisponibilidadePanel.jsx';
import { AgendaDisponibilidadeMobileSheet } from './AgendaDisponibilidadeMobileSheet.jsx';
import { formatAgendaDateTimeCta } from './agendaFormModalUtils.js';

const BTN_ACTION =
  'inline-flex max-w-[min(100%,14rem)] shrink-0 justify-center whitespace-normal text-center leading-tight';

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

function AgendaDisponibilidadeMobileCta({ agenda, formErrors, onOpen, expanded }) {
  const role = String(agenda.roleUserIdAgenda || '').trim();
  const hasSelection = Boolean(agenda.form.data && agenda.form.horaInicio);
  const ctaLabel = hasSelection
    ? formatAgendaDateTimeCta(agenda.form.data, agenda.form.horaInicio)
    : 'Escolher data e horário';

  const dataHoraError =
    formErrors?.data || formErrors?.horaInicio
      ? [formErrors.data, formErrors.horaInicio].filter(Boolean).join(' · ')
      : '';

  if (!role) {
    return (
      <div className="lg:hidden">
        <FieldLabel required>Data e horário</FieldLabel>
        <div className="flex min-h-[52px] items-center justify-center rounded-xl border border-dashed border-gray-300 bg-gray-50/50 px-4 py-3">
          <p className="text-center text-[13px] text-gray-500">Selecione um profissional</p>
        </div>
      </div>
    );
  }

  return (
    <div className="lg:hidden">
      <FieldLabel required>Data e horário</FieldLabel>
      {dataHoraError ? (
        <p className="mb-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[12px] font-medium text-red-800">
          {dataHoraError}
        </p>
      ) : null}
      <button
        type="button"
        onClick={onOpen}
        aria-haspopup="dialog"
        aria-expanded={expanded}
        className={`flex w-full items-center gap-3 rounded-xl border px-4 py-3.5 text-left text-[13px] font-semibold transition-colors ${
          hasSelection
            ? 'border-teal-200 bg-teal-50 text-teal-700 hover:bg-teal-100/80'
            : 'border-dashed border-gray-300 bg-white text-gray-600 hover:border-teal-300 hover:bg-teal-50/30'
        }`}
      >
        <CalendarDays
          className={`h-5 w-5 shrink-0 ${hasSelection ? 'text-teal-600' : 'text-gray-400'}`}
          strokeWidth={1.75}
          aria-hidden
        />
        <span className="min-w-0 flex-1">{ctaLabel}</span>
      </button>
    </div>
  );
}

/**
 * Modal "Novo Agendamento" / edição — mesmo UI usado na agenda.
 * `agenda.patientSelectLocked`: quando true (abrir do perfil), paciente somente leitura.
 */
export function AgendaFormModal({ agenda, onExcluirClick }) {
  const [pacienteCreateModalOpen, setPacienteCreateModalOpen] = React.useState(false);
  const [dispSheetOpen, setDispSheetOpen] = React.useState(false);
  const dispSnapshotRef = useRef('');

  const closeDispSheetRevert = useCallback(() => {
    setDispSheetOpen(false);
    agenda.selectDispCalendarioDia(dispSnapshotRef.current || '');
  }, [agenda]);

  const openDispSheet = useCallback(() => {
    const initial = agenda.dispCalendarioDia || agenda.form.data || '';
    dispSnapshotRef.current = initial;
    if (initial && initial !== agenda.dispCalendarioDia) {
      agenda.selectDispCalendarioDia(initial);
    }
    setDispSheetOpen(true);
  }, [agenda]);

  const confirmDispSheet = useCallback(() => {
    setDispSheetOpen(false);
  }, []);

  React.useEffect(() => {
    if (!agenda.modalMode) {
      setDispSheetOpen(false);
    }
  }, [agenda.modalMode]);

  React.useEffect(() => {
    if (!agenda.modalMode) return undefined;

    const onKeyDown = (event) => {
      if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
        if (pacienteCreateModalOpen || dispSheetOpen) return;
        event.preventDefault();
        void agenda.saveAppointment();
        return;
      }

      if (event.key !== 'Escape') return;

      if (pacienteCreateModalOpen) return;

      if (dispSheetOpen) {
        event.preventDefault();
        closeDispSheetRevert();
        return;
      }

      event.preventDefault();
      agenda.closeModal();
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    agenda,
    pacienteCreateModalOpen,
    dispSheetOpen,
    closeDispSheetRevert,
  ]);

  if (!agenda.modalMode) return null;
  const isEdit = agenda.modalMode === 'edit';
  const lockPatient = Boolean(agenda.patientSelectLocked) && !isEdit;

  const modalTitle = isEdit ? 'Editar agendamento' : 'Novo agendamento';
  const profNome = resolveProfissionalNome(agenda);
  const hasProfDataHora =
    Boolean(profNome) && Boolean(agenda.form.data) && Boolean(agenda.form.horaInicio);
  const subtitleDynamic = hasProfDataHora
    ? `${formatAgendaDateTimeCta(agenda.form.data, agenda.form.horaInicio)} · ${profNome.startsWith('Dr') ? profNome : `Dr. ${profNome}`}`
    : null;

  const chipPacienteActive = Boolean(
    String(agenda.form.pacienteId || '').trim() || String(agenda.form.pacienteNome || '').trim()
  );
  const chipDataHoraActive = Boolean(agenda.form.data && agenda.form.horaInicio);

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
        className={`absolute inset-0 bg-black/40 ${pacienteCreateModalOpen || dispSheetOpen ? 'pointer-events-none' : ''}`}
        onClick={agenda.closeModal}
        aria-label="Fechar modal"
        tabIndex={pacienteCreateModalOpen || dispSheetOpen ? -1 : 0}
      />
      <div className="relative flex max-h-[92vh] w-full max-w-[1120px] flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
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

          <div className="flex flex-col gap-6">
            <div className="grid gap-6 lg:grid-cols-2">
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
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
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

              <FieldError error={agenda.formErrors.duracaoMin}>
                <FieldLabel required>Duração</FieldLabel>
                <DuracaoPills
                  value={agenda.form.duracaoMin}
                  onChange={(min) => agenda.updateForm('duracaoMin', min)}
                />
              </FieldError>
            </div>

            <AgendaDisponibilidadeMobileCta
              agenda={agenda}
              formErrors={agenda.formErrors}
              onOpen={openDispSheet}
              expanded={dispSheetOpen}
            />

            <AgendaDisponibilidadePanel agenda={agenda} formErrors={agenda.formErrors} />

            <div>
              <FieldLabel optional>Observações</FieldLabel>
              <textarea
                value={agenda.form.observacao}
                onChange={(event) => agenda.updateForm('observacao', event.target.value)}
                rows={3}
                className="w-full resize-none rounded-lg border border-gray-200 px-3 py-2.5 text-[13px] font-medium text-gray-900 outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500/20"
              />
            </div>
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

      <AgendaDisponibilidadeMobileSheet
        open={dispSheetOpen}
        agenda={agenda}
        formErrors={agenda.formErrors}
        onCancel={closeDispSheetRevert}
        onConfirm={confirmDispSheet}
      />
    </div>
  );
}
