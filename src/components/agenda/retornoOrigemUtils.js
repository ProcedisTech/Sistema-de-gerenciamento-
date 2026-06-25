export function formatProcedimentoRaizData(dataRaw) {
  if (!dataRaw) return '—';
  try {
    const d = new Date(dataRaw);
    if (Number.isNaN(d.getTime())) return '—';
    return d.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
  } catch {
    return '—';
  }
}

export function nomeProcedimentoRaiz(item) {
  return item?.catalogoProcedimentoNome || item?.nome || 'Procedimento';
}

export function filtrarProcedimentosRaiz(options = [], query = '') {
  const q = String(query || '').trim().toLowerCase();
  if (!q) return options;
  return options.filter((r) => {
    const nome = nomeProcedimentoRaiz(r).toLowerCase();
    const dataFmt = formatProcedimentoRaizData(r.data).toLowerCase();
    return nome.includes(q) || dataFmt.includes(q);
  });
}
