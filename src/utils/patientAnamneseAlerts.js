/**
 * Alertas de anamnese (lista de pacientes, card da agenda).
 */
import {
  diaDoInstante,
  hojeDaClinica,
  instanteMs,
  isoDeParts,
  parseDataCalendario,
  ultimoDiaDoMes,
} from './datasClinica.js';

const MESES_LIMITE_ANAMNESE = 6;

function msOuZero(v) {
  const ms = instanteMs(v);
  return Number.isNaN(ms) ? 0 : ms;
}

/** Dia (AAAA-MM-DD) de hoje na clínica menos `months` meses (dia limitado ao fim do mês). */
function limiteMesesAtras(months, fuso, agoraMs) {
  const h = parseDataCalendario(hojeDaClinica(fuso, agoraMs));
  const totalMeses = h.ano * 12 + (h.mes - 1) - months;
  const ano = Math.floor(totalMeses / 12);
  const mes = (totalMeses % 12) + 1;
  return isoDeParts(ano, mes, Math.min(h.dia, ultimoDiaDoMes(ano, mes)));
}

function isOlderThanMonths(iso, months, fuso, agoraMs) {
  const dia = diaDoInstante(iso, fuso);
  if (!dia) return false;
  return dia < limiteMesesAtras(months, fuso, agoraMs);
}

/** ISO da anamnese mais recente em uma lista `anamneseApi.listPaciente`. */
export function latestAnamneseIsoFromList(list) {
  const rows = (Array.isArray(list) ? [...list] : []).filter((r) => r?.dataHora);
  rows.sort((a, b) => msOuZero(b.dataHora) - msOuZero(a.dataHora));
  const latest = rows[0];
  return latest?.dataHora ? String(latest.dataHora) : null;
}

/** Quando o backend enviar ISO da última anamnese no DTO do paciente. */
export function anamneseVencidaFromPatient(p, fuso, agoraMs = Date.now()) {
  const raw = p?.ultimaAnamneseDataHora || p?.ultimaAnamneseEm;
  if (!raw) return false;
  return isOlderThanMonths(raw, MESES_LIMITE_ANAMNESE, fuso, agoraMs);
}

/**
 * Anamnese desatualizada (> 6 meses no calendário da clínica): DTO primeiro, fallback na lista de preenchimentos.
 * @param {object|null|undefined} patient
 * @param {Array|null|undefined} anamneseList
 * @param {string} [fuso] IANA da clínica (ausente → fuso padrão)
 */
export function resolveAnamneseDesatualizada(patient, anamneseList, fuso, agoraMs = Date.now()) {
  if (anamneseVencidaFromPatient(patient, fuso, agoraMs)) return true;
  const fromDto = patient?.ultimaAnamneseDataHora || patient?.ultimaAnamneseEm;
  if (fromDto) return false;
  const latest = latestAnamneseIsoFromList(anamneseList);
  if (!latest) return false;
  return isOlderThanMonths(latest, MESES_LIMITE_ANAMNESE, fuso, agoraMs);
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
