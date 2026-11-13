export const PROTOTYPE_OPERATIONAL_CODES = new Set([
  // Agenda (operacionais)
  "AGENDA_MULTI_VER",
  "AGENDA_CRIAR",
  "AGENDA_EDITAR",
  "AGENDA_TROCAR_PROFISSIONAL",
  "CONFIRMACAO_GERENCIAR",

  // Pacientes (operacionais)
  "PACIENTE_CRIAR",
  "PACIENTE_EDITAR",
  "PRONTUARIO_VER",
  "PRONTUARIO_EDITAR",
  "PRONTUARIO_CRIAR",
  "PDF_EXPORTAR",
  "PACIENTE_NOTA_VER",
  "PACIENTE_NOTA_CRIAR",
  "PACIENTE_NOTA_EDITAR",
  "PACIENTE_GALERIA_VER",
  "PACIENTE_DOCUMENTO_VER",
  "PACIENTE_ANAMNESE_VER",
  "ANAMNESE_PREENCHIMENTO_VER",
  "PACIENTE_ORCAMENTO_VER",
  "PACIENTE_ORCAMENTO_EDITAR",

  // Documentos (operacionais: cria e edita modelos, protege exclusão com senha)
  "ANAMNESE_MODELO_CRIAR",
  "ANAMNESE_MODELO_EDITAR",
  "DOC_MODELO_EDITAR",

  // Equipe (operacionais: convida e edita colaborador, protege perfis e inativação)
  "ACESSO_COLABORADORES_CRIAR",
  "ACESSO_COLABORADORES_EDITAR",
  "USUARIO_CRIAR",
  "USUARIO_EDITAR",

  // Clínica (operacionais: edita clínica, horários, catálogo e preços, protege exclusão com senha)
  "CLINICA_DADOS_EDITAR",
  "CLINICA_HORARIOS_EDITAR",
  "CLINICA_CATALOGO_CRIAR",
  "CLINICA_CATALOGO_EDITAR",
  "CLINICA_PRECOS_EDITAR",
  "CLINICA_EDITAR",
  "HORARIO_EDITAR",
  "FERIADO_EDITAR",
  "CATALOGO_EDITAR",
  "PRECOS_EDITAR",

  // Sistema (operacionais: configura templates de mensagem, protege auditoria LGPD)
  "MSG_TEMPLATE_GERENCIAR",
  "PERFIL_ACESSO_VER",
]);
export const PROTOTYPE_MODULES = [
  {
    key: "agenda",
    name: "Agenda",
    icon: "cal",
    description: "Agendamentos, horários e confirmações",
    matchModulos: ["agenda"],
  },
  {
    key: "pacientes",
    name: "Pacientes",
    icon: "users",
    description: "Cadastro, prontuário, galeria e fichas",
    matchModulos: ["pacientes", "paciente"],
  },
  {
    key: "atendimento",
    name: "Atendimento",
    icon: "steth",
    description: "Acesso à consulta, anamnese e procedimentos do dia",
    matchModulos: ["atendimento"],
  },
  {
    key: "prontuario",
    name: "Prontuário",
    icon: "fold",
    description: "Histórico clínico, fotos e planos",
    matchModulos: ["prontuario"],
  },
  {
    key: "documentos",
    name: "Documentos",
    icon: "file",
    description: "Termos, modelos de fichas e questionários clínicos",
    matchModulos: ["documentos", "termos", "anamnese"],
  },
  {
    key: "catalogo",
    name: "Catálogo",
    icon: "book",
    description: "Serviços, procedimentos e tabela de preços da clínica",
    matchModulos: ["catalogo"],
  },
  {
    key: "equipe",
    name: "Equipe",
    icon: "ucog",
    description: "Pessoas da clínica e perfis de acesso",
    matchModulos: ["equipe", "acesso"],
  },
  {
    key: "clinica",
    name: "Clínica",
    icon: "bld",
    description: "Dados da clínica, horários e catálogo de serviços",
    matchModulos: ["clinica"],
  },
  {
    key: "sistema",
    name: "Sistema",
    icon: "gear",
    description: "Notificações, templates de avisos e auditoria geral",
    matchModulos: ["sistema", "notificacao", "notificacoes", "auditoria"],
  },
];

