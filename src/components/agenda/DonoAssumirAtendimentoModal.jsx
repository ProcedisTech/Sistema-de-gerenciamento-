import React, { useState, useEffect, useRef } from 'react';
import { AlertTriangle, ArrowRight, ArrowLeft, Check, Play, X, UserCheck } from 'lucide-react';

/**
 * Modal de Confirmação em 2 Etapas para o Dono assumir atendimento agendado para outro profissional.
 * Etapa 1: Conscientização e transferência de responsabilidade médica/legal.
 * Etapa 2: Confirmação definitiva de certeza e início imediato.
 */
export function DonoAssumirAtendimentoModal({
  isOpen = false,
  onClose,
  onConfirm,
  appointment,
  donoNome = 'Dono da Clínica',
  isSubmitting = false,
}) {
  const [step, setStep] = useState(1);
  const dialogRef = useRef(null);

  // Reseta para o passo 1 sempre que abrir
  useEffect(() => {
    if (isOpen) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setStep(1);
    }
  }, [isOpen]);

  // Fecha com a tecla Esc
  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === 'Escape' && isOpen && !isSubmitting) {
        onClose?.();
      }
    }
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isSubmitting, onClose]);

  if (!isOpen) return null;

  const pacienteNome =
    appointment?.pacienteNome ||
    appointment?.paciente?.nome ||
    appointment?.nomePaciente ||
    'Paciente';

  const procedimentoNome =
    appointment?.procedimentoNome ||
    appointment?.procedimento?.nome ||
    appointment?.tipoProcedimentoNome ||
    'Consulta / Procedimento';

  const profissionalOriginal =
    appointment?.profissionalNome ||
    appointment?.profissional?.nome ||
    appointment?.nomeProfissional ||
    'Profissional Titular';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-labelledby="dono-takeover-title"
      ref={dialogRef}
      onClick={(e) => {
        if (e.target === dialogRef.current && !isSubmitting) onClose?.();
      }}
    >
      <div className="w-full max-w-[560px] rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
        
        {/* Header com Stepper */}
        <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50/80 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className={`flex items-center gap-2 text-xs font-bold ${step === 1 ? 'text-teal-700' : 'text-emerald-700'}`}>
              <span
                className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold transition-colors ${
                  step === 1
                    ? 'border-2 border-teal-600 bg-teal-50 text-teal-700'
                    : 'bg-emerald-600 text-white'
                }`}
              >
                {step === 1 ? '1' : <Check className="h-3.5 w-3.5" aria-hidden />}
              </span>
              <span>Esclarecimento</span>
            </div>

            <div className={`h-0.5 w-8 transition-colors ${step === 2 ? 'bg-emerald-600' : 'bg-slate-200'}`} />

            <div className={`flex items-center gap-2 text-xs font-bold ${step === 2 ? 'text-teal-700' : 'text-slate-400'}`}>
              <span
                className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold transition-colors ${
                  step === 2
                    ? 'border-2 border-teal-600 bg-teal-50 text-teal-700'
                    : 'border-2 border-slate-200 bg-white text-slate-400'
                }`}
              >
                2
              </span>
              <span>Confirmação</span>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-200/60 hover:text-slate-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 disabled:opacity-50 transition-colors"
            aria-label="Fechar modal"
          >
            <X className="h-5 w-5" aria-hidden />
          </button>
        </div>

        {/* Etapa 1: Esclarecimento de Responsabilidade */}
        {step === 1 ? (
          <div className="flex flex-col gap-5 p-6">
            <div className="flex flex-col gap-1.5">
              <span className="self-start rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider text-amber-800">
                Etapa 1 de 2 · Responsabilidade Clínica
              </span>
              <h2 id="dono-takeover-title" className="text-lg font-bold text-slate-900">
                Assumir Atendimento de Outro Profissional
              </h2>
              <p className="text-sm text-slate-600 leading-relaxed">
                Este agendamento pertence originalmente a outro membro clínico. Como Dono da clínica, você pode assumir a execução, mas precisa estar ciente das implicações no prontuário.
              </p>
            </div>

            {/* Comparativo Visual Original -> Dono */}
            <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50/70 p-4 gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-100 font-bold text-red-700 text-xs">
                  {profissionalOriginal.slice(0, 2).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <div className="text-[10px] font-bold uppercase text-slate-400">Agendado Original</div>
                  <div className="truncate text-sm font-semibold text-slate-800" title={profissionalOriginal}>
                    {profissionalOriginal}
                  </div>
                </div>
              </div>

              <div className="shrink-0 text-slate-400">
                <ArrowRight className="h-5 w-5" aria-hidden />
              </div>

              <div className="flex items-center gap-3 min-w-0">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-teal-100 font-bold text-teal-800 text-xs border border-teal-300">
                  👑
                </div>
                <div className="min-w-0">
                  <div className="text-[10px] font-bold uppercase text-teal-700">Novo Executor</div>
                  <div className="truncate text-sm font-bold text-teal-950" title={donoNome}>
                    {donoNome}
                  </div>
                </div>
              </div>
            </div>

            {/* Box Informativo de Governança */}
            <div className="flex gap-3 rounded-xl border border-amber-200/90 bg-amber-50/70 p-4 text-xs leading-relaxed text-amber-900">
              <AlertTriangle className="h-5 w-5 shrink-0 text-amber-700" aria-hidden />
              <div>
                <strong className="block font-semibold text-amber-950 mb-0.5">
                  Atenção aos registros médicos e legais:
                </strong>
                A consulta, os termos de consentimento, prescrições e anotações do prontuário serão formalmente assinados no seu nome. O agendamento manterá o histórico auditável do profissional previsto originalmente.
              </div>
            </div>

            {/* Rodapé da Etapa 1 */}
            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={onClose}
                className="h-10 rounded-xl border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => setStep(2)}
                className="inline-flex h-10 items-center gap-2 rounded-xl bg-teal-600 px-5 text-sm font-bold text-white shadow-sm hover:bg-teal-700 transition-all hover:gap-2.5"
              >
                <span>Avançar para Confirmação</span>
                <ArrowRight className="h-4 w-4" aria-hidden />
              </button>
            </div>
          </div>
        ) : (
          /* Etapa 2: Confirmação Definitiva */
          <div className="flex flex-col gap-5 p-6 animate-in fade-in duration-150">
            <div className="flex flex-col gap-1.5">
              <span className="self-start rounded-full border border-teal-200 bg-teal-50 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider text-teal-800">
                Etapa 2 de 2 · Confirmação Definitiva
              </span>
              <h2 id="dono-takeover-title" className="text-lg font-bold text-slate-900">
                Confirmar Início Imediato da Consulta?
              </h2>
              <p className="text-sm text-slate-600 leading-relaxed">
                Ao confirmar, a consulta será imediatamente aberta no modo <strong>AO VIVO</strong> e o atendimento será iniciado sob sua tutela clínica.
              </p>
            </div>

            {/* Resumo do Atendimento */}
            <div className="flex flex-col gap-2 rounded-xl border border-teal-200 bg-teal-50/50 p-4 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-bold text-teal-800 uppercase tracking-wider text-[11px]">Paciente</span>
                <span className="text-sm font-bold text-slate-900">{pacienteNome}</span>
              </div>
              <div className="h-px bg-teal-200/60" />
              <div className="flex items-center justify-between">
                <span className="font-bold text-teal-800 uppercase tracking-wider text-[11px]">Procedimento</span>
                <span className="text-xs font-semibold text-slate-700">{procedimentoNome}</span>
              </div>
              <div className="h-px bg-teal-200/60" />
              <div className="flex items-center justify-between">
                <span className="font-bold text-teal-800 uppercase tracking-wider text-[11px]">Executor Clínico</span>
                <span className="text-xs font-bold text-teal-900 flex items-center gap-1.5">
                  <UserCheck className="h-3.5 w-3.5 text-teal-700" />
                  {donoNome} (Dono)
                </span>
              </div>
            </div>

            <p className="text-sm text-slate-700 font-medium">
              Tem certeza que deseja assumir e iniciar o atendimento de <strong>{pacienteNome}</strong> agora?
            </p>

            {/* Rodapé da Etapa 2 */}
            <div className="flex items-center justify-between pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setStep(1)}
                disabled={isSubmitting}
                className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors disabled:opacity-50"
              >
                <ArrowLeft className="h-4 w-4" aria-hidden />
                <span>Voltar à Etapa 1</span>
              </button>

              <button
                type="button"
                onClick={() => onConfirm?.(appointment)}
                disabled={isSubmitting}
                className="inline-flex h-10 items-center gap-2 rounded-xl bg-teal-700 px-5 text-sm font-bold text-white shadow-md hover:bg-teal-800 transition-all disabled:opacity-50"
              >
                <Play className="h-4 w-4 fill-current" aria-hidden />
                <span>{isSubmitting ? 'Iniciando Consulta...' : 'Sim, Iniciar Atendimento'}</span>
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

