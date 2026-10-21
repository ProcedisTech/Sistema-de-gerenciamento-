/** Status da consulta (tb_atendimento) que contam como "em andamento". Abandonada = normal. */
const STATUS_CONSULTA_EM_ANDAMENTO = ['aberto'];

/**
 * Consulta em andamento ligada às agendas (1 linha ou grupo).
 * @param {Array<{ atendimentoId?: string|null, atendimentoStatusCodigo?: string|null, atendimentoAnfitriaoRoleUserId?: string|null }>} rows
 * @param {string|null|undefined} meuRoleUserId
 * @returns {{ emAndamento: boolean, minha: boolean, atendimentoId: string|null }}
 */
export function getConsultaEmAndamento(rows, meuRoleUserId) {
  const list = Array.isArray(rows) ? rows : [];
  const linha = list.find((r) =>
    STATUS_CONSULTA_EM_ANDAMENTO.includes(String(r?.atendimentoStatusCodigo || '').toLowerCase()),
  );
  if (!linha) return { emAndamento: false, minha: false, atendimentoId: null };
  const anfitriao = linha.atendimentoAnfitriaoRoleUserId != null ? String(linha.atendimentoAnfitriaoRoleUserId) : '';
  const eu = meuRoleUserId != null ? String(meuRoleUserId) : '';
  return {
    emAndamento: true,
    minha: Boolean(eu && anfitriao && anfitriao === eu),
    atendimentoId: linha.atendimentoId != null ? String(linha.atendimentoId) : null,
  };
}

/**
 * Com consulta em andamento: principal 'voltar' só para quem abriu (outra profissional fica sem principal);
 * some com cancelar e reagendar. Sem andamento: devolve as ações como estão + emAndamento:false.
 */
function aplicarAndamento(actions, andamento) {
  if (!andamento?.emAndamento) return { ...actions, emAndamento: false };
  return {
    ...actions,
    primary: andamento.minha ? 'voltar' : null,
    secondary: actions.secondary.filter((a) => a !== 'cancelar' && a !== 'reagendar'),
    emAndamento: true,
    atendimentoId: andamento.atendimentoId ?? null,
  };
}

/**
 * Matriz de ações do Day Rail (Rich card + Next-up).
 * @param {string} status
 * @param {boolean} [canStartAnamnese=true]
 * @param {boolean} [canCancelarAgendamento=true]
 * @param {{ emAndamento: boolean, minha: boolean, atendimentoId: string|null }} [andamento] — de getConsultaEmAndamento
 * @returns {{ primary: 'confirmar' | 'iniciar' | 'voltar' | null, secondary: Array<'anamnese' | 'whatsapp' | 'reagendar' | 'cancelar'>, emAndamento: boolean, atendimentoId?: string|null }}
 */
export function getRailCardActions(status, canStartAnamnese = true, canCancelarAgendamento = true, andamento) {
  const s = String(status || '');
  const isPending = s === 'pendente' || s === 'aguardando_confirmacao';
  const isConfirmed = s === 'confirmado';

  const secondary = ['anamnese', 'whatsapp', 'reagendar'];
  if ((isPending || isConfirmed) && canCancelarAgendamento) {
    secondary.push('cancelar');
  }

  return aplicarAndamento({
    primary: isPending ? 'confirmar' : (isConfirmed && canStartAnamnese) ? 'iniciar' : null,
    secondary,
  }, andamento);
}

export function getRailPrimaryLabel(primary) {
  if (primary === 'confirmar') return 'Confirmar';
  if (primary === 'iniciar') return 'Iniciar atendimento';
  if (primary === 'voltar') return 'Voltar à consulta';
  return null;
}

/**
 * Matriz de ações para card agrupado (status misto ou uniforme).
 * @param {string[]} statuses — status bruto de cada agenda do grupo
 * @param {boolean} [canStartAnamnese=true]
 * @param {boolean} [canCancelarAgendamento=true]
 * @param {{ emAndamento: boolean, minha: boolean, atendimentoId: string|null }} [andamento] — de getConsultaEmAndamento(linhasDoGrupo, ...)
 */
export function getGroupedRailCardActions(statuses = [], canStartAnamnese = true, canCancelarAgendamento = true, andamento) {
  const list = (statuses || []).map((s) => String(s || ''));
  const hasPending = list.some((s) => s === 'pendente' || s === 'aguardando_confirmacao');
  const allConfirmed = list.length > 0 && list.every((s) => s === 'confirmado');
  const anyActive = list.some((s) =>
    ['pendente', 'aguardando_confirmacao', 'confirmado'].includes(s),
  );

  let primary = null;
  if (hasPending) primary = 'confirmar';
  else if (allConfirmed && canStartAnamnese) primary = 'iniciar';

  const secondary = ['anamnese', 'whatsapp', 'reagendar'];
  if (anyActive && canCancelarAgendamento) {
    secondary.push('cancelar');
  }

  return aplicarAndamento({
    primary,
    secondary,
  }, andamento);
}
