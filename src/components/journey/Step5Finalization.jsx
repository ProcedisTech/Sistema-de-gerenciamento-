import React from 'react';
import { CheckCircle, Square, CheckSquare, CheckCircle2, BookOpen, ThumbsUp } from 'lucide-react';

const ORIENTACOES_ITENS = [
  'Evite exposição solar direta por 48 horas',
  'Não toque na área tratada nas primeiras 6 horas',
  'Mantenha a pele hidratada',
  'Use protetor solar SPF 50+ nos próximos 7 dias',
  'Evite atividades físicas intensas por 24 horas',
  'Entre em contato conosco em caso de dúvidas ou reações',
];

export function Step5Finalization({
  orientacoes,
  setOrientacoes,
  satisfacao,
  setSatisfacao,
  step5Errors = {},
  setStep5Errors = () => {},
}) {
  const [nextReturnDate, setNextReturnDate] = React.useState('');

  return (
    <div className="pb-4 min-w-0">
      <div className="mb-8 flex items-center gap-4">
        <div className="rounded-2xl border-[3px] border-[#22c55e]/25 bg-[#dcfce7] p-3 text-[#22c55e]">
          <CheckCircle className="h-7 w-7" strokeWidth={2.5} />
        </div>
        <div>
          <h3 className="text-[20px] font-bold text-[#0f172a]">Finalização do Procedimento</h3>
          <p className="text-[14px] font-medium text-[#64748b]">Orientações e confirmações finais</p>
        </div>
      </div>

      <div
        className={`space-y-6 rounded-2xl border-[3px] bg-white p-6 ${
          step5Errors.orientacoes || step5Errors.satisfacao ? 'border-red-300' : 'border-[#00a88e]/25'
        }`}
      >
        <div>
          <h4 className="mb-4 text-[18px] font-bold text-[#0f766e]">Orientações Pós-Procedimento</h4>
          <div className="space-y-2">
            {ORIENTACOES_ITENS.map((texto) => (
              <div
                key={texto}
                className="flex items-start gap-3 rounded-lg border border-[#bbf7d0] bg-[#f0fdf4] p-3"
              >
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#16a34a]" strokeWidth={2.5} aria-hidden />
                <p className="text-[14px] font-medium leading-snug text-[#0f172a]">{texto}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-1.5 border-t border-[#e2e8f0] pt-5">
          <label htmlFor="next-return-date" className="text-[13px] font-bold text-[#00a88e]">
            Data do próximo retorno (opcional)
          </label>
          <input
            id="next-return-date"
            type="date"
            value={nextReturnDate}
            onChange={(e) => setNextReturnDate(e.target.value)}
            className="w-full max-w-xs rounded-xl border-[2px] border-[#e2e8f0] px-4 py-2.5 text-[14px] outline-none focus:border-[#00a88e]"
          />
        </div>

        <div className="border-t border-[#e2e8f0] pt-5">
          <div
            role="button"
            tabIndex={0}
            onClick={() => {
              setOrientacoes(!orientacoes);
              setStep5Errors((prev) => ({ ...prev, orientacoes: false }));
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                setOrientacoes(!orientacoes);
                setStep5Errors((prev) => ({ ...prev, orientacoes: false }));
              }
            }}
            className={`flex cursor-pointer items-center gap-4 rounded-xl border-[3px] p-4 transition-all shadow-sm ${
              step5Errors.orientacoes
                ? 'border-red-500 bg-red-50 ring-1 ring-red-200'
                : orientacoes
                  ? 'border-[#00a88e] bg-[#e6f7f5]'
                  : 'border-[#00a88e]/25 bg-white hover:bg-[#f8fbfb]'
            }`}
          >
            {orientacoes ? (
              <CheckSquare className="h-6 w-6 shrink-0 text-[#00a88e]" strokeWidth={2.5} />
            ) : (
              <Square className="h-6 w-6 shrink-0 text-[#00a88e]/40" strokeWidth={2.5} />
            )}
            <BookOpen className="h-4 w-4 shrink-0 text-[#64748b]" strokeWidth={2.5} aria-hidden />
            <span className={`text-[14px] font-bold ${orientacoes ? 'text-[#0f766e]' : 'text-[#475569]'}`}>
              Recebi e compreendi as orientações pós-procedimento
            </span>
          </div>

          <div
            role="button"
            tabIndex={0}
            onClick={() => {
              setSatisfacao(!satisfacao);
              setStep5Errors((prev) => ({ ...prev, satisfacao: false }));
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                setSatisfacao(!satisfacao);
                setStep5Errors((prev) => ({ ...prev, satisfacao: false }));
              }
            }}
            className={`mt-3 flex cursor-pointer items-center gap-4 rounded-xl border-[3px] p-4 transition-all shadow-sm ${
              step5Errors.satisfacao
                ? 'border-red-500 bg-red-50 ring-1 ring-red-200'
                : satisfacao
                  ? 'border-[#00a88e] bg-[#e6f7f5]'
                  : 'border-[#00a88e]/25 bg-white hover:bg-[#f8fbfb]'
            }`}
          >
            {satisfacao ? (
              <CheckSquare className="h-6 w-6 shrink-0 text-[#00a88e]" strokeWidth={2.5} />
            ) : (
              <Square className="h-6 w-6 shrink-0 text-[#00a88e]/40" strokeWidth={2.5} />
            )}
            <ThumbsUp className="h-4 w-4 shrink-0 text-[#64748b]" strokeWidth={2.5} aria-hidden />
            <span className={`text-[14px] font-bold ${satisfacao ? 'text-[#0f766e]' : 'text-[#475569]'}`}>
              Paciente confirma satisfação com o resultado
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
