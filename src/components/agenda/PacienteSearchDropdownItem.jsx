import React from 'react';
import { getPatientInitials, maskCpfPartial } from '../utils/formatters';
import { formatPhoneInternationalDisplay } from '../../utils/phoneUtils';

function patientTelefone(p) {
  return p?.telefone || p?.phone || p?.telefonePrincipal || '';
}

export function PacienteSearchDropdownItem({ patient, selected, onSelect }) {
  const nome = patient?.nome || '—';
  const cpfMasked = patient?.cpf ? maskCpfPartial(patient.cpf) : '';
  const tel = formatPhoneInternationalDisplay(patientTelefone(patient));
  const metaParts = [cpfMasked, tel].filter(Boolean);

  return (
    <button
      type="button"
      role="option"
      aria-selected={selected}
      onMouseDown={(e) => e.preventDefault()}
      onClick={() => onSelect(patient)}
      className={`flex w-full items-center gap-3 border-b border-gray-100 px-3 py-2.5 text-left last:border-0 ${
        selected ? 'bg-teal-50' : 'hover:bg-gray-50'
      }`}
    >
      <div
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-teal-400 to-teal-600 text-[13px] font-bold text-white"
        aria-hidden
      >
        {getPatientInitials(nome)}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] font-bold text-gray-900">{nome}</p>
        {metaParts.length > 0 ? (
          <p className="truncate text-[12px] font-medium text-gray-500">{metaParts.join(' · ')}</p>
        ) : null}
      </div>
    </button>
  );
}