export const PRESETS_PERFIS = {
  BRANCO: {
    id: "BRANCO",
    nome: "Em branco",
    icone: "📄",
    descricao: "Começar do zero sem permissões marcadas.",
    codigos: [],
  },
  PROFISSIONAL_CLINICO: {
    id: "PROFISSIONAL_CLINICO",
    nome: "Profissional Clínico",
    icone: "🩺",
    descricao: "Atendimento clínico pleno: prontuário, planos, avaliação, termos, procedimentos e agenda própria.",
    codigos: [
      'AGENDA_VER', 'AGENDA_PROPRIA_VER', 'AGENDA_CRIAR', 'AGENDA_EDITAR', 'AGENDA_EXCLUIR', 'AGENDA_BLOQUEIO_GERENCIAR', 'AGENDA_FORA_DISP_ENCAIXAR',
      'PACIENTE_VER', 'PACIENTE_CRIAR', 'PACIENTE_EDITAR', 'PRONTUARIO_VER', 'PRONTUARIO_EDITAR', 'PACIENTE_DOCUMENTO_VER', 'PACIENTE_ANAMNESE_VER', 'PACIENTE_ORCAMENTO_VER', 'PDF_EXPORTAR',
      'ATENDIMENTO_REALIZAR',
      'ATENDIMENTO_ANAMNESE_VER', 'ATENDIMENTO_ANAMNESE_PREENCHER',
      'ATENDIMENTO_AVALIACAO_VER', 'ATENDIMENTO_AVALIACAO_GERENCIAR',
      'ATENDIMENTO_PLANEJAMENTO_VER', 'ATENDIMENTO_PLANEJAMENTO_GERENCIAR',
      'ATENDIMENTO_TERMOS_VER', 'ATENDIMENTO_TERMO_COLETAR',
      'ATENDIMENTO_PROCEDIMENTO_VER', 'ATENDIMENTO_PROCEDIMENTO_EXECUTAR',
      'ATENDIMENTO_RETORNO_VER', 'ATENDIMENTO_RETORNO_GERENCIAR',
      'ANAMNESE_MODELO_VER',
      'DOC_MODELO_VER',
      'PACIENTE_GALERIA_VER',
      'CLINICA_CATALOGO_VER',
      'NOTIFICACAO_VER', 'MSG_TEMPLATE_GERENCIAR'
    ],
  },
  SECRETARIA: {
    id: "SECRETARIA",
    nome: "Recepção / Secretária",
    icone: "💁",
    descricao: "Operação de recepção: Agenda de todos, cadastro de pacientes, termos assinados, orçamentos e acolhimento.",
    codigos: [
      'AGENDA_VER', 'AGENDA_MULTI_VER', 'AGENDA_CRIAR', 'AGENDA_EDITAR', 'AGENDA_TROCAR_PROFISSIONAL', 'AGENDA_EXCLUIR', 'AGENDA_BLOQUEIO_GERENCIAR', 'AGENDA_FORA_DISP_ENCAIXAR',
      'PACIENTE_VER', 'PACIENTE_CRIAR', 'PACIENTE_EDITAR', 'PACIENTE_DOCUMENTO_VER', 'PACIENTE_ORCAMENTO_VER', 'PACIENTE_ORCAMENTO_EDITAR',
      'ATENDIMENTO_REALIZAR',
      'ATENDIMENTO_ANAMNESE_VER', 'ATENDIMENTO_ANAMNESE_PREENCHER',
      'ATENDIMENTO_TERMOS_VER', 'ATENDIMENTO_TERMO_COLETAR',
      'DOC_MODELO_VER',
      'CLINICA_CATALOGO_VER',
      'NOTIFICACAO_VER', 'MSG_TEMPLATE_GERENCIAR'
    ],
  },
  ADMINISTRADOR: {
    id: "ADMINISTRADOR",
    nome: "Administrador",
    icone: "🛡️",
    descricao: "Gestão operacional e administrativa completa da clínica, equipe e relatórios.",
    codigos: [
      'AGENDA_VER', 'AGENDA_MULTI_VER', 'AGENDA_CRIAR', 'AGENDA_EDITAR', 'AGENDA_TROCAR_PROFISSIONAL', 'AGENDA_EXCLUIR', 'AGENDA_BLOQUEIO_GERENCIAR', 'AGENDA_FORA_DISP_ENCAIXAR',
      'PACIENTE_VER', 'PACIENTE_CRIAR', 'PACIENTE_EDITAR', 'PRONTUARIO_VER', 'PRONTUARIO_EDITAR', 'PACIENTE_DOCUMENTO_VER', 'PACIENTE_ANAMNESE_VER', 'PACIENTE_ORCAMENTO_VER', 'PACIENTE_ORCAMENTO_EDITAR', 'PDF_EXPORTAR',
      'ATENDIMENTO_REALIZAR', 'ATENDIMENTO_ANAMNESE_VER', 'ATENDIMENTO_ANAMNESE_PREENCHER', 'ATENDIMENTO_AVALIACAO_VER', 'ATENDIMENTO_AVALIACAO_GERENCIAR', 'ATENDIMENTO_PLANEJAMENTO_VER', 'ATENDIMENTO_PLANEJAMENTO_GERENCIAR', 'ATENDIMENTO_TERMOS_VER', 'ATENDIMENTO_TERMO_COLETAR', 'ATENDIMENTO_PROCEDIMENTO_VER', 'ATENDIMENTO_PROCEDIMENTO_EXECUTAR', 'ATENDIMENTO_RETORNO_VER', 'ATENDIMENTO_RETORNO_GERENCIAR',
      'ANAMNESE_MODELO_VER', 'ANAMNESE_MODELO_CRIAR', 'ANAMNESE_MODELO_EDITAR',
      'DOC_MODELO_VER', 'DOC_MODELO_EDITAR',
      'CLINICA_DADOS_VER', 'CLINICA_DADOS_EDITAR', 'CLINICA_HORARIOS_VER', 'CLINICA_HORARIOS_EDITAR', 'CLINICA_CATALOGO_VER', 'CLINICA_CATALOGO_CRIAR', 'CLINICA_CATALOGO_EDITAR', 'CLINICA_PRECOS_VER', 'CLINICA_PRECOS_EDITAR',
      'ACESSO_CONFIGURACOES_VER', 'ACESSO_COLABORADORES_CRIAR', 'ACESSO_COLABORADORES_EDITAR', 'ACESSO_PERFIL_CRIAR', 'ACESSO_PERFIL_EDITAR', 'ACESSO_PERMISSOES_ATRIBUIR',
      'NOTIFICACAO_VER', 'MSG_TEMPLATE_GERENCIAR', 'AUDITORIA_VER'
    ],
  },
  APOIO: {
    id: "APOIO",
    nome: "Apoio / Auxiliar",
    icone: "🤝",
    descricao: "Acesso mínimo de consulta para apoio operacional de sala e recepção.",
    codigos: [
      'AGENDA_VER',
      'PACIENTE_VER',
      'NOTIFICACAO_VER'
    ],
  },
};
export const moduleKey = (value) =>
  String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
