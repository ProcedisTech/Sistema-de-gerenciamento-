/**
 * Módulo único de datas do app: tudo que decide ou exibe dia/hora passa por aqui.
 *
 * - INSTANTE (quando algo aconteceu): string ISO com "Z" ou offset, vinda do backend.
 *   Exibir com `formatarInstante(iso, fuso, estilo)`; extrair o dia com `diaDoInstante`.
 * - CALENDÁRIO: "AAAA-MM-DD", "HH:mm[:ss]" ou "AAAA-MM-DDTHH:mm:ss" sem fuso (horário da clínica).
 *   Parse e formatação manuais — nunca `new Date('AAAA-MM-DD')` (vira UTC e mostra o dia anterior).
 * - HOJE/AGORA: sempre no fuso da clínica (`hojeDaClinica`, `agoraDaClinica`).
 */

/** Fuso usado quando a clínica não tem UF (mesmo padrão do backend). */
export const FUSO_PADRAO = 'America/Sao_Paulo';

const RE_INSTANTE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:?\d{2})$/i;
const RE_DATA = /^(\d{4})-(\d{2})-(\d{2})$/;
const RE_DATA_HORA_CAL = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?$/;
const RE_DATA_BR = /^(\d{2})\/(\d{2})\/(\d{4})$/;
const RE_HORA = /^(\d{1,2}):(\d{2})(?::(\d{2}))?/;

const DIA_SEMANA = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

