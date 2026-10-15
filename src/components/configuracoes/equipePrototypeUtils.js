export const PROTOTYPE_OPERATIONAL_CODES = new Set([
  "AGENDA_MULTI_VER",
  "AGENDA_CRIAR",
  "AGENDA_EDITAR",
  "CONFIRMACAO_GERENCIAR",
  "PACIENTE_CRIAR",
  "PACIENTE_EDITAR",
  "ANAMNESE_PREENCHIMENTO_CRIAR",
  "HUB_AVALIACAO_VER",
  "HUB_ANAMNESE_VER",
  "HUB_TERMOS_VER",
  "HUB_PROCEDIMENTO_EXECUTAR",
  "HUB_ORIENTACAO_VER",
  "PRONTUARIO_CRIAR",
  "PACIENTE_NOTA_VER",
  "PACIENTE_NOTA_CRIAR",
  "PACIENTE_NOTA_EDITAR",
  "PACIENTE_GALERIA_VER",
  "ANAMNESE_PREENCHIMENTO_VER",
  "PACIENTE_DOCUMENTO_VER",
  "PACIENTE_ORCAMENTO_VER",
  "PACIENTE_ORCAMENTO_EDITAR",
  "PERFIL_ACESSO_VER",
]);
export const PROTOTYPE_MODULES = [
  {
    key: "agenda",
    name: "Agenda",
    icon: "cal",
    description: "Agendamentos, horários e confirmações",
  },
  {
    key: "pacientes",
    name: "Pacientes",
    icon: "users",
    description: "Cadastro, fichas, orçamentos e evolução dos pacientes",
  },
  {
    key: "atendimento",
    name: "Atendimento",
    icon: "steth",
    description: "Acesso à consulta, anamnese e procedimentos do dia",
  },
  {
    key: "prontuario",
    name: "Prontuário",
    icon: "fold",
    description: "Histórico clínico, fotos e planos",
  },
  {
    key: "documentos",
    name: "Documentos",
    icon: "file",
    description: "Termos, modelos de fichas e documentos assinados",
  },
  {
    key: "catalogo",
    name: "Catálogo",
    icon: "book",
    description: "Serviços, procedimentos e tabela de preços da clínica",
  },
  {
    key: "equipe",
    name: "Equipe",
    icon: "ucog",
    description: "Pessoas da clínica e perfis de acesso",
  },
  {
    key: "clinica",
    name: "Clínica",
    icon: "bld",
    description: "Dados, horário e feriados da clínica",
  },
  {
    key: "sistema",
    name: "Sistema",
    icon: "gear",
    description: "Configurações gerais",
  },
];
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
  "CATALOGO_VER",
  "DOC_MODELO_VER",
  "ANAMNESE_MODELO_VER",
  "USUARIO_VER",
  "NOTIFICACAO_VER",
  "AUDITORIA_VER",
]);

export function getPermissionHierarchyRank(permission) {
  const code = String(permission?.codigo || "").toUpperCase();
  // 1. Ver / Visualizar (Topo)
  if (code.endsWith("_VER")) return 1;
  // 2. Criar / Cadastrar
  if (code.endsWith("_CRIAR") || code.includes("_CRIAR_")) return 2;
  // 3. Editar / Alterar / Preços / Horários / Feriados
  if (
    code.endsWith("_EDITAR") ||
    code.includes("_EDITAR_") ||
    code.endsWith("_ALTERAR")
  ) {
    return 3;
  }
  // 4. Gerenciar / Executar / Encaixar / Exportar / Bloquear / Confirmar
  if (
    code.endsWith("_GERENCIAR") ||
    code.endsWith("_EXECUTAR") ||
    code.endsWith("_EXPORTAR") ||
    code.endsWith("_ENCAIXAR") ||
    code === "AGENDA_APARECER"
  ) {
    return 4;
  }
  // 5. Excluir / Cancelar / Deletar (Ações destrutivas no rodapé)
  if (
    code.endsWith("_EXCLUIR") ||
    code.endsWith("_DELETAR") ||
    code.endsWith("_CANCELAR")
  ) {
    return 5;
  }
  return 6;
}

export function sortPermissionsByHierarchy(permissions) {
  if (!Array.isArray(permissions)) return [];
  return [...permissions].sort((a, b) => {
    const rankA = getPermissionHierarchyRank(a);
    const rankB = getPermissionHierarchyRank(b);
    if (rankA !== rankB) return rankA - rankB;

    // Se mesmo rank, colocar permissões raiz do módulo primeiro
    const aIsRaiz = PROTOTYPE_ROOT_CODES.has(a.codigo) ? 0 : 1;
    const bIsRaiz = PROTOTYPE_ROOT_CODES.has(b.codigo) ? 0 : 1;
    if (aIsRaiz !== bIsRaiz) return aIsRaiz - bIsRaiz;

    // Desempate estável por nome alfabético
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
export function summarizeModules(catalog, selectedIds) {
  const ids = new Set(selectedIds || []);
  return PROTOTYPE_MODULES.map((module) => {
    const permissions = sortPermissionsByHierarchy(
      (catalog || []).filter(
        (p) =>
          moduleKey(p.modulo) === module.key && p.codigo !== "AGENDA_APARECER",
      ),
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
