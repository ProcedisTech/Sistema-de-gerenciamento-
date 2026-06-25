const SIMETRIA_OPTS = [
  { value: 'sim', label: 'Simétrico' },
  { value: 'leve', label: 'Assimetria leve' },
  { value: 'moderada', label: 'Assimetria moderada' },
  { value: 'na', label: 'N/A' },
];

const DOR_OPTS = [
  { value: 0, label: 'Sem dor' },
  { value: 3, label: 'Leve' },
  { value: 6, label: 'Moderada' },
  { value: 9, label: 'Intensa' },
];

export function formatRetornoAvaliacaoTexto(av) {
  if (!av || typeof av !== 'object') return '';
  const parts = [];
  if (av.satisfacao != null) parts.push(`Satisfação: ${av.satisfacao}/5`);
  if (av.simetria) {
    const simLabel = SIMETRIA_OPTS.find((o) => o.value === av.simetria)?.label || av.simetria;
    parts.push(`Simetria: ${simLabel}`);
  }
  if (av.dor != null) {
    const dorLabel = DOR_OPTS.find((o) => o.value === av.dor)?.label || av.dor;
    parts.push(`Dor: ${dorLabel}`);
  }
  return parts.length ? `[Retorno] ${parts.join(' · ')}` : '';
}