export function profileType(profile) {
  if (profile?.codigo === "DONO") return "dono";
  if (!profile) return "none";
  return profile.organizacaoSaudeDona || profile.organizacaoSaudeDonaId
    ? "cli"
    : "tpl";
}
export function effectiveProfilePermissions(profile, ids, catalog) {
  if (profile?.codigo !== "DONO") return ids;
  return catalog
    .filter(
      (p) =>
        !["AGENDA_APARECER", "AGENDA_MULTI_VER"].includes(p.codigo) ||
        ids.includes(p.permissaoId),
    )
    .map((p) => p.permissaoId);
}
export const PROTOTYPE_ROOT_CODES = new Set([
  "AGENDA_VER",
  "AGENDA_PROPRIA_VER",
  "PACIENTE_VER",
  "PRONTUARIO_VER",
  "ATENDIMENTO_REALIZAR",
  "CATALOGO_VER",
  "CLINICA_DADOS_VER",
  "DOC_MODELO_VER",
  "ANAMNESE_MODELO_VER",
  "ACESSO_CONFIGURACOES_VER",
  "USUARIO_VER",
  "NOTIFICACAO_VER",
  "AUDITORIA_VER",
]);

export const MODULE_PRIMARY_ROOTS = {
  agenda: ["AGENDA_VER"],
  pacientes: ["PACIENTE_VER"],
  atendimento: ["ATENDIMENTO_REALIZAR"],
  prontuario: ["PRONTUARIO_VER"],
  documentos: ["DOC_MODELO_VER", "ANAMNESE_MODELO_VER"],
  catalogo: ["CLINICA_CATALOGO_VER", "CATALOGO_VER"],
  clinica: ["CLINICA_DADOS_VER"],
  equipe: ["ACESSO_CONFIGURACOES_VER", "USUARIO_VER"],
  sistema: ["NOTIFICACAO_VER", "AUDITORIA_VER"],
};

