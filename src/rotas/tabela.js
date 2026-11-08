// Tabela única de endereços do Procedi. Segmento fixo vence parâmetro (matchRoutes ranqueia).
export const ABAS_PACIENTE = ['avulsos', 'prontuario', 'anamnese', 'documentos'];

export const SLUG_DA_SECAO = {
  perfil: 'meu-perfil',
  clinica: 'clinica',
  'horarios-funcionamento': 'horarios',
  'agenda-feriados': 'feriados',
  'agenda-templates': 'mensagens',
  procedimentos: 'procedimentos',
  termos: 'termos',
  'metodos-assinatura': 'metodos-de-assinatura',
  fichas: 'fichas',
  'anamnese-publica': 'anamnese-publica',
  'pacientes-inativados': 'pacientes-inativos',
};

export const SECAO_DO_SLUG = Object.fromEntries(
  Object.entries(SLUG_DA_SECAO).map(([secao, slug]) => [slug, secao]),
);

// Valores antigos de procedi_config_section (configSectionStorage.js:24-27) -> seção atual.
export const SECAO_LEGADA = {
  'agenda-horarios': 'horarios-funcionamento',
  categorias: 'fichas',
  perguntas: 'fichas',
  'perguntas-categorias': 'fichas',
  'usuarios-acessos': 'gestao-equipe', // marcador: legado leva a /equipe, não a uma seção de Configurações
};

export const ROTAS = [
  { id: 'entrar', path: '/entrar' },
  { id: 'consulta', path: '/consulta' },
  { id: 'pacientes', path: '/pacientes' },
  { id: 'pacienteNovo', path: '/pacientes/novo' },
  { id: 'paciente', path: '/pacientes/:pacienteId' },
  { id: 'pacienteAba', path: '/pacientes/:pacienteId/:aba' },
  { id: 'pacienteAnamnese', path: '/pacientes/:pacienteId/anamnese/:anamneseId' },
  { id: 'pacienteAnamneseEditar', path: '/pacientes/:pacienteId/anamnese/:anamneseId/editar' },
  { id: 'pacientePlano', path: '/pacientes/:pacienteId/planos/:planejamentoId' },
  { id: 'agenda', path: '/agenda' },
  { id: 'agendaItem', path: '/agenda/:agendaId' },
  { id: 'notificacoes', path: '/notificacoes' },
  { id: 'equipe', path: '/equipe' },
  { id: 'equipePerfis', path: '/equipe/perfis' },
  { id: 'equipeAuditoria', path: '/equipe/auditoria' },
  { id: 'membro', path: '/equipe/:membroId' },
  { id: 'auditoria', path: '/auditoria' },
  { id: 'configuracoes', path: '/configuracoes' },
  { id: 'termoNovo', path: '/configuracoes/termos/novo' },
  { id: 'termo', path: '/configuracoes/termos/:termoId' },
  { id: 'ficha', path: '/configuracoes/fichas/:fichaId' },
  { id: 'secao', path: '/configuracoes/:secao' },
];
