import React from 'react';
import { CheckCircle, FileText, Eye, ClipboardList, Syringe, FileCheck } from 'lucide-react';

/** Etapas 1–5: Anamnese, Avaliação, Termos, Procedimento, Finalização. */
export function Stepper({ currentStep }) {
  const steps = [
    { id: 1, icon: FileText, title: 'Anamnese', sub: 'Histórico Médico' },
    { id: 2, icon: Eye, title: 'Avaliação', sub: 'Mapeamento' },
    { id: 3, icon: ClipboardList, title: 'Termos', sub: 'Consentimento' },
    { id: 4, icon: Syringe, title: 'Procedimento', sub: 'Registro e fotos' },
    { id: 5, icon: FileCheck, title: 'Finalização', sub: 'Orientações' },
  ];

  const active = steps.find((s) => s.id === currentStep) || steps[0];
  const ActiveIcon = active.icon;

  return (
    <>
      {/* Mobile (&lt;640px): só etapa atual */}
      <div className="flex shrink-0 items-center gap-2 border-b border-[#e2e8f0] pb-3 sm:hidden [-webkit-overflow-scrolling:touch]">
        <span className="h-2 w-2 shrink-0 rounded-full bg-[#00a88e]" aria-hidden />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 text-[13px] font-semibold text-[#0f172a]">
            <ActiveIcon className="h-4 w-4 shrink-0 text-[#00a88e]" strokeWidth={2.5} aria-hidden />
            <span className="truncate">{active.title}</span>
            <span className="shrink-0 text-[11px] font-medium text-[#94a3b8]">
              — Etapa {currentStep} de 5
            </span>
          </div>
          <p className="mt-0.5 truncate text-[11px] font-medium text-[#64748b]">{active.sub}</p>
        </div>
      </div>

      {/* Tablet+ : todos os passos */}
      <div className="hidden max-w-[1000px] shrink-0 items-center justify-between overflow-x-hidden pb-3 sm:flex sm:pb-4 [-webkit-overflow-scrolling:touch]">
        {steps.map((step, index) => {
          const isCompleted = currentStep > step.id;
          const isActive = currentStep === step.id;
          const Icon = isCompleted ? CheckCircle : step.icon;

          return (
            <React.Fragment key={step.id}>
              <div
                className={`flex min-h-[44px] min-w-0 flex-col items-center justify-center rounded-xl border-[3px] px-2 py-2 transition-all sm:min-w-[118px] sm:px-3 sm:py-3 md:min-w-[140px] ${
                  isCompleted
                    ? 'border-[#00a88e] bg-[#00a88e] shadow-sm'
                    : isActive
                      ? 'border-[#00a88e]/40 bg-[#e6f7f5] shadow-sm'
                      : 'border-[#00a88e]/15 bg-white'
                }`}
              >
                <div
                  className={`mb-0.5 flex items-center gap-1.5 text-center text-[12px] font-semibold sm:mb-1 sm:gap-2 sm:text-[14px] ${
                    isCompleted ? 'text-white' : isActive ? 'text-[#00a88e]' : 'text-[#64748b]'
                  }`}
                >
                  <Icon className="h-[18px] w-[18px] shrink-0" strokeWidth={2.5} />{' '}
                  <span className="truncate">{step.title}</span>
                </div>
                <p
                  className={`text-center text-[10px] font-medium sm:text-[11px] ${
                    isCompleted ? 'text-white/80' : isActive ? 'text-[#00a88e]/80' : 'text-[#94a3b8]'
                  }`}
                >
                  {step.sub}
                </p>
              </div>
              {index < steps.length - 1 && (
                <div
                  className={`mx-1 h-1 flex-1 rounded-full transition-all sm:mx-2 ${
                    isCompleted ? 'bg-[#00a88e]' : 'bg-[#e2e8f0]'
                  }`}
                />
              )}
            </React.Fragment>
          );
        })}
      </div>
    </>
  );
}
