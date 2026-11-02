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

/**
 * Regra Clínica: Um retorno nunca pode ser selecionado como procedimento raiz de outro retorno.
 */
export function ehProcedimentoRetorno(item) {
  if (!item || typeof item !== 'object') return false;
  if (
    item.isRetoque === true ||
    item.isRetorno === true ||
    Boolean(item.procedimentoFeitoOrigemId) ||
    String(item.tipoProcedimentoCodigo || '').trim().toLowerCase() === 'retorno'
  ) {
    return true;
  }
  const nome = String(
    item.procedimentoNome || item.nomeProcedimento || item.nome || item.catalogoNome || '',
  ).trim();
  return /^Retorno(\s*[·:—-]|\s+de\s+|\s*$)/i.test(nome);
}

export function filtrarProcedimentosRaiz(options = [], query = '', fuso) {
  const q = String(query || '').trim().toLowerCase();
  const validos = (options || []).filter((r) => !ehProcedimentoRetorno(r));
  if (!q) return validos;
  return validos.filter((r) => {
    const nome = nomeProcedimentoRaiz(r).toLowerCase();
    const dataFmt = formatProcedimentoRaizData(r.data, fuso).toLowerCase();
    const plano = String(r.planoTitulo || '').toLowerCase();
    return nome.includes(q) || dataFmt.includes(q) || plano.includes(q);
  });
}
