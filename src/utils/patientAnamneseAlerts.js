/**
 * Alertas de anamnese (lista de pacientes, card da agenda).
 */

const MESES_LIMITE_ANAMNESE = 6;

/** ISO da anamnese mais recente em uma lista `anamneseApi.listPaciente`. */
export function latestAnamneseIsoFromList(list) {
  const rows = (Array.isArray(list) ? [...list] : []).filter((r) => r?.dataHora);
  rows.sort((a, b) => {
    const ta = new Date(a.dataHora).getTime();
    const tb = new Date(b.dataHora).getTime();
    return tb - ta;
  });
  const latest = rows[0];
  return latest?.dataHora ? String(latest.dataHora) : null;
}

/** Quando o backend enviar ISO da última anamnese no DTO do paciente. */
export function anamneseVencidaFromPatient(p) {
  const raw = p?.ultimaAnamneseDataHora || p?.ultimaAnamneseEm;
  if (!raw) return false;
  const t = new Date(raw);
  if (Number.isNaN(t.getTime())) return false;
  const lim = new Date();
  lim.setMonth(lim.getMonth() - MESES_LIMITE_ANAMNESE);
  return t < lim;
}

function isOlderThanMonths(iso, months) {
  const t = new Date(iso);
  if (Number.isNaN(t.getTime())) return false;
  const lim = new Date();
  lim.setMonth(lim.getMonth() - months);
  return t < lim;
}

/**
 * Anamnese desatualizada (> 6 meses): DTO primeiro, fallback na lista de preenchimentos.
 * @param {object|null|undefined} patient
 * @param {Array|null|undefined} anamneseList
 */
export function resolveAnamneseDesatualizada(patient, anamneseList) {
  if (anamneseVencidaFromPatient(patient)) return true;
  const fromDto = patient?.ultimaAnamneseDataHora || patient?.ultimaAnamneseEm;
  if (fromDto) return false;
  const latest = latestAnamneseIsoFromList(anamneseList);
  if (!latest) return false;
  return isOlderThanMonths(latest, MESES_LIMITE_ANAMNESE);
}

/**
 * Pendência de ficha: lista ao vivo ganha do DTO da listagem (que fica stale no pin da consulta).
 * Mesma regra do backend: novo sem preenchimento. Se já há preenchimento, nunca é pendente.
 */
export function resolveAnamnesePendente(patient, anamneseList) {
  const n = Array.isArray(anamneseList) ? anamneseList.length : 0;
  if (n > 0) return false;
  return patient?.ehNovo === true || patient?.anamnesePendente === true;
}
