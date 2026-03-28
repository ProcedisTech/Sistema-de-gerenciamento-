import React from 'react';
import { ChevronRight, CheckCircle, UserCheck, FileText, Eye, Syringe, FileCheck } from 'lucide-react';

export function Stepper({ currentStep }) {
  const steps = [
    { id: 1, icon: UserCheck, title: "Check-in", sub: "Identificação" },
    { id: 2, icon: FileText, title: "Anamnese", sub: "Histórico Médico" },
    { id: 3, icon: Eye, title: "Avaliação", sub: "Mapeamento" },
    { id: 4, icon: Syringe, title: "Execução", sub: "LGPD + Procedimento" },
    { id: 5, icon: FileCheck, title: "Finalização", sub: "Orientações" }
  ];

  return (
    <div className="flex items-center justify-between max-w-[1000px] overflow-x-auto pb-4 custom-scrollbar">
      {steps.map((step, index) => {
        const isCompleted = currentStep > step.id;
        const isActive = currentStep === step.id;
        const Icon = isCompleted ? CheckCircle : step.icon;

        return (
          <React.Fragment key={step.id}>
            <div className={`px-4 py-3 rounded-xl flex flex-col items-center justify-center min-w-[140px] transition-all border-[3px] ${isCompleted ? 'bg-[#00a88e] border-[#00a88e] shadow-sm' : isActive ? 'bg-[#e6f7f5] border-[#00a88e]/40 shadow-sm' : 'bg-white border-[#00a88e]/15'}`}>
              <div className={`flex items-center gap-2 font-semibold text-[14px] mb-1 ${isCompleted ? 'text-white' : isActive ? 'text-[#00a88e]' : 'text-[#64748b]'}`}>
                <Icon className="w-[18px] h-[18px]" strokeWidth={2.5} /> {step.title}
              </div>
              <p className={`text-[11px] font-medium ${isCompleted ? 'text-white/80' : isActive ? 'text-[#00a88e]/80' : 'text-[#94a3b8]'}`}>
                {step.sub}
              </p>
            </div>
            {index < steps.length - 1 && (
              <div className={`h-1 flex-1 mx-2 rounded-full transition-all ${isCompleted ? 'bg-[#00a88e]' : 'bg-[#e2e8f0]'}`} />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

