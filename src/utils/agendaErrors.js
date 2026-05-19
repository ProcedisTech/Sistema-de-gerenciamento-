function backendMessageBlob(err) {
  let bodyJson = '';
  try {
    bodyJson = JSON.stringify(err?.body ?? {}).toLowerCase();
  } catch {
    /* ignore */
  }
  const parts = [
    err?.message,
    err?.body?.message,
    err?.body?.error,
    err?.body?.detail,
    Array.isArray(err?.body?.errors)
      ? err.body.errors.map((x) => x?.defaultMessage || x).join(' ')
      : '',
    bodyJson,
  ]
    .filter(Boolean)
    .map((s) => String(s));
  return parts.join(' ').toLowerCase();
}

/**
 * 409 fora da disponibilidade cadastrada (V31 — ProblemDetail com prefixo FORA_DA_DISPONIBILIDADE).
 */
export function isAgendaForaDisponibilidadeError(err) {
  const blob = backendMessageBlob(err);
  return blob.includes('fora_da_disponibilidade');
}

/**
 * Sobreposição de horário em tb_agenda (trigger fn_validar_conflito_agenda no PostgreSQL).
 * O Spring costuma devolver 500 com a mensagem do Postgres no JSON — não confundir com falha de JWT.
 */
export function isAgendaSlotOverlapError(err) {
  const blob = backendMessageBlob(err);
  return (
    blob.includes('conflito de agenda') ||
    blob.includes('sobreposto') ||
    blob.includes('fn_validar_conflito_agenda') ||
    blob.includes('horário sobreposto') ||
    blob.includes('horario sobreposto') ||
    blob.includes('já existe agendamento de') ||
    blob.includes('ja existe agendamento de')
  );
}

/**
 * Alertas ao finalizar a jornada (POST agenda → iniciar → finalizar procedimento).
 */
export function formatJourneyFinishError(err) {
  if (isAgendaForaDisponibilidadeError(err)) {
    return 'Profissional não atende neste horário. Escolha um horário dentro da disponibilidade cadastrada.';
  }
  if (isAgendaSlotOverlapError(err)) {
    return 'Conflito de agenda: mesmo após tentar vários horários no dia, não havia intervalo livre de 45 min para este profissional. Libere slots na Agenda, cancele agendamentos antigos ou tente outro dia.';
  }
  if (err?.status === 401) {
    return `${err.message || 'Não autorizado'}. Sessão expirada ou sem permissão — faça login novamente.`;
  }
  return err?.message || 'Não foi possível registrar o procedimento.';
}

/**
 * Mensagens amigáveis para conflitos da API de compromissos no slot (409).
 * @param {object} err
 * @param {{ context?: 'bloqueio'|'default' }} [opts]
 */
export function formatAgendamentoApiError(err, opts = {}) {
  const status = err?.status;
  const msg = String(err?.message || '').toLowerCase();
  const raw = err?.message || '';

  if (status === 401) {
    return `${raw || '[HTTP 401]'} — Sessão não autenticada: confira no Network se o POST envia Cookie com jwt, use só http://localhost:5173 ou só http://127.0.0.1:5173 (não misture), e deixe VITE_API_BASE_URL vazio em dev.`;
  }
  if (status === 403) {
    return `${raw || '[HTTP 403]'} — Sem permissão para esta operação na organização atual (X-Org-Id).`;
  }

  if (status === 409 || isAgendaSlotOverlapError(err)) {
    if (isAgendaForaDisponibilidadeError(err)) {
      if (opts.context === 'bloqueio') {
        return 'Profissional não atende neste horário. Bloqueie apenas dentro do horário de trabalho.';
      }
      return 'Profissional não atende neste horário. Escolha um horário dentro da disponibilidade cadastrada.';
    }
    if (msg.includes('delete') || msg.includes('apag') || msg.includes('procedimento')) {
      return 'Não é possível remover: já existe procedimento feito ligado a este agendamento.';
    }
    if (opts.context === 'bloqueio' || isAgendaSlotOverlapError(err)) {
      return 'Já existe agendamento ou bloqueio neste horário para este profissional. Escolha outro intervalo.';
    }
    return 'Já existe o mesmo paciente e procedimento neste horário. Escolha outro paciente, outro procedimento ou outro horário.';
  }
  return raw || 'Não foi possível concluir a operação.';
}
