import React, { useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import { PacienteSearchInput } from './PacienteSearchInput.jsx';
import { PacienteContextCard } from './PacienteContextCard.jsx';
import { PatientCreateView } from '../patients/PatientCreateView.jsx';

export function PacienteAgendaSection({
  locked = false,
  pacienteId = '',
  pacienteNome = '',
  telefone = '',
  context = null,
  contextLoading = false,
  onSelect,
  onClear,
  onCreateModalOpenChange,
}) {
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const id = String(pacienteId || '').trim();

  useEffect(() => {
    onCreateModalOpenChange?.(createModalOpen);
  }, [createModalOpen, onCreateModalOpenChange]);

  useEffect(() => {
    if (!createModalOpen) return undefined;
    return () => onCreateModalOpenChange?.(false);
  }, [createModalOpen, onCreateModalOpenChange]);

  const handleSelect = (patientId, patient) => {
    setCreateModalOpen(false);
    onSelect(patientId, patient);
  };

  const closeCreateModal = () => setCreateModalOpen(false);

  if (locked) {
    return (
      <PacienteSearchInput
        value={id}
        displayNome={pacienteNome}
        locked
        onChange={onSelect}
      />
    );
  }

  if (id) {
    const cardPatient = context
      ? {
          ...context,
          nome: pacienteNome || context.nome,
          telefone: telefone || context.telefone,
        }
      : { id, nome: pacienteNome, telefone };

    return (
      <PacienteContextCard
        patient={cardPatient}
        fallbackNome={pacienteNome}
        fallbackTelefone={telefone}
        loading={contextLoading}
        onClear={onClear}
      />
    );
  }

  return (
    <>
      <div className="flex flex-nowrap gap-2">
        <div className="min-w-0 flex-1">
          <PacienteSearchInput
            value={id}
            displayNome={pacienteNome}
            locked={false}
            onChange={handleSelect}
            hideSelectedHint
          />
        </div>
        <button
          type="button"
          onClick={() => setCreateModalOpen(true)}
          className="inline-flex h-[42px] shrink-0 items-center justify-center gap-1.5 rounded-lg border border-brand-primary bg-white px-3 text-[13px] font-semibold text-brand-primaryDark transition-colors hover:border-brand-primary hover:bg-brand-primaryGhost focus:outline-none focus-visible:ring-2 focus-visible:ring-vivid-teal-500/40 focus-visible:ring-offset-2 max-[380px]:w-[42px] max-[380px]:px-0"
          aria-label="Cadastrar paciente"
          title="Cadastrar paciente"
        >
          <Plus className="h-4 w-4 shrink-0" strokeWidth={2.5} aria-hidden />
          <span className="hidden min-[381px]:inline whitespace-nowrap">Cadastrar paciente</span>
        </button>
      </div>

      {createModalOpen ? (
        <PatientCreateView
          variant="modal"
          hostMode="agenda"
          zIndex={240}
          setPatientView={closeCreateModal}
          onClose={closeCreateModal}
          onSuccess={(patient) => {
            if (patient?.id) onSelect(String(patient.id), patient);
            closeCreateModal();
          }}
        />
      ) : null}
    </>
  );
}
