// Migra chaves antigas de sessionStorage para o endereço (caminhos literais de propósito).
export const CHAVES_ANTIGAS = [
  'activeView',
  'patientView',
  'patientDetailTab',
  'selectedPatientCpf',
  'activePatientCpf',
  'procedi_config_section',
  'procedi_config_tab',
];

const MAPA = {
  jornada: '/pacientes',
  consulta: '/pacientes',
  anamnese: '/configuracoes',
  termos: '/configuracoes',
  'gestao-equipe': '/equipe',
  pacientes: '/pacientes',
  agenda: '/agenda',
  notificacoes: '/notificacoes',
  configuracoes: '/configuracoes',
};

export function consumirChavesAntigas(pathname) {
  let valor = null;
  try {
    valor = sessionStorage.getItem('activeView');
  } catch {
    // storage bloqueado: segue sem valor
  }
  for (const chave of CHAVES_ANTIGAS) {
    try {
      sessionStorage.removeItem(chave);
    } catch {
      // ignore
    }
  }
  if (pathname !== '/' || !valor) return null;
  return Object.hasOwn(MAPA, valor) ? MAPA[valor] : null;
}
