export const CONFIG_SECTION_KEY = 'procedi_config_section';

const LEGACY_TAB_KEY = 'procedi_config_tab';

export const VALID_SECTIONS = new Set([
  'termos',
  'categorias',
  'perguntas',
  'fichas',
  'perfil',
  'clinica',
  'usuarios-acessos',
  'agenda-horarios',
  'agenda-feriados',
  'agenda-templates',
  'pacientes-inativados',
]);

export function readStoredSection() {
  try {
    const v = sessionStorage.getItem(CONFIG_SECTION_KEY);
    if (v && VALID_SECTIONS.has(v)) return v;
    const legacy = sessionStorage.getItem(LEGACY_TAB_KEY);
    if (legacy === 'termos') return 'termos';
    if (legacy === 'anamnese') return 'fichas';
  } catch {
    /* ignore */
  }
  return 'fichas';
}

export function persistSection(s) {
  try {
    sessionStorage.setItem(CONFIG_SECTION_KEY, s);
  } catch {
    /* ignore */
  }
}