export const SPECIFIC_PREREQUISITES = {
  AGENDA_PROPRIA_VER: ["AGENDA_VER"],
  AGENDA_MULTI_VER: ["AGENDA_VER"],
  AGENDA_CRIAR: ["AGENDA_VER"],
  AGENDA_EDITAR: ["AGENDA_VER"],
  AGENDA_TROCAR_PROFISSIONAL: ["AGENDA_MULTI_VER", "AGENDA_VER"],
  AGENDA_EXCLUIR: ["AGENDA_VER"],
  AGENDA_BLOQUEIO_GERENCIAR: ["AGENDA_VER"],
  AGENDA_FORA_DISP_ENCAIXAR: ["AGENDA_VER"],
  PRONTUARIO_EDITAR: ["PRONTUARIO_VER", "PACIENTE_VER"],
  PRONTUARIO_VER: ["PACIENTE_VER"],
  PACIENTE_ORCAMENTO_EDITAR: ["PACIENTE_ORCAMENTO_VER", "PACIENTE_VER"],
  PACIENTE_ORCAMENTO_VER: ["PACIENTE_VER"],
  PACIENTE_CRIAR: ["PACIENTE_VER"],
  PACIENTE_EDITAR: ["PACIENTE_VER"],
  PACIENTE_INATIVAR: ["PACIENTE_VER"],
  PACIENTE_GALERIA_VER: ["PACIENTE_VER"],
  PACIENTE_DOCUMENTO_VER: ["PACIENTE_VER"],
  PACIENTE_ANAMNESE_VER: ["PACIENTE_VER"],
  PDF_EXPORTAR: ["PACIENTE_VER"],
  ATENDIMENTO_ANAMNESE_PREENCHER: ["ATENDIMENTO_ANAMNESE_VER", "ATENDIMENTO_REALIZAR"],
  ATENDIMENTO_ANAMNESE_VER: ["ATENDIMENTO_REALIZAR"],
  ATENDIMENTO_TERMO_COLETAR: ["ATENDIMENTO_TERMOS_VER", "ATENDIMENTO_REALIZAR"],
  ATENDIMENTO_TERMOS_VER: ["ATENDIMENTO_REALIZAR"],
  ATENDIMENTO_PROCEDIMENTO_EXECUTAR: ["ATENDIMENTO_PROCEDIMENTO_VER", "ATENDIMENTO_REALIZAR"],
  ATENDIMENTO_PROCEDIMENTO_VER: ["ATENDIMENTO_REALIZAR"],
  ATENDIMENTO_AVALIACAO_GERENCIAR: ["ATENDIMENTO_AVALIACAO_VER", "ATENDIMENTO_REALIZAR"],
  ATENDIMENTO_AVALIACAO_VER: ["ATENDIMENTO_REALIZAR"],
  ATENDIMENTO_PLANEJAMENTO_GERENCIAR: ["ATENDIMENTO_PLANEJAMENTO_VER", "ATENDIMENTO_REALIZAR"],
  ATENDIMENTO_PLANEJAMENTO_VER: ["ATENDIMENTO_REALIZAR"],
  ATENDIMENTO_RETORNO_GERENCIAR: ["ATENDIMENTO_RETORNO_VER", "ATENDIMENTO_REALIZAR"],
  ATENDIMENTO_RETORNO_VER: ["ATENDIMENTO_REALIZAR"],
  CLINICA_HORARIOS_EDITAR: ["CLINICA_HORARIOS_VER", "CLINICA_DADOS_VER"],
  CLINICA_HORARIOS_VER: ["CLINICA_DADOS_VER"],
  CLINICA_PRECOS_EDITAR: ["CLINICA_PRECOS_VER", "CLINICA_CATALOGO_VER"],
  CLINICA_PRECOS_VER: ["CLINICA_CATALOGO_VER"],
  CLINICA_CATALOGO_CRIAR: ["CLINICA_CATALOGO_VER"],
  CLINICA_CATALOGO_EDITAR: ["CLINICA_CATALOGO_VER"],
  CLINICA_CATALOGO_EXCLUIR: ["CLINICA_CATALOGO_VER"],
  ANAMNESE_MODELO_CRIAR: ["ANAMNESE_MODELO_VER"],
  ANAMNESE_MODELO_EDITAR: ["ANAMNESE_MODELO_VER"],
  ANAMNESE_MODELO_EXCLUIR: ["ANAMNESE_MODELO_VER"],
  DOC_MODELO_EDITAR: ["DOC_MODELO_VER"],
  TERMO_MODELO_EXCLUIR: ["DOC_MODELO_VER"],
  MSG_TEMPLATE_GERENCIAR: ["NOTIFICACAO_VER"],
  ACESSO_COLABORADORES_CRIAR: ["ACESSO_CONFIGURACOES_VER"],
  ACESSO_COLABORADORES_EDITAR: ["ACESSO_CONFIGURACOES_VER"],
  ACESSO_COLABORADORES_INATIVAR: ["ACESSO_CONFIGURACOES_VER"],
  ACESSO_PERFIL_CRIAR: ["ACESSO_CONFIGURACOES_VER"],
  ACESSO_PERFIL_EDITAR: ["ACESSO_CONFIGURACOES_VER"],
  ACESSO_PERFIL_EXCLUIR: ["ACESSO_CONFIGURACOES_VER"],
  ACESSO_PERMISSOES_ATRIBUIR: ["ACESSO_CONFIGURACOES_VER"],
};

