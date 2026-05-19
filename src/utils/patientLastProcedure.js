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

/** Data no rodapé: mesma prioridade do cartão Última visita do perfil; fallback ao procedimento mais recente. */
export function lastProcedureDateForCard(p) {
  const primary = patientUltimaVisitaDayFromDto(p);
  if (primary !== '-') return primary;
  const iso = latestProcedureOccurredInstantIso(p?.procedures || []);
  return iso ? formatCartaoDiaPtBr(iso) : '—';
}
