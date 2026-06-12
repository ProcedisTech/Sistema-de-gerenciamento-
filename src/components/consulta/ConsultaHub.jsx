import React from 'react';
import { BookOpen, ClipboardList, Eye, FileText, Syringe } from 'lucide-react';
import { getPatientInitials as defaultGetPatientInitials } from '../utils';

// TODO: badges — PacienteIndicadores não existe; conectar quando criado

const MODULE_CARDS = [
  { id: 'anamnese', label: 'Anamnese', description: 'Ficha e histórico clínico', icon: FileText },
  { id: 'avaliacao', label: 'Avaliação', description: 'Fotos e desenho sobre as imagens', icon: Eye },
  { id: 'planejamento', label: 'Planejamento', description: 'Planos de tratamento e procedimentos', icon: BookOpen },
  { id: 'termos', label: 'Termos', description: 'Consentimentos e assinaturas', icon: ClipboardList },
  { id: 'procedimento', label: 'Procedimento', description: 'Registro, fotos e finalização', icon: Syringe },
];

export function ConsultaHub({ paciente, onSelectModule, onSair, getPatientInitials }) {
  const initialsFn = getPatientInitials ?? defaultGetPatientInitials;
  const iniciais = paciente ? initialsFn(paciente.nome || '') || '—' : '—';

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-app-border pb-5">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#00a88e] text-[13px] font-bold text-white sm:h-12 sm:w-12">
            {iniciais}
          </div>
          <div className="min-w-0">
            <h2 className="truncate text-[18px] font-bold text-[#0f172a] sm:text-[20px]">
              {paciente?.nome || 'Paciente'}
            </h2>
            <p className="text-[13px] font-medium text-[#00a88e] sm:text-[14px]">Consulta em andamento</p>
          </div>
        </div>
        {typeof onSair === 'function' ? (
          <button
            type="button"
            onClick={onSair}
            className="rounded-xl border border-app-border bg-white px-4 py-2.5 text-[13px] font-semibold text-[#64748b] transition-colors hover:bg-app-nav-hover active:bg-app-nav-active"
          >
            Sair
          </button>
        ) : null}
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {MODULE_CARDS.map((card) => {
          const ModuleIcon = card.icon;
          return (
          <button
            key={card.id}
            type="button"
            onClick={() => onSelectModule?.(card.id)}
            className="flex flex-col gap-3 rounded-xl border border-app-border bg-white p-4 text-left transition-colors hover:bg-app-nav-hover active:bg-app-nav-active sm:p-5"
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#e6f7f5] text-[#00a88e]">
              <ModuleIcon className="h-5 w-5" strokeWidth={2.2} aria-hidden />
            </span>
            <span>
              <span className="block text-[15px] font-bold text-[#0f172a] sm:text-[16px]">{card.label}</span>
              <span className="mt-1 block text-[13px] leading-snug text-[#64748b]">{card.description}</span>
            </span>
          </button>
          );
        })}
      </div>
    </div>
  );
}
