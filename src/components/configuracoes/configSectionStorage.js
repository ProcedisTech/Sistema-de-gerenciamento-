export const CONFIG_SECTION_KEY = 'procedi_config_section';
const CONFIG_COLLAPSED_KEY = 'procedi_config_collapsed_groups';

const LEGACY_TAB_KEY = 'procedi_config_tab';

export const VALID_SECTIONS = new Set([
  'termos',
  'procedimentos',
  'categorias',
  'perguntas',
  'fichas',
  'anamnese-publica',
  'perfil',
  'clinica',
  'gestao-equipe',
  'horarios-funcionamento',
  'agenda-feriados',
  'agenda-templates',
  'pacientes-inativados',
  'metodos-assinatura',
]);

export function readStoredSection() {
  try {
    const v = sessionStorage.getItem(CONFIG_SECTION_KEY);
    if (v === 'agenda-horarios') return 'horarios-funcionamento';
    if (v === 'usuarios-acessos') return 'gestao-equipe';
    if (v && VALID_SECTIONS.has(v)) return v;
    const legacy = sessionStorage.getItem(LEGACY_TAB_KEY);
    if (legacy === 'termos') return 'termos';
    if (legacy === 'anamnese') return 'fichas';
  } catch {
    /* ignore */
  }
  return 'perfil';
}

export function persistSection(s) {
  try {
    sessionStorage.setItem(CONFIG_SECTION_KEY, s);
  } catch {
    /* ignore */
  }
}

export function readCollapsedGroups() {
  try {
    const v = sessionStorage.getItem(CONFIG_COLLAPSED_KEY);
    if (v) return new Set(JSON.parse(v));
  } catch {
    /* ignore */
  }
  return new Set();
}

export function persistCollapsedGroups(set) {
  try {
    sessionStorage.setItem(CONFIG_COLLAPSED_KEY, JSON.stringify([...set]));
  } catch {
    /* ignore */
  }
}
