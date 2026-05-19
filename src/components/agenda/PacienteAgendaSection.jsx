import React, { useState } from 'react';
import { Plus } from 'lucide-react';
import { PacienteSearchInput } from './PacienteSearchInput.jsx';
import { PacienteContextCard } from './PacienteContextCard.jsx';
import { PacienteInlineCreate } from './PacienteInlineCreate.jsx';

export function PacienteAgendaSection({
  locked = false,
  pacienteId = '',
  pacienteNome = '',
  telefone = '',
  context = null,
  contextLoading = false,
  onSelect,
  onClear,
  onCreate,
  createSubmitting = false,
}) {
  const [creating, setCreating] = useState(false);
  const id = String(pacienteId || '').trim();

  const handleSelect = (patientId, patient) => {
    setCreating(false);
    onSelect(patientId, patient);
  };

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

  if (creating) {
    return (
      <PacienteInlineCreate
        submitting={createSubmitting}
        onCancel={() => setCreating(false)}
        onSubmit={async (payload) => {
          const result = await onCreate(payload);
          if (result?.ok) setCreating(false);
          return result;
        }}
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
        onClick={() => setCreating(true)}
        className="flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-lg border border-gray-200 bg-white text-teal-600 hover:border-teal-300 hover:bg-teal-50"
        aria-label="Cadastrar paciente"
        title="Cadastrar paciente"
      >
        <Plus className="h-5 w-5" strokeWidth={2.5} />
      </button>
    </div>
  );
}
