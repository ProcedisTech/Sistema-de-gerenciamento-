import React from 'react';
import { AlertTriangle, ClipboardList, Loader2, X } from 'lucide-react';
import { getPatientInitials } from '../utils/formatters';
import { lastProcedureDateForCard, lastProcedureLabel } from '../../utils/patientLastProcedure.js';

function truncateAlert(text, max = 60) {
  const s = String(text ?? '').trim();
  if (s.length <= max) return s;
  return `${s.slice(0, max - 1)}…`;
}

function allergyAlertText(patient) {
  const al = String(patient?.alergias ?? '').trim();
  const cond = String(patient?.condicoesSaude ?? '').trim();
  const raw = al || cond;
  if (!raw) return null;
  return `Alérgico a ${truncateAlert(raw)}`;
}

export function PacienteContextCard({
  patient,
  fallbackNome = '',
  fallbackTelefone = '',
  loading = false,
  readOnly = false,
  onClear,
}) {
  const nome = patient?.nome || fallbackNome || '—';
  const telefone = patient?.telefone || fallbackTelefone || '';
  const ultimaData = patient ? lastProcedureDateForCard(patient) : '—';
  const ultimoProc = patient ? lastProcedureLabel(patient) : '—';
  const allergy = patient ? allergyAlertText(patient) : null;
  const anamneseVencida = Boolean(patient?.anamneseDesatualizada);

  return (
    <div
      className={`relative rounded-xl border border-gray-200 bg-white p-3 shadow-sm ${loading ? 'opacity-60' : ''}`}
    >
      {loading ? (
        <Loader2
          className="absolute right-10 top-3 h-4 w-4 animate-spin text-teal-600"
          aria-label="Carregando dados do paciente"
        />
      ) : null}
      {!readOnly && onClear ? (
        <button
          type="button"
          onClick={onClear}
          className="absolute right-2 top-2 rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
          aria-label="Remover paciente selecionado"
        >
          <X className="h-4 w-4" />
        </button>
      ) : null}

      <div className="flex gap-3 pr-8">
        <div
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-teal-400 to-teal-600 text-[13px] font-bold text-white"
          aria-hidden
        >
          {getPatientInitials(nome)}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[14px] font-bold text-gray-900">{nome}</p>
          {telefone ? (
            <p className="truncate text-[12px] font-medium text-gray-500">{telefone}</p>
          ) : null}
          <p className="mt-1 text-[11px] font-medium text-gray-500">
            Última visita: {ultimaData} · {ultimoProc}
          </p>
          {(allergy || anamneseVencida) && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {allergy ? (
                <span className="inline-flex max-w-full items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-bold text-red-700">
                  <AlertTriangle className="h-3 w-3 shrink-0" aria-hidden />
                  <span className="truncate">{allergy}</span>
                </span>
              ) : null}
              {anamneseVencida ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-800">
                  <ClipboardList className="h-3 w-3 shrink-0" aria-hidden />
                  Anamnese desatualizada
                </span>
              ) : null}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
