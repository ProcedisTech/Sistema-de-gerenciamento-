export const ORDEM_CATEGORIAS = ['antes', 'planejamento', 'avaliacao', 'depois', 'outro'];

export const GALERIA_CATEGORIA_BADGE_CLASS = {
  antes: 'bg-[#fffbeb] text-[#b45309] border-[#fcd34d]/60',
  planejamento: 'bg-[#eef2ff] text-[#4338ca] border-[#c7d2fe]/60',
  avaliacao: 'bg-[#f0f9ff] text-[#0369a1] border-[#bae6fd]/60',
  depois: 'bg-[#f0fdf4] text-[#15803d] border-[#bbf7d0]/60',
  outro: 'bg-[#f8fafc] text-[#64748b] border-[#e2e8f0]',
};

export const GALERIA_INLINE_PREVIEW_LIMIT = 4;

/** Aberta se: total de fotos > 8 OU categorias com fotos > 2 */
export function shouldGaleriaSessionStartExpanded(sess) {
  if (!sess?.fotos?.length) return false;
  const cats = new Set(sess.fotos.map((f) => f.categoria || 'outro'));
  return sess.fotos.length > 8 || cats.size > 2;
}

export function groupFotosByCategoria(fotos) {
  const byCat = {};
  (fotos || []).forEach((foto) => {
    const cat = foto.categoria || 'outro';
    if (!byCat[cat]) byCat[cat] = [];
    byCat[cat].push(foto);
  });
  return byCat;
}

export function formatMesAnoSessao(isoDate) {
  if (!isoDate || isoDate === 'sem-data') return 'Data desconhecida';
  const [year, month] = isoDate.split('-');
  const meses = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
  return `${meses[parseInt(month, 10) - 1]}/${year}`;
}