export function getActiveDependentPermissions(permissao, modulo, selectedIds) {
  if (!permissao) return [];
  const code = permissao.codigo;
  const isRaiz =
    PROTOTYPE_ROOT_CODES.has(code) ||
    (modulo?.raizes || []).some((r) => r.permissaoId === permissao.permissaoId);
  if (!isRaiz) return [];

  const selectedSet = new Set(selectedIds || []);
  const permissionsInModule = modulo?.permissions || modulo?.funcoes || [];
  const modKey = (modulo?.key || "").toLowerCase();
  const primaryRoots = MODULE_PRIMARY_ROOTS[modKey] || [];
  const isPrimaryRoot = primaryRoots.includes(code);

  return permissionsInModule.filter((p) => {
    if (p.permissaoId === permissao.permissaoId) return false;
    if (!selectedSet.has(p.permissaoId)) return false;

    if (isPrimaryRoot) {
      return true;
    }

    const reqs = SPECIFIC_PREREQUISITES[p.codigo] || [];
    return reqs.includes(code);
  });
}

export function getPrerequisitesForPermission(permissao, modulo, catalog) {
  if (!permissao) return [];
  const code = permissao.codigo;
  const prereqs = new Set();
  const cat = Array.isArray(catalog) ? catalog : modulo?.permissions || [];

  const reqs = SPECIFIC_PREREQUISITES[code] || [];
  for (const prereqCode of reqs) {
    const match = cat.find((p) => p.codigo === prereqCode);
    if (match) prereqs.add(match.permissaoId);
  }

  const modKey = (modulo?.key || "").toLowerCase();
  const modRoots = MODULE_PRIMARY_ROOTS[modKey] || [];
  for (const rootCode of modRoots) {
    if (rootCode !== code) {
      const match = (modulo?.permissions || cat).find((p) => p.codigo === rootCode);
      if (match) prereqs.add(match.permissaoId);
    }
  }

  return Array.from(prereqs);
}

