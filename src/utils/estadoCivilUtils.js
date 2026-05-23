/** @typedef {{ id: string, nome?: string }} EstadoCivilOption */

/**
 * UUID de estado civil a partir do paciente e das opções retornadas pela API.
 */
export function resolveEstadoCivilIdForPatient(patient, options) {
  if (!patient || !Array.isArray(options)) return '';
  const rawId = patient.estadoCivilId ?? patient.estado_civil_id;
  const pid = rawId != null ? String(rawId).trim() : '';
  if (pid) {
    const found = options.find((o) => o?.id === pid);
    if (found) return pid;
  }

  const nameRaw =
    patient.estadoCivilNome ??
    patient.estado_civil_nome ??
    patient.estadoCivil ??
    '';
  const needle = String(nameRaw ?? '').trim().toLocaleLowerCase('pt-BR');
  if (!needle) return pid;

  const byName = options.find(
    (o) =>
      String(o?.nome ?? '')
        .trim()
        .toLocaleLowerCase('pt-BR') === needle,
  );
  return byName?.id ? String(byName.id) : pid;
}
