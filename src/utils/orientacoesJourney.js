export function newOrientacaoId() {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  } catch {
    /* ignore */
  }
  return `tmp-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

/** Normaliza resposta do GET template (array ou objeto com `itens`). */
export function normalizeOrientacoesTemplateResponse(raw) {
  if (!raw) return [];
  const list = Array.isArray(raw) ? raw : raw.itens || raw.items || raw.orientacoes || [];
  return list
    .map((row, idx) => ({
      id: newOrientacaoId(),
      descricao: String(row.descricao ?? row.texto ?? row.nome ?? '').trim(),
      ordem: Number.isFinite(Number(row.ordem)) ? Number(row.ordem) : idx,
      checado: Boolean(row.checado),
    }))
    .filter((x) => x.descricao);
}

/** Compara listas de orientações pelo par (ordem, descrição), ignorando checado e id. */
export function orientacoesTemplateSignature(itens) {
  if (!Array.isArray(itens)) return '';
  return [...itens]
    .map((i, idx) => ({
      ordem: Number.isFinite(Number(i.ordem)) ? Number(i.ordem) : idx,
      desc: String(i.descricao || '').trim().toLowerCase(),
    }))
    .filter((x) => x.desc)
    .sort((a, b) => a.ordem - b.ordem || a.desc.localeCompare(b.desc))
    .map((x) => `${x.ordem}:${x.desc}`)
    .join('|');
}

/** Dígitos com DDI 55 para wa.me */
export function normalizeWaPhoneDigits(raw) {
  const d = String(raw || '').replace(/\D/g, '');
  if (!d) return '';
  if (d.startsWith('55')) return d;
  return `55${d}`;
}
