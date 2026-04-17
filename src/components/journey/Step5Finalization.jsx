import React, { useMemo, useRef, useState } from 'react';
import { CheckCircle, Square, CheckSquare, CheckCircle2, BookOpen } from 'lucide-react';
import { useToast } from '../../contexts/useToast.js';
import { toLocalISODate, maxIsoDate, addCalendarYearsToIso } from '../../utils/dateLimits.js';
import {
  sanitizeBirthDateDigits,
  formatBirthDigitsBR,
  validateCalendarDateDigits8,
  calendarDateValidationUserMessage,
} from '../utils/formatters';

const ORIENTACOES_ITENS = [
  'Evite exposição solar direta por 48 horas',
  'Não toque na área tratada nas primeiras 6 horas',
  'Mantenha a pele hidratada',
  'Use protetor solar SPF 50+ nos próximos 7 dias',
  'Evite atividades físicas intensas por 24 horas',
  'Entre em contato conosco em caso de dúvidas ou reações',
];

function isoToBR(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || '').trim());
  if (!m) return '';
  return `${m[3]}/${m[2]}/${m[1]}`;
}

export function Step5Finalization({
  procedureDateIso,
  orientacoes,
  setOrientacoes,
  step5Errors = {},
  setStep5Errors = () => {},
}) {
  const toast = useToast();
  const todayIso = useMemo(() => toLocalISODate(), []);
  const minReturnIso = useMemo(
    () => maxIsoDate(procedureDateIso || todayIso, todayIso),
    [procedureDateIso, todayIso]
  );
  const maxReturnIso = useMemo(() => addCalendarYearsToIso(todayIso, 10), [todayIso]);

  const [returnDateDisplay, setReturnDateDisplay] = useState('');
  const lastRangeToastIsoRef = useRef('');

  const handleReturnDateChange = (raw) => {
    const digits = sanitizeBirthDateDigits(raw);
    const display = formatBirthDigitsBR(digits);
    setReturnDateDisplay(display);

    if (digits.length < 8) {
      lastRangeToastIsoRef.current = '';
      return;
    }

    const cal = validateCalendarDateDigits8(digits);
    if (!cal.ok) {
      lastRangeToastIsoRef.current = '';
      return;
    }

    if (cal.iso < minReturnIso || cal.iso > maxReturnIso) {
      if (lastRangeToastIsoRef.current !== cal.iso) {
        lastRangeToastIsoRef.current = cal.iso;
        toast.error('Data de retorno fora do período permitido.');
      }
      return;
    }

    lastRangeToastIsoRef.current = '';
  };

  const digitsForUi = returnDateDisplay.replace(/\D/g, '');
  let returnDateFieldMessage = null;
  if (digitsForUi.length === 8) {
    const cal = validateCalendarDateDigits8(digitsForUi);
    if (!cal.ok) {
      returnDateFieldMessage = calendarDateValidationUserMessage(cal.reason);
    } else if (cal.iso < minReturnIso || cal.iso > maxReturnIso) {
      returnDateFieldMessage = `A data deve estar entre ${isoToBR(minReturnIso)} e ${isoToBR(maxReturnIso)}.`;
    }
  }

  const returnDateInputInvalid = Boolean(returnDateFieldMessage);

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
          step5Errors.orientacoes ? 'border-red-300' : 'border-[#00a88e]/25'
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
            type="text"
            inputMode="numeric"
            autoComplete="off"
            value={returnDateDisplay}
            onChange={(e) => handleReturnDateChange(e.target.value)}
            placeholder="DD/MM/AAAA"
            maxLength={10}
            className={`w-full max-w-xs rounded-xl border-[3px] bg-[#f8fbfb] px-4 py-3 text-[14px] font-medium text-[#0f172a] outline-none transition-all focus:ring-4 focus:ring-[#00a88e]/20 ${
              returnDateInputInvalid
                ? 'border-red-400 bg-red-50'
                : 'border-[#00a88e]/25 focus:border-[#00a88e]'
            }`}
          />
          <p className="text-[12px] font-medium text-[#64748b]">
            Entre {isoToBR(minReturnIso)} e {isoToBR(maxReturnIso)}.
          </p>
          {returnDateFieldMessage ? (
            <p className="text-[12px] font-bold text-red-600" role="alert">
              {returnDateFieldMessage}
            </p>
          ) : null}
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
        </div>
      </div>
    </div>
  );
}