export function getPermissionHierarchyRank(permission) {
  const code = String(permission?.codigo || "").toUpperCase();
  const name = String(permission?.nome || "").toLowerCase().trim();

  // 1. Ver / Visualizar / Acessar (Topo)
  if (
    code.endsWith("_VER") ||
    code.includes("_VER_") ||
    code.startsWith("VER_") ||
    name.startsWith("acessar aba") ||
    name.startsWith("visualizar") ||
    name.startsWith("ver ")
  ) {
    return 1;
  }

  // 2. Criar / Cadastrar / Convidar
  if (
    code.endsWith("_CRIAR") ||
    code.includes("_CRIAR_") ||
    code.endsWith("_CONVIDAR") ||
    code.endsWith("_CADASTRAR") ||
    name.startsWith("criar") ||
    name.startsWith("cadastrar") ||
    name.startsWith("convidar")
  ) {
    return 2;
  }

  // 4. Excluir / Inativar / Cancelar / Deletar (Rodapé / Ações destrutivas com senha)
  // Checamos Tier 4 antes de Tier 3 para garantir que _INATIVAR, _CANCELAR ou nomes
  // com excluir/inativar/cancelar fiquem estritamente no final.
  if (
    code.endsWith("_EXCLUIR") ||
    code.endsWith("_INATIVAR") ||
    code.endsWith("_CANCELAR") ||
    code.endsWith("_DELETAR") ||
    code.endsWith("_DESATIVAR") ||
    name.startsWith("excluir") ||
    name.startsWith("inativar") ||
    name.startsWith("cancel") ||
    name.startsWith("desativar")
  ) {
    return 4;
  }

  // 3. Editar / Alterar / Preencher / Executar / Gerenciar / Coletar / Configurar / Atribuir / Operar
  return 3;
}

export function sortPermissionsByHierarchy(permissions) {
  if (!Array.isArray(permissions)) return [];
  return [...permissions].sort((a, b) => {
    // 1. Permissões Raiz do Módulo vêm SEMPRE no topo absoluto (posição 1)
    const aIsRaiz = PROTOTYPE_ROOT_CODES.has(a.codigo) ? 0 : 1;
    const bIsRaiz = PROTOTYPE_ROOT_CODES.has(b.codigo) ? 0 : 1;
    if (aIsRaiz !== bIsRaiz) return aIsRaiz - bIsRaiz;

    // 2. Hierarquia de Tiers (1: Ver, 2: Criar, 3: Editar/Operar, 4: Excluir/Inativar)
    const rankA = getPermissionHierarchyRank(a);
    const rankB = getPermissionHierarchyRank(b);
    if (rankA !== rankB) return rankA - rankB;

    // 3. Desempate estável por nome alfabético
    const nomeA = String(a.nome || "");
    const nomeB = String(b.nome || "");
    const cmp = nomeA.localeCompare(nomeB, "pt-BR");
    if (cmp !== 0) return cmp;
    return (a.permissaoId || 0) - (b.permissaoId || 0);
  });
}

