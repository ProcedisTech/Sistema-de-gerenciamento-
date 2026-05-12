/**
 * Resolve motivo de cancelamento exibido na UI a partir da linha do dashboard (Onda 4).
 */
export function resolveMotivoCancelamentoFromRow(row) {
  const raw = row?.rawSlot || row?.rawAgendamento || {};
  const nome =
    row?.motivoCancelamentoNome ??
    raw.motivoCancelamentoNome ??
    raw.motivo_cancelamento_nome ??
    '';
  const codigo =
    row?.motivoCancelamentoCodigo ??
    raw.motivoCancelamentoCodigo ??
    raw.motivo_cancelamento_codigo ??
    null;
  const id =
    row?.motivoCancelamentoId != null
      ? String(row.motivoCancelamentoId)
      : raw.motivoCancelamentoId != null
        ? String(raw.motivoCancelamentoId)
        : '';

  const nomeTrim = nome != null && String(nome).trim() ? String(nome).trim() : '';
  return { id, codigo: codigo != null && String(codigo).trim() !== '' ? String(codigo).trim() : null, nome: nomeTrim };
}

/** Fallback mínimo quando o backend não envia nome (legado). */
export function labelMotivoCancelamentoFallback(codigo) {
  if (codigo == null || codigo === '') return '';
  return String(codigo).trim();
}
