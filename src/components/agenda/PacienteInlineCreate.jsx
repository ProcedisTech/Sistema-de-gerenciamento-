import React, { useState } from 'react';
import { maskCPF } from '../utils/formatters';
import { validatePacienteInlineAgenda } from '../../utils/patientFormValidation';
import { formatPhoneAsYouType } from '../../utils/phoneUtils';

const INPUT_CLASS =
  'w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-[13px] font-medium text-gray-900 outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500/20';

const LABEL_CLASS = 'mb-1 block text-[11px] font-bold uppercase tracking-wide text-gray-500';

export function PacienteInlineCreate({ onCancel, onSubmit, submitting = false }) {
  const [nome, setNome] = useState('');
  const [telefoneNumero, setTelefoneNumero] = useState('');
  const [telefoneCountryCode] = useState('BR');
  const [cpf, setCpf] = useState('');
  const [errors, setErrors] = useState({});
  const [banner, setBanner] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setBanner('');
    const nextErrors = validatePacienteInlineAgenda({
      nome,
      telefoneCountryCode,
      telefoneNumero,
      cpf,
    });
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    const result = await onSubmit({
      nome,
      telefoneCountryCode,
      telefoneNumero,
      cpf,
    });
    if (!result?.ok) {
      setBanner(result?.banner || 'Não foi possível cadastrar o paciente.');
      if (result?.highlightCpf) setErrors((prev) => ({ ...prev, cpf: true }));
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3 rounded-xl border border-gray-200 bg-gray-50/80 p-3">
      {banner ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[12px] font-semibold text-red-800">
          {banner}
        </p>
      ) : null}

      <div>
        <label className={LABEL_CLASS}>
          Nome <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          value={nome}
          onChange={(ev) => {
            setNome(ev.target.value);
            setErrors((prev) => ({ ...prev, nome: false }));
          }}
          className={`${INPUT_CLASS} ${errors.nome ? 'border-red-400' : ''}`}
          placeholder="Nome completo"
          autoComplete="name"
        />
      </div>

      <div>
        <label className={LABEL_CLASS}>
          Telefone <span className="text-red-500">*</span>
        </label>
        <input
          type="tel"
          value={telefoneNumero}
          onChange={(ev) => {
            setTelefoneNumero(formatPhoneAsYouType(telefoneCountryCode, ev.target.value));
            setErrors((prev) => ({ ...prev, telefone: false }));
          }}
          className={`${INPUT_CLASS} ${errors.telefone ? 'border-red-400' : ''}`}
          placeholder="(00) 00000-0000"
          autoComplete="tel"
        />
      </div>

      <div>
        <label className={LABEL_CLASS}>CPF</label>
        <input
          type="text"
          value={cpf}
          onChange={(ev) => {
            setCpf(maskCPF(ev.target.value));
            setErrors((prev) => ({ ...prev, cpf: false }));
          }}
          className={`${INPUT_CLASS} ${errors.cpf ? 'border-red-400' : ''}`}
          placeholder="000.000.000-00"
          inputMode="numeric"
        />
      </div>

      <div className="flex justify-end gap-2 pt-1">
        <button
          type="button"
          onClick={onCancel}
          disabled={submitting}
          className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-[13px] font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={submitting}
          className="rounded-lg bg-teal-600 px-4 py-2 text-[13px] font-semibold text-white hover:bg-teal-700 disabled:opacity-50"
        >
          {submitting ? 'Cadastrando…' : 'Cadastrar'}
        </button>
      </div>
    </form>
  );
}
