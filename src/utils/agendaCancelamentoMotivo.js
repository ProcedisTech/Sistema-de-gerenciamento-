const LABELS = {
  paciente_desistiu: 'Paciente desistiu',
  remarcado: 'Remarcado para outra data',
  clinica_fechou: 'Clínica fechou',
  outro: 'Outro',
};

export function labelMotivoCancelamentoCodigo(codigo) {
  if (codigo == null || codigo === '') return '';
  const key = String(codigo).trim();
  return LABELS[key] || LABELS.outro;
}

/**
 * @param {{ motivoCancelamentoCodigo?: string, motivoCancelamentoTexto?: string } | null | undefined} row
 */
export function resolveMotivoCancelamentoFromRow(row) {
  const raw = row?.rawAgendamento || {};
  const codigo =
    row?.motivoCancelamentoCodigo ??
    raw.motivoCancelamentoCodigo ??
    raw.motivo_cancelamento_codigo ??
    null;
  const texto =
    row?.motivoCancelamentoTexto ??
    raw.motivoCancelamentoTexto ??
    raw.motivo_cancelamento_texto ??
    null;
  return { codigo, texto: texto != null && String(texto).trim() ? String(texto).trim() : '' };
}
