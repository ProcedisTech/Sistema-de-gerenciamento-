import {
  formatCartaoDiaPtBr,
  latestProcedureOccurredInstantIso,
  patientUltimaVisitaDayFromDto,
} from './patientProfileDerivedDates.js';
import { instanteMs } from './datasClinica.js';

function msOuZero(iso) {
  const ms = instanteMs(iso);
  return Number.isNaN(ms) ? 0 : ms;
}

export function lastProcedureLabel(p) {
  const procs = Array.isArray(p?.procedures) ? p.procedures : [];
  if (!procs.length) return '—';
  const sorted = [...procs].sort((a, b) => {
    const ta = msOuZero(latestProcedureOccurredInstantIso([a]));
    const tb = msOuZero(latestProcedureOccurredInstantIso([b]));
    return tb - ta;
  });
  const last = sorted[0] || procs[procs.length - 1];
  const n = last?.nome || last?.nomeProcedimento;
  return n ? String(n) : '—';
}

/**
 * Data no rodapé: reflete a data mais recente entre ultimaVinda do DTO e lista de procedimentos.
 * @param {object} p paciente mapeado
 * @param {string} fuso IANA da clínica
 */
export function lastProcedureDateForCard(p, fuso) {
  const isoFromProcs = latestProcedureOccurredInstantIso(p?.procedures || []);
  const dtProcs = msOuZero(isoFromProcs);
  const dtUltima = msOuZero(p?.ultimaVinda);

  if (dtProcs > 0 && dtProcs >= dtUltima) {
    return formatCartaoDiaPtBr(isoFromProcs, fuso);
  }
  const primary = patientUltimaVisitaDayFromDto(p, fuso);
  if (primary !== '-') return primary;
  return isoFromProcs ? formatCartaoDiaPtBr(isoFromProcs, fuso) : '—';
}