export function permissionLevel(permission) {
  const code = String(permission.codigo || "");
  if (code.endsWith("_VER")) return 1;
  if (PROTOTYPE_OPERATIONAL_CODES.has(code)) return 2;
  return 3;
}

export function getVisualModuleKey(permission) {
  if (!permission) return "";
  const code = String(permission.codigo || "").toUpperCase();

  // Permissões do fluxo clínico de atendimento em consultório
  if (code.startsWith("ATENDIMENTO_")) return "atendimento";

  // Permissões vinculadas à ficha/área do paciente
  if (code.startsWith("PACIENTE_") || code === "PDF_EXPORTAR") return "pacientes";

  return "";
}

export function summarizeModules(catalog, selectedIds) {
  const ids = new Set(selectedIds || []);
  return PROTOTYPE_MODULES.map((module) => {
    const permissions = sortPermissionsByHierarchy(
      (catalog || []).filter((p) => {
        if (p.codigo === "AGENDA_APARECER") return false;
        const visualKey = getVisualModuleKey(p);
        if (visualKey) {
          return (
            visualKey === module.key ||
            (Array.isArray(module.matchModulos) &&
              module.matchModulos.includes(visualKey))
          );
        }
        const norm = moduleKey(p.moduloCodigo || p.modulo);
        return (
          norm === module.key ||
          (Array.isArray(module.matchModulos) &&
            module.matchModulos.includes(norm))
        );
      }),
    );
    const selected = permissions.filter((p) => ids.has(p.permissaoId));
    const viewing = permissions.filter((p) => permissionLevel(p) === 1);
    const editing = permissions.filter((p) => permissionLevel(p) === 2);
    const managing = permissions.filter((p) => permissionLevel(p) === 3);
    const hasView = viewing.some((p) => ids.has(p.permissaoId));
    let k = "c",
      t = "Personalizado";
    if (!selected.length) {
      k = "0";
      t = "Sem acesso";
    } else if (selected.every((p) => permissionLevel(p) === 1)) {
      k = "1";
      t = "Só ver";
    } else if (selected.length === permissions.length) {
      k = "3";
      t = "Tudo";
    } else if (
      hasView &&
      editing.length &&
      editing.every((p) => ids.has(p.permissaoId)) &&
      !managing.some((p) => ids.has(p.permissaoId))
    ) {
      k = "2";
      t = "Ver e editar";
    }
    return {
      ...module,
      k,
      t,
      has: selected.length,
      tot: permissions.length,
      permissions,
      selected,
      viewing,
      editing,
      managing,
    };
  });
}

const MODEL_ORDER = [
  "ADMINISTRADOR",
  "SOCIO",
  "PROFISSIONAL_CLINICO",
  "SECRETARIA",
  "APOIO",
];
const MODEL_ALIASES = {
  NIVEL_5: "ADMINISTRADOR",
  NIVEL_4: "SOCIO",
  NIVEL_3: "PROFISSIONAL_CLINICO",
  NIVEL_2: "SECRETARIA",
  NIVEL_1: "APOIO",
};
export function sortPrototypeProfiles(profiles) {
  const rank = (profile) => {
    const type = profileType(profile);
    if (type === "dono") return -2;
    if (type === "cli") return -1;
    const code = String(profile.codigo || "").toUpperCase();
    const index = MODEL_ORDER.indexOf(MODEL_ALIASES[code] || code);
    return index < 0 ? MODEL_ORDER.length : index;
  };
  return [...profiles].sort(
    (a, b) =>
      rank(a) - rank(b) ||
      String(a.nome || "").localeCompare(String(b.nome || ""), "pt-BR"),
  );
}

