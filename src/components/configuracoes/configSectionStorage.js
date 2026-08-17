export const CONFIG_SECTION_KEY = 'procedi_config_section';

const LEGACY_TAB_KEY = 'procedi_config_tab';

export const VALID_SECTIONS = new Set([
  'termos',
  'procedimentos',
  'perguntas-categorias',
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
    // Mapeamento de seções legadas de anamnese para o novo painel unificado
    if (v === 'categorias' || v === 'perguntas' || v === 'perguntas-categorias') return 'fichas';
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