const ESTILOS_INSTANTE = {
  data: { day: '2-digit', month: '2-digit', year: 'numeric' },
  dataHora: { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' },
  dataHoraSeg: {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit',
  },
  hora: { hour: '2-digit', minute: '2-digit' },
  horaSeg: { hour: '2-digit', minute: '2-digit', second: '2-digit' },
  diaMes: { day: '2-digit', month: '2-digit' },
  mesAno: { month: 'long', year: 'numeric' },
  dataLonga: { day: 'numeric', month: 'long', year: 'numeric' },
};

const formatterCache = new Map();

function avisarDev(msg, valor) {
  if (import.meta.env?.DEV && import.meta.env?.MODE !== 'test') {
    console.warn(`[datasClinica] ${msg}`, valor);
  }
}

/** Fuso IANA válido; inválido ou vazio → FUSO_PADRAO (único fallback do app). */
export function fusoValido(fuso) {
  if (!fuso || typeof fuso !== 'string') {
    avisarDev('fuso ausente, usando o padrão', fuso);
    return FUSO_PADRAO;
  }
  try {
    obterFormatter('en-US', { timeZone: fuso, year: 'numeric' });
    return fuso;
  } catch {
    avisarDev('fuso inválido, usando o padrão', fuso);
    return FUSO_PADRAO;
  }
}

function obterFormatter(locale, opts) {
  const chave = `${locale}|${JSON.stringify(opts)}`;
  let f = formatterCache.get(chave);
  if (!f) {
    f = new Intl.DateTimeFormat(locale, opts);
    formatterCache.set(chave, f);
  }
  return f;
}

function pad2(n) {
  return String(n).padStart(2, '0');
}

/** Partes do relógio de parede no fuso dado para um instante em ms. */
function partesNoFuso(fuso, ms) {
  const f = obterFormatter('en-US', {
    timeZone: fusoValido(fuso),
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    weekday: 'short',
    hourCycle: 'h23',
  });
  const p = {};
  for (const part of f.formatToParts(ms)) p[part.type] = part.value;
  const hora = Number(p.hour) % 24;
  return {
    ano: Number(p.year),
    mes: Number(p.month),
    dia: Number(p.day),
    hora,
    minuto: Number(p.minute),
    segundo: Number(p.second),
    diaSemana: DIA_SEMANA[p.weekday] ?? 0,
  };
}

// ---------------------------------------------------------------------------
// HOJE / AGORA
// ---------------------------------------------------------------------------

/** "AAAA-MM-DD" de hoje no fuso da clínica. */
export function hojeDaClinica(fuso, agoraMs = Date.now()) {
  const p = partesNoFuso(fuso, agoraMs);
  return `${p.ano}-${pad2(p.mes)}-${pad2(p.dia)}`;
}

/**
 * Data e hora de agora no fuso da clínica.
 * @returns {{ dataIso: string, hhmm: string, minutos: number, diaSemana: number, ano: number, mes: number, dia: number, hora: number, minuto: number, segundo: number, ms: number }}
 */
export function agoraDaClinica(fuso, agoraMs = Date.now()) {
  const p = partesNoFuso(fuso, agoraMs);
  return {
    ...p,
    dataIso: `${p.ano}-${pad2(p.mes)}-${pad2(p.dia)}`,
    hhmm: `${pad2(p.hora)}:${pad2(p.minuto)}`,
    minutos: p.hora * 60 + p.minuto,
    ms: agoraMs,
  };
}

/** "AAAA-MM-DDTHH:mm" de agora na clínica — comparável por string com datas+horas de calendário. */
export function agoraCalendarioDaClinica(fuso, agoraMs = Date.now()) {
  const a = agoraDaClinica(fuso, agoraMs);
  return `${a.dataIso}T${a.hhmm}`;
}

/** Deslocamento (ms) do fuso no instante dado: relógio de parede − UTC. */
function deslocamentoNoFuso(fuso, ms) {
  const p = partesNoFuso(fuso, ms);
  const paredeMs = Date.UTC(p.ano, p.mes - 1, p.dia, p.hora, p.minuto, p.segundo);
  return paredeMs - (ms - (((ms % 1000) + 1000) % 1000));
}

/**
 * Instante (ms) em que o relógio da clínica marca `dataIso` + `hhmm`, com o deslocamento do fuso
 * naquela data (horário de verão incluído). Horário inexistente (lacuna do horário de verão)
 * avança para depois da lacuna; horário repetido usa a primeira ocorrência.
 * @param {string} dataIso "AAAA-MM-DD"
 * @param {string} hhmm "HH:mm[:ss]"
 * @param {string} fuso IANA
 * @returns {number} NaN se data ou hora forem inválidas
 */
export function instanteDoHorarioDaClinica(dataIso, hhmm, fuso) {
  const d = parseDataCalendario(dataIso);
  const minutos = minutosDaHora(hhmm);
  if (!d || Number.isNaN(minutos)) return NaN;
  const zona = fusoValido(fuso);
  const palpite = Date.UTC(d.ano, d.mes - 1, d.dia, Math.floor(minutos / 60), minutos % 60);
  const desl1 = deslocamentoNoFuso(zona, palpite);
  const cand1 = palpite - desl1;
  const desl2 = deslocamentoNoFuso(zona, cand1);
  if (desl2 === desl1) return cand1;
  const cand2 = palpite - desl2;
  if (deslocamentoNoFuso(zona, cand2) === desl2) return cand2;
  return Math.max(cand1, cand2);
}

// ---------------------------------------------------------------------------
// INSTANTES
// ---------------------------------------------------------------------------

/** true para string ISO com "Z" ou offset explícito. */
export function ehInstante(valor) {
  return typeof valor === 'string' && RE_INSTANTE.test(valor.trim());
}

/** ms de um instante (string com fuso, Date ou número); NaN se não for instante. */
export function instanteMs(valor) {
  if (valor == null || valor === '') return NaN;
  if (valor instanceof Date) return valor.getTime();
  if (typeof valor === 'number') return Number.isFinite(valor) ? valor : NaN;
  const s = String(valor).trim();
  if (!RE_INSTANTE.test(s)) return NaN;
  return Date.parse(s);
}

/**
 * Formata um instante no fuso da clínica.
 * @param {string|Date|number} valor ISO com "Z"/offset (strings sem fuso são rejeitadas)
 * @param {string} fuso IANA
 * @param {keyof ESTILOS_INSTANTE | Intl.DateTimeFormatOptions} [estilo]
 * @returns {string} '' quando o valor não é um instante válido
 */
export function formatarInstante(valor, fuso, estilo = 'dataHora') {
  const ms = instanteMs(valor);
  if (Number.isNaN(ms)) {
    if (valor != null && valor !== '') avisarDev('instante sem fuso ou inválido', valor);
    return '';
  }
  const opts = typeof estilo === 'string' ? ESTILOS_INSTANTE[estilo] ?? ESTILOS_INSTANTE.dataHora : estilo;
  return obterFormatter('pt-BR', { ...opts, timeZone: fusoValido(fuso) }).format(ms);
}

/** "AAAA-MM-DD" do dia em que o instante aconteceu, no fuso da clínica ('' se inválido). */
export function diaDoInstante(valor, fuso) {
  const ms = instanteMs(valor);
  if (Number.isNaN(ms)) {
    if (valor != null && valor !== '') avisarDev('instante sem fuso ou inválido', valor);
    return '';
  }
  return hojeDaClinica(fuso, ms);
}

// ---------------------------------------------------------------------------
// CALENDÁRIO
// ---------------------------------------------------------------------------

export function ehBissexto(ano) {
  return (ano % 4 === 0 && ano % 100 !== 0) || ano % 400 === 0;
}

export function ultimoDiaDoMes(ano, mes) {
  if (mes === 2) return ehBissexto(ano) ? 29 : 28;
  return [4, 6, 9, 11].includes(mes) ? 30 : 31;
}

export function isoDeParts(ano, mes, dia) {
  return `${String(ano).padStart(4, '0')}-${pad2(mes)}-${pad2(dia)}`;
}

function partesValidas(ano, mes, dia) {
  return ano > 0 && mes >= 1 && mes <= 12 && dia >= 1 && dia <= ultimoDiaDoMes(ano, mes);
}

/**
 * Lê uma data de calendário: "AAAA-MM-DD", "AAAA-MM-DDTHH:mm[:ss]" (sem fuso) ou "DD/MM/AAAA".
 * Instantes (com "Z"/offset) são rejeitados — use `diaDoInstante`.
 * @returns {{ ano: number, mes: number, dia: number } | null}
 */
export function parseDataCalendario(valor) {
  if (valor == null || valor === '') return null;
  const s = String(valor).trim();
  if (RE_INSTANTE.test(s)) {
    avisarDev('parseDataCalendario recebeu um instante; use diaDoInstante', s);
    return null;
  }
  let m = RE_DATA.exec(s) || RE_DATA_HORA_CAL.exec(s);
  if (m) {
    const ano = Number(m[1]);
    const mes = Number(m[2]);
    const dia = Number(m[3]);
    return partesValidas(ano, mes, dia) ? { ano, mes, dia } : null;
  }
  m = RE_DATA_BR.exec(s);
  if (m) {
    const ano = Number(m[3]);
    const mes = Number(m[2]);
    const dia = Number(m[1]);
    return partesValidas(ano, mes, dia) ? { ano, mes, dia } : null;
  }
  return null;
}

/** Normaliza para "AAAA-MM-DD" ('' se inválida). */
export function normalizarDataCalendario(valor) {
  const p = parseDataCalendario(valor);
  return p ? isoDeParts(p.ano, p.mes, p.dia) : '';
}

/**
 * Lê data+hora de calendário da clínica ("AAAA-MM-DDTHH:mm[:ss]", sem fuso).
 * @returns {{ dataIso: string, hhmm: string, minutos: number, ano: number, mes: number, dia: number, hora: number, minuto: number } | null}
 */
export function parseDataHoraCalendario(valor) {
  if (valor == null || valor === '') return null;
  const s = String(valor).trim();
  if (RE_INSTANTE.test(s)) {
    avisarDev('parseDataHoraCalendario recebeu um instante', s);
    return null;
  }
  const m = RE_DATA_HORA_CAL.exec(s);
  if (!m) return null;
  const ano = Number(m[1]);
  const mes = Number(m[2]);
  const dia = Number(m[3]);
  const hora = Number(m[4]);
  const minuto = Number(m[5]);
  if (!partesValidas(ano, mes, dia) || hora > 23 || minuto > 59) return null;
  return {
    ano, mes, dia, hora, minuto,
    dataIso: isoDeParts(ano, mes, dia),
    hhmm: `${pad2(hora)}:${pad2(minuto)}`,
    minutos: hora * 60 + minuto,
  };
}

/** Minutos do dia de uma hora de calendário "HH:mm[:ss]" (NaN se inválida). */
export function minutosDaHora(hhmm) {
  const m = RE_HORA.exec(String(hhmm ?? '').trim());
  if (!m) return NaN;
  const h = Number(m[1]);
  const mi = Number(m[2]);
  if (h > 23 || mi > 59) return NaN;
  return h * 60 + mi;
}

function msUtcDeCalendario(p) {
  return Date.UTC(p.ano, p.mes - 1, p.dia);
}

/**
 * Formata uma data de calendário sem passar por fuso.
 * @param {string} valor "AAAA-MM-DD" (ou equivalente aceito por parseDataCalendario)
 * @param {'curta'|'diaMes'|'longa'|'mesAno'|Intl.DateTimeFormatOptions} [estilo]
 */
export function formatarDataCalendario(valor, estilo = 'curta') {
  const p = parseDataCalendario(valor);
  if (!p) return '';
  if (estilo === 'curta') return `${pad2(p.dia)}/${pad2(p.mes)}/${p.ano}`;
  if (estilo === 'diaMes') return `${pad2(p.dia)}/${pad2(p.mes)}`;
  let opts = estilo;
  if (estilo === 'longa') opts = { day: 'numeric', month: 'long', year: 'numeric' };
  if (estilo === 'mesAno') opts = { month: 'long', year: 'numeric' };
  if (typeof opts !== 'object' || opts == null) return `${pad2(p.dia)}/${pad2(p.mes)}/${p.ano}`;
  return obterFormatter('pt-BR', { ...opts, timeZone: 'UTC' }).format(msUtcDeCalendario(p));
}

/** Soma (ou subtrai) dias a uma data de calendário. */
export function somarDias(valor, dias) {
  const p = parseDataCalendario(valor);
  if (!p) return '';
  const d = new Date(msUtcDeCalendario(p) + dias * 86400000);
  return isoDeParts(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
}

/** Dia da semana (0 = domingo) de uma data de calendário; NaN se inválida. */
export function diaDaSemana(valor) {
  const p = parseDataCalendario(valor);
  if (!p) return NaN;
  return new Date(msUtcDeCalendario(p)).getUTCDay();
}

/** Diferença em dias (b − a) entre duas datas de calendário; NaN se inválidas. */
export function diferencaDias(a, b) {
  const pa = parseDataCalendario(a);
  const pb = parseDataCalendario(b);
  if (!pa || !pb) return NaN;
  return Math.round((msUtcDeCalendario(pb) - msUtcDeCalendario(pa)) / 86400000);
}

/** -1, 0 ou 1 comparando duas datas de calendário (inválidas vão para o fim). */
export function compararCalendario(a, b) {
  const na = normalizarDataCalendario(a);
  const nb = normalizarDataCalendario(b);
  if (!na && !nb) return 0;
  if (!na) return 1;
  if (!nb) return -1;
  return na < nb ? -1 : na > nb ? 1 : 0;
}

// ---------------------------------------------------------------------------
// ANIVERSÁRIO E IDADE (implementação única)
// ---------------------------------------------------------------------------

/** Dia em que o aniversário é comemorado no ano dado (29/02 → 28/02 em ano não bissexto). */
export function aniversarioNoAno(mes, dia, ano) {
  const d = mes === 2 && dia === 29 && !ehBissexto(ano) ? 28 : dia;
  return isoDeParts(ano, mes, d);
}

/**
 * Idade completa em `hojeIso` (calendário da clínica). Nascido em 29/02 faz aniversário em 28/02
 * nos anos não bissextos, igual ao backend.
 * @returns {number | null}
 */
export function idadeEm(nascimento, hojeIso) {
  const n = parseDataCalendario(nascimento);
  const h = parseDataCalendario(hojeIso);
  if (!n || !h) return null;
  const anivEsteAno = aniversarioNoAno(n.mes, n.dia, h.ano);
  const hoje = isoDeParts(h.ano, h.mes, h.dia);
  const idade = h.ano - n.ano - (hoje < anivEsteAno ? 1 : 0);
  return idade < 0 ? null : idade;
}

/**
 * Próximo aniversário a partir de `hojeIso` (inclusive).
 * @returns {{ dataIso: string, dias: number, ehHoje: boolean, idadeQueCompleta: number, mes: number, dia: number } | null}
 */
export function proximoAniversario(nascimento, hojeIso) {
  const n = parseDataCalendario(nascimento);
  const h = parseDataCalendario(hojeIso);
  if (!n || !h) return null;
  const hoje = isoDeParts(h.ano, h.mes, h.dia);
  let ano = h.ano;
  let dataIso = aniversarioNoAno(n.mes, n.dia, ano);
  if (dataIso < hoje) {
    ano += 1;
    dataIso = aniversarioNoAno(n.mes, n.dia, ano);
  }
  const dias = diferencaDias(hoje, dataIso);
  return {
    dataIso,
    dias,
    ehHoje: dias === 0,
    idadeQueCompleta: ano - n.ano,
    mes: n.mes,
    dia: n.dia,
  };
}
