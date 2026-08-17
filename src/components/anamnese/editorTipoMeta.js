/** Espelho do objeto T / PRIO / RAPIDOS do protótipo V6 (L674–690) */

export const RAPIDOS = ['sim_nao_naosei', 'texto', 'numero'];

export const TIPO_META = {
  sim_nao_naosei: {
    n: 'Sim, Não ou Não sei',
    d: 'Ela marca uma das três',
    rec: true,
  },
  booleano: {
    n: 'Só Sim ou Não',
    d: 'Sem a opção "não sei"',
  },
  texto: {
    n: 'Texto livre',
    d: 'Ela escreve com as próprias palavras',
  },
  numero: {
    n: 'Número',
    d: 'Ex.: quantas vezes, quantos meses',
  },
  escolha_unica: {
    n: 'Uma opção da lista',
    d: 'Você define as alternativas',
  },
  multipla_escolha: {
    n: 'Várias da lista',
    d: 'Você define, ela marca várias',
  },
  catalogo_medicamento: {
    n: 'Um remédio que ela toma',
    d: 'O sistema cruza com o anestésico na hora de aplicar',
    feed: 'medicamento em uso',
    vira: 'Vira <b>medicamento em uso</b> no prontuário dela',
  },
  catalogo_principio_ativo: {
    n: 'Uma alergia a princípio ativo',
    d: 'É a única que impede o sistema de liberar o anestésico',
    feed: 'alergia a medicamento',
    vira: 'Vira <b>alergia a medicamento</b> no prontuário — bloqueia a aplicação',
  },
  catalogo_alergia: {
    n: 'Alergias alimentares e ambientais',
    d: 'Alimento, látex, poeira — fica no prontuário, não bloqueia insumo',
    feed: 'alergia registrada',
    vira: 'Vira <b>alergia registrada</b> no prontuário dela',
  },
  catalogo_antecedente: {
    n: 'Uma condição de saúde',
    d: 'Doenças, cirurgias, hábitos e casos na família',
    feed: 'condição de saúde',
    vira: 'Vira <b>condição de saúde</b> no prontuário dela',
  },
};

export const PRIO_META = {
  NORMAL: {
    n: 'Normal',
    c: '#94a3b8',
    d: 'Fica na ficha. Quem quiser ver, abre a anamnese.',
  },
  ALERTA: {
    n: 'Atenção',
    c: '#f59e0b',
    d: 'Aparece no resumo do prontuário, no topo do atendimento.',
  },
  CRITICA: {
    n: 'Crítica',
    c: '#e11d48',
    d: 'Trava um aviso na tela antes de qualquer procedimento.',
  },
};

export const QUEM_OPCOES = [
  { k: null, n: 'Todos os pacientes', d: 'A seção sempre aparece', api: null },
  { k: 'F', n: 'Só para mulheres', d: 'Homens não veem estas perguntas', api: 'FEMININO' },
  { k: 'M', n: 'Só para homens', d: 'Mulheres não veem estas perguntas', api: 'MASCULINO' },
];

export const TIPO_MENU_GROUPS = [
  { keys: ['sim_nao_naosei', 'booleano', 'texto', 'numero'] },
  {
    label: 'Escolher entre opções que você cria',
    keys: ['escolha_unica', 'multipla_escolha'],
  },
  {
    label: '★ Ela busca numa lista do sistema — a resposta entra no prontuário',
    keys: [
      'catalogo_medicamento',
      'catalogo_principio_ativo',
      'catalogo_alergia',
      'catalogo_antecedente',
    ],
  },
];

export function getTipoMeta(codigo) {
  return TIPO_META[codigo] || { n: codigo, d: '' };
}

export function tipoAlimentaProntuario(codigo) {
  return Boolean(TIPO_META[codigo]?.feed);
}

export function perguntaAlimentaProntuario(q) {
  if (!q) return false;
  if (q.antecedenteCatalogoId || q.tipoAntecedentePessoalId) return true;
  return tipoAlimentaProntuario(q.tipoRespostaCodigo);
}

export function computeSecaoSummary(secao) {
  const ps = secao?.perguntas || [];
  let crit = 0;
  let alert = 0;
  let hist = 0;
  for (const q of ps) {
    const pri = String(q.prioridade || 'NORMAL').toUpperCase();
    if (pri === 'CRITICA') crit += 1;
    else if (pri === 'ALERTA') alert += 1;
    if (perguntaAlimentaProntuario(q)) hist += 1;
  }
  return { total: ps.length, crit, alert, hist };
}

export function computeDocStats(secoes) {
  let q = 0;
  let s = secoes?.length || 0;
  let cr = 0;
  let at = 0;
  let hi = 0;
  for (const sec of secoes || []) {
    const sum = computeSecaoSummary(sec);
    q += sum.total;
    cr += sum.crit;
    at += sum.alert;
    hi += sum.hist;
  }
  return { q, s, cr, at, hi };
}

export function sexoToWhobtnLabel(sexo) {
  if (sexo === 'FEMININO') return 'Só para mulheres';
  if (sexo === 'MASCULINO') return 'Só para homens';
  return 'Para quem?';
}
