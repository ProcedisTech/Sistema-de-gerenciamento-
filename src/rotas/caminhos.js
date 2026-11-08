import { SLUG_DA_SECAO } from './tabela';

const e = encodeURIComponent;
const ORDEM_PADRAO = 'nome-asc'; // usePatientState.js:144

const TOKENS = [
  ['anamneseDesatualizada', 'anamnese-desatualizada'],
  ['semRetorno', 'sem-retorno'],
  ['semAgendamentoFuturo', 'sem-agendamento-futuro'],
  ['ehNovo', 'novos'],
  ['ehAniversariante', 'aniversariantes'],
];

function pacientes(query) {
  const q = query || {};
  const tokens = [];
  if (q.quickFilter === 'menor') tokens.push('menor');
  if (q.statusPlano === 'sem_plano') tokens.push('sem-plano');
  if (q.statusPlano === 'plano_ativo') tokens.push('plano-ativo');
  for (const [campo, token] of TOKENS) if (q[campo]) tokens.push(token);
  const p = new URLSearchParams();
  if (tokens.length) p.set('filtro', tokens.join(','));
  if (q.ordem && q.ordem !== ORDEM_PADRAO) p.set('ordem', q.ordem);
  if (q.pagina > 0) p.set('pagina', String(q.pagina + 1));
  if (q.resumoId != null && q.resumoId !== '') p.set('resumo', String(q.resumoId));
  const s = p.toString().replace(/%2C/g, ',');
  return s ? `/pacientes?${s}` : '/pacientes';
}

// Inverso de pacientes(query); `search` com ou sem "?".
export function lerQueryPacientes(search = '') {
  const p = new URLSearchParams(search);
  const tokens = new Set((p.get('filtro') || '').split(',').filter(Boolean));
  const pagina = parseInt(p.get('pagina'), 10);
  const q = {
    quickFilter: tokens.has('menor') ? 'menor' : null,
    statusPlano: tokens.has('sem-plano') ? 'sem_plano' : tokens.has('plano-ativo') ? 'plano_ativo' : null,
    ordem: p.get('ordem') || ORDEM_PADRAO,
    pagina: pagina > 1 ? pagina - 1 : 0,
    resumoId: p.get('resumo') || null,
  };
  for (const [campo, token] of TOKENS) q[campo] = tokens.has(token);
  return q;
}

const TELAS = {
  pacientes: '/pacientes',
  agenda: '/agenda',
  'gestao-equipe': '/equipe',
  configuracoes: '/configuracoes',
  notificacoes: '/notificacoes',
  consulta: '/consulta',
};

export const caminhos = {
  entrar: () => '/entrar',
  consulta: () => '/consulta',
  pacientes,
  pacienteNovo: () => '/pacientes/novo',
  paciente: (id, aba) => `/pacientes/${e(id)}${aba && aba !== 'planos' ? `/${e(aba)}` : ''}`,
  pacienteAnamnese: (id, aid, { editar } = {}) =>
    `/pacientes/${e(id)}/anamnese/${e(aid)}${editar ? '/editar' : ''}`,
  pacientePlano: (id, pid) => `/pacientes/${e(id)}/planos/${e(pid)}`,
  agenda: (id) => (id == null ? '/agenda' : `/agenda/${e(id)}`),
  notificacoes: () => '/notificacoes',
  equipe: (aba) => (aba && aba !== 'membros' ? `/equipe/${e(aba)}` : '/equipe'),
  membro: (id) => `/equipe/${e(id)}`,
  configuracoes: (secaoInterna) =>
    secaoInterna ? `/configuracoes/${SLUG_DA_SECAO[secaoInterna] ?? e(secaoInterna)}` : '/configuracoes',
  termoNovo: () => '/configuracoes/termos/novo',
  termo: (id) => `/configuracoes/termos/${e(id)}`,
  ficha: (id) => `/configuracoes/fichas/${e(id)}`,
  tela: (view) => TELAS[view] ?? '/pacientes',
};