export function generateUniqueProfileName(
  baseName,
  existingProfiles,
  suffix = " (Personalizado)",
) {
  const cleanBase = String(baseName || "Perfil").trim();
  const existingSet = new Set(
    (existingProfiles || [])
      .map((p) => String(p?.nome || "").trim().toLowerCase())
      .filter(Boolean),
  );

  const initialCandidate = `${cleanBase}${suffix}`;
  if (!existingSet.has(initialCandidate.toLowerCase())) {
    return initialCandidate;
  }

  let counter = 2;
  while (true) {
    const candidate = `${cleanBase} (Personalizado ${counter})`;
    if (!existingSet.has(candidate.toLowerCase())) {
      return candidate;
    }
    counter++;
  }
}

export function isProfileNameDuplicate(
  name,
  existingProfiles,
  ignoreProfileId = null,
) {
  const norm = String(name || "").trim().toLowerCase();
  if (!norm) return false;
  return (existingProfiles || []).some((p) => {
    if (ignoreProfileId && String(p?.id) === String(ignoreProfileId))
      return false;
    return String(p?.nome || "").trim().toLowerCase() === norm;
  });
}


// ---- Onda 1: contagem de funcoes, hierarquia e pendencias da equipe ----
const semAgendaAparecer = (p) => p?.codigo !== "AGENDA_APARECER";
export const FUNCOES_PEDEM_SENHA = new Set([
  "ACESSO_COLABORADORES_INATIVAR",
  "PACIENTE_INATIVAR",
]);
export function catalogFunctionTotal(catalog) {
  return (catalog || []).filter(semAgendaAparecer).length;
}
export function profileFunctionCount(ids, catalog, isOwner = false) {
  if (isOwner) return catalogFunctionTotal(catalog);
  const validos = new Set(
    (catalog || []).filter(semAgendaAparecer).map((p) => p.permissaoId),
  );
  return (ids || []).filter((id) => validos.has(id)).length;
}
const byNamePt = (a, b) =>
  String(a || "").localeCompare(String(b || ""), "pt-BR", {
    sensitivity: "base",
  });
export function sortProfilesByHierarchy(profiles, idsByProfile, catalog) {
  const count = (p) =>
    p.codigo === "DONO"
      ? Infinity
      : idsByProfile?.[p.id]
        ? profileFunctionCount(idsByProfile[p.id], catalog)
        : -1;
  return [...profiles].sort(
    (a, b) =>
      (count(a) === count(b) ? 0 : count(b) > count(a) ? 1 : -1) ||
      byNamePt(a.nome, b.nome),
  );
}
export function compareMembersByHierarchy(orderedProfiles, nameOf) {
  const pos = (m) => {
    const i = orderedProfiles.findIndex(
      (p) => m.perfilAcessoId != null && String(p.id) === String(m.perfilAcessoId),
    );
    return i < 0 ? Infinity : i;
  };
  return (a, b) => {
    const pa = pos(a);
    const pb = pos(b);
    if (pa !== pb) return pa < pb ? -1 : 1;
    return byNamePt(nameOf(a), nameOf(b));
  };
}
export function prunePinnedProfileIds(saved, profiles) {
  if (!Array.isArray(saved)) return saved;
  if (!profiles || profiles.length === 0) return saved;
  const existentes = new Set(profiles.map((p) => String(p.id)));
  return saved.filter((id) => existentes.has(String(id)));
}
// Mesmos campos da tela: ativo = `ativo !== false`; sem perfil = sem `perfilAcessoId`.
export function contarPrecisamDeVoce(equipe) {
  return (equipe || []).filter((u) => u.ativo !== false && !u.perfilAcessoId)
    .length;
}
