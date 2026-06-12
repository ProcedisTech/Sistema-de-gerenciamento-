const PLANO_STATUS = {
  rascunho: {
    label: 'Rascunho',
    pillClass: 'bg-[#fef9c3] text-[#b45309] border-[#f59e0b]/20',
  },
  ativo: {
    label: 'Ativo',
    pillClass: 'bg-[#e6f7f5] text-[#0f766e] border-[#00a88e]/25',
  },
  concluido: {
    label: 'Concluído',
    pillClass: 'bg-[#dcfce7] text-[#16a34a] border-[#22c55e]/20',
  },
  encerrado: {
    label: 'Encerrado',
    pillClass: 'bg-[#f1f5f9] text-[#64748b] border-[#e2e8f0]',
  },
};

const REALIZADO_PRESET = {
  label: 'Realizado',
  pillClass: 'bg-[#dcfce7] text-[#16a34a] border-[#22c55e]/20',
};

const ITEM_STATUS = {
  pendente: {
    label: 'Pendente',
    pillClass: 'bg-[#fef9c3] text-[#b45309] border-[#f59e0b]/20',
  },
  agendado: {
    label: 'Agendado',
    pillClass: 'bg-[#e6f7f5] text-[#0f766e] border-[#00a88e]/25',
  },
  realizado: REALIZADO_PRESET,
  finalizado: REALIZADO_PRESET,
  cancelado: {
    label: 'Cancelado',
    pillClass: 'bg-[#f1f5f9] text-[#64748b] border-[#e2e8f0]',
  },
};

function normalizeCodigo(raw) {
  return String(raw ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_');
}

export function normalizeItemStatusCodigo(statusItem) {
  if (statusItem == null) return '';
  if (typeof statusItem === 'string') return normalizeCodigo(statusItem);
  return normalizeCodigo(
    statusItem.statusCodigo ?? statusItem.codigo ?? statusItem.statusItem ?? '',
  );
}

export function isItemFinalizado(statusItem) {
  const codigo = normalizeItemStatusCodigo(statusItem);
  return codigo === 'finalizado' || codigo === 'realizado';
}

export function isItemCancelado(statusItem) {
  return normalizeItemStatusCodigo(statusItem) === 'cancelado';
}

export function isItemAgendado(statusItem) {
  return normalizeItemStatusCodigo(statusItem) === 'agendado';
}

export function isItemPendente(statusItem) {
  const codigo = normalizeItemStatusCodigo(statusItem);
  return codigo === '' || codigo === 'pendente';
}

export function canDarBaixaItem(plano, item) {
  if (!plano || !item) return false;
  if (plano.statusCodigo !== 'ativo') return false;
  if (isItemFinalizado(item.statusItem ?? item.statusItemNome)) return false;
  if (isItemCancelado(item.statusItem ?? item.statusItemNome)) return false;
  return true;
}

export function canReagendarItem(plano, item) {
  if (!plano || !item) return false;
  if (plano.statusCodigo !== 'ativo') return false;
  if (!isItemAgendado(item.statusItem ?? item.statusItemNome)) return false;
  const sessao = item.sessaoAtiva;
  if (sessao?.agendaId) {
    const statusSessao = normalizeCodigo(sessao.statusCodigo ?? sessao.status ?? '');
    if (['reagendado', 'cancelado', 'realizado'].includes(statusSessao)) return false;
  }
  return true;
}

export function planoProntoParaConcluir(plano) {
  if (!plano || plano.statusCodigo !== 'ativo') return false;
  const itens = Array.isArray(plano.itens) ? plano.itens : [];
  if (itens.length === 0) return false;
  const naoCancelados = itens.filter(
    (item) => !isItemCancelado(item.statusItem ?? item.statusItemNome),
  );
  if (naoCancelados.length === 0) return false;
  return naoCancelados.every((item) =>
    isItemFinalizado(item.statusItem ?? item.statusItemNome),
  );
}

export function getPlanoStatusPresentation(statusCodigo, statusNome) {
  const codigo = normalizeCodigo(statusCodigo);
  const preset = PLANO_STATUS[codigo];
  if (preset) return preset;
  const label = String(statusNome ?? statusCodigo ?? '—').trim() || '—';
  return {
    label,
    pillClass: 'bg-[#f1f5f9] text-[#64748b] border-[#e2e8f0]',
  };
}

export function getPlanoItemStatusPresentation(statusItem) {
  if (statusItem == null) {
    return { label: '—', pillClass: 'bg-[#f1f5f9] text-[#64748b] border-[#e2e8f0]' };
  }
  const codigo = normalizeItemStatusCodigo(statusItem);
  const nome =
    typeof statusItem === 'object'
      ? statusItem.statusNome ?? statusItem.nome ?? statusItem.label
      : null;
  const preset = ITEM_STATUS[codigo];
  if (preset) return preset;
  const label = String(nome ?? statusItem ?? codigo ?? '—').trim() || '—';
  return {
    label,
    pillClass: 'bg-[#f1f5f9] text-[#64748b] border-[#e2e8f0]',
  };
}
