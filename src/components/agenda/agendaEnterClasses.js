/** Classes de entrada F5 — só no mount inicial do dashboard. */
export function agendaEnterClass(showEntrance, delayClass) {
  if (!showEntrance) return '';
  return `animate-agenda-rise ${delayClass}`;
}
