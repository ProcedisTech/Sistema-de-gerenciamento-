export function resolveStatusCodigo(entry) {
  if (!entry) return '';
  if (typeof entry.status === 'string') return entry.status;
  return entry.status?.codigo ?? entry.statusCodigo ?? '';
}

export function resolveFichaTemplateIdFromEntry(entry) {
  const v = entry?.anamneseId ?? entry?.fichaId ?? entry?.anamneseFichaId;
  return v != null && v !== '' ? String(v) : null;
}

export function historicoEntryMatchesFichaId(entry, fichaId) {
  const eid = resolveFichaTemplateIdFromEntry(entry);
  return eid != null && eid === String(fichaId);
}

export function historicoTimestamp(entry) {
  const raw = entry.dataHora ?? entry.dataPreenchimento ?? entry.createdAt ?? entry.dataCriacao ?? null;
  const t = raw ? new Date(raw).getTime() : 0;
  return Number.isFinite(t) ? t : 0;
}

/**
 * Pedido em branco do paciente: preenchido pelo paciente, não finalizado e com contagem numérica 0.
 * Contagem ausente/null/não numérica => não é em branco (na dúvida, nunca esconder).
 */
export function isPreenchimentoEmBrancoDoPaciente(entry) {
  if (entry?.preenchidoPorPaciente !== true) return false;
  if (resolveStatusCodigo(entry).toLowerCase() === 'finalizada') return false;
  const q = entry?.quantidadeRespostas;
  return typeof q === 'number' && Number.isFinite(q) && q === 0;
}

function semPreenchimentosEmBranco(lista) {
  return Array.isArray(lista) ? lista.filter((h) => !isPreenchimentoEmBrancoDoPaciente(h)) : [];
}

/** Mais recente de cada ficha, ordenado do mais novo para o mais antigo. */
export function resumirPreenchimentosPorFicha(lista, fichas = []) {
  const exibiveis = semPreenchimentosEmBranco(lista);
  if (exibiveis.length === 0) return [];
  const ultimoPorFicha = new Map();
  for (const h of exibiveis) {
    const fid = resolveFichaTemplateIdFromEntry(h);
    if (!fid) continue;
    const prev = ultimoPorFicha.get(fid);
    if (!prev || historicoTimestamp(h) >= historicoTimestamp(prev)) {
      ultimoPorFicha.set(fid, h);
    }
  }
  const rows = Array.from(ultimoPorFicha.entries()).map(([fichaId, ultimo]) => {
    const f = (fichas || []).find((x) => String(x.id) === fichaId);
    const nome =
      f?.nome
      ?? ultimo.anamneseNome
      ?? ultimo.fichaNome
      ?? ultimo.nomeFicha
      ?? ultimo.nome
      ?? 'Ficha de anamnese';
    const dataHora =
      ultimo.dataHora
      ?? ultimo.dataPreenchimento
      ?? ultimo.createdAt
      ?? ultimo.dataCriacao
      ?? null;
    return { fichaId, nome, dataHora, ultimo };
  });
  rows.sort((a, b) => historicoTimestamp(b.ultimo) - historicoTimestamp(a.ultimo));
  return rows;
}

export function escolherPreenchimentoDaFicha(lista, fichaId) {
  const candidatos = semPreenchimentosEmBranco(lista).filter((h) => historicoEntryMatchesFichaId(h, fichaId));
  return [...candidatos].sort((a, b) => historicoTimestamp(b) - historicoTimestamp(a))[0];
}
