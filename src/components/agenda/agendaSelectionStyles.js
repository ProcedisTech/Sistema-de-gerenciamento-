/** Superfície selecionada compartilhada (chips, tabs, células do calendário). */
export const AGENDA_SELECTED_SURFACE =
  'border-vivid-teal-700 bg-gradient-to-br from-vivid-teal-600 to-vivid-teal-800 text-white';

/** Célula do calendário — inclui lift e glow exclusivos do grid. */
export const AGENDA_SELECTED_DAY_CELL =
  `${AGENDA_SELECTED_SURFACE} -translate-y-px shadow-agenda-glow`;
