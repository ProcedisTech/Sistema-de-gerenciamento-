import { toLocalISODate, maxIsoDate, addCalendarYearsToIso } from './dateLimits.js';
import {
  sanitizeBirthDateDigits,
  validateCalendarDateDigits8,
  calendarDateValidationUserMessage,
} from '../components/utils/formatters.js';

function isoToBR(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || '').trim());
  if (!m) return '';
  return `${m[3]}/${m[2]}/${m[1]}`;
}

/**
 * Avalia o campo "próximo retorno" da etapa 5 (DD/MM/AAAA opcional).
 * @param {string | null | undefined} procedureDateIso YYYY-MM-DD
 * @param {string | null | undefined} displayValue texto do input (com ou sem máscara)
 * @returns {{ blocksFinish: boolean, fieldMessage: string | null, validIso: string | null }}
 */
export function evaluateProximoRetornoStep5(procedureDateIso, displayValue) {
  const todayIso = toLocalISODate();
  const minReturnIso = maxIsoDate(procedureDateIso || todayIso, todayIso);
  const maxReturnIso = addCalendarYearsToIso(todayIso, 10);

  const digits = sanitizeBirthDateDigits(displayValue);
  if (digits.length === 0) {
    return { blocksFinish: false, fieldMessage: null, validIso: null };
  }
  if (digits.length < 8) {
    return {
      blocksFinish: true,
      fieldMessage: calendarDateValidationUserMessage('incomplete'),
      validIso: null,
    };
  }

  const cal = validateCalendarDateDigits8(digits);
  if (!cal.ok) {
    return {
      blocksFinish: true,
      fieldMessage: calendarDateValidationUserMessage(cal.reason),
      validIso: null,
    };
  }

  if (cal.iso < minReturnIso || cal.iso > maxReturnIso) {
    return {
      blocksFinish: true,
      fieldMessage: `A data deve estar entre ${isoToBR(minReturnIso)} e ${isoToBR(maxReturnIso)}.`,
      validIso: null,
    };
  }

  return { blocksFinish: false, fieldMessage: null, validIso: cal.iso };
}
