import { ehInstante, formatarDataCalendario, formatarInstante } from '../../utils/datasClinica.js';

/**
 * Data de um procedimento raiz: instante (histórico, `horaInicio` com "Z") no fuso da clínica,
 * ou data de calendário (`dataAgendamento`/`dataPlanejada` do plano) sem passar por fuso.
 */
export function formatProcedimentoRaizData(dataRaw, fuso) {
  if (!dataRaw) return '—';
  const texto = ehInstante(dataRaw)
    ? formatarInstante(dataRaw, fuso, 'data')
    : formatarDataCalendario(dataRaw, 'curta');
  return texto || '—';
}

export function nomeProcedimentoRaiz(item) {
  return item?.catalogoProcedimentoNome || item?.catalogoNome || item?.nome || 'Procedimento';
}

export function filtrarProcedimentosRaiz(options = [], query = '', fuso) {
  const q = String(query || '').trim().toLowerCase();
  if (!q) return options;
  return options.filter((r) => {
    const nome = nomeProcedimentoRaiz(r).toLowerCase();
    const dataFmt = formatProcedimentoRaizData(r.data, fuso).toLowerCase();
    const plano = String(r.planoTitulo || '').toLowerCase();
    return nome.includes(q) || dataFmt.includes(q) || plano.includes(q);
  });
}
