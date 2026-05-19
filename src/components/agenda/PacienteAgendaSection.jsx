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
      <div className="flex gap-2">
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
          className="flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-lg border border-gray-200 bg-white text-teal-600 hover:border-teal-300 hover:bg-teal-50"
          aria-label="Cadastrar paciente"
          title="Cadastrar paciente"
        >
          <Plus className="h-5 w-5" strokeWidth={2.5} />
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
