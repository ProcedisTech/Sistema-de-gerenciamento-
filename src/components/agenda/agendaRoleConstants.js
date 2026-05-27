/** Roles que podem pré-selecionar a própria pill de profissional no modal (espelha PR-2A backend). */
export const ROLES_AGENDA_PRESELECT = Object.freeze([
  'medico',
  'médico',
  'esteticista',
  'dentista',
  'biomedico',
  'administrador',
  'admin',
]);

export function isRoleAgendaPreselect(roleNome) {
  const n = String(roleNome || '').trim().toLowerCase();
  return ROLES_AGENDA_PRESELECT.includes(n);
}
