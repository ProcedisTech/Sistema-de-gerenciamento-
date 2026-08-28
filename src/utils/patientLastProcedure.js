import {
  formatCartaoDiaPtBr,
  latestProcedureOccurredInstantIso,
  patientUltimaVisitaDayFromDto,
} from './patientProfileDerivedDates.js';

export function lastProcedureLabel(p) {
  const procs = Array.isArray(p?.procedures) ? p.procedures : [];
  if (!procs.length) return '—';
  const sorted = [...procs].sort((a, b) => {
    const ia = latestProcedureOccurredInstantIso([a]);
    const ib = latestProcedureOccurredInstantIso([b]);
    const ta = ia ? new Date(ia).getTime() : 0;
    const tb = ib ? new Date(ib).getTime() : 0;
    return tb - ta;
  });
  const last = sorted[0] || procs[procs.length - 1];
  const n = last?.nome || last?.nomeProcedimento;
  return n ? String(n) : '—';
}

/** Data no rodapé: reflete a data mais recente entre ultimaVinda do DTO e lista de procedimentos. */
export function lastProcedureDateForCard(p) {
  const isoFromProcs = latestProcedureOccurredInstantIso(p?.procedures || []);
  const dtProcs = isoFromProcs ? new Date(isoFromProcs).getTime() : 0;
  const dtUltima = p?.ultimaVinda ? new Date(p.ultimaVinda).getTime() : 0;

  if (dtProcs > 0 && dtProcs >= dtUltima) {
    return formatCartaoDiaPtBr(isoFromProcs);
  }
  const primary = patientUltimaVisitaDayFromDto(p);
  if (primary !== '-') return primary;
  return isoFromProcs ? formatCartaoDiaPtBr(isoFromProcs) : '—';
}
