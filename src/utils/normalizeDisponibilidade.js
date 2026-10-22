/**
 * Normaliza a disponibilidade de um profissional conforme o Backlog B-45 e Issue #260.
 *
 * Regras canônicas:
 * 1. Se seguirHorarioClinica === true -> Devolve a grade da clínica (herança dinâmica).
 * 2. Se seguirHorarioClinica === false -> Devolve os turnos manuais do profissional.
 * 3. Se for array legado puro ([...]) -> Devolve o próprio array sanitizado.
 * 4. Autônomo / Sem profissional -> Devolve os horários da clínica como fallback.
 *
 * @param {object|Array|null|undefined} raw Dados brutos vindos da API
 * @param {Array} clinicaHorarios Horários de funcionamento da clínica
 * @returns {Array<{id?: string, diaSemana: number, horaInicio: string, horaFim: string, ativo?: boolean}>}
 */
export function normalizeDisponibilidade(raw, clinicaHorarios = []) {
  const sanitizeList = (list) =>
    (Array.isArray(list) ? list : []).filter(
      (item) => item && item.ativo !== false && item.horaInicio && item.horaFim
    );

  if (!raw) {
    return sanitizeList(clinicaHorarios);
  }

  // Compatibilidade com array direto legado / mocks de teste
  if (Array.isArray(raw)) {
    return sanitizeList(raw);
  }

  // Envelope DTO: { seguirHorarioClinica, turnos, gradeClinica }
  if (typeof raw === 'object') {
    const turnosValidos = sanitizeList(raw.turnos);
    const gradeClinicaValida = sanitizeList(
      Array.isArray(raw.gradeClinica) && raw.gradeClinica.length > 0
        ? raw.gradeClinica
        : clinicaHorarios
    );

    // Se explicitly configurado como seguirHorarioClinica: false e tem turnos manuais válidos
    const explicitManual = raw.seguirHorarioClinica === false;
    if (explicitManual && turnosValidos.length > 0) {
      return turnosValidos;
    }

    // Por padrão (seguirHorarioClinica: true ou sem turnos manuais), herda a grade da clínica
    if (gradeClinicaValida.length > 0) {
      return gradeClinicaValida;
    }

    // Fallback secundário para turnos manuais se grade da clínica estiver vazia
    if (turnosValidos.length > 0) {
      return turnosValidos;
    }
  }

  return sanitizeList(clinicaHorarios);
}
