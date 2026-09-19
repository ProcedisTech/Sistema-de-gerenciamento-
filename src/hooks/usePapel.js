import { useOrg } from '../contexts/OrgContext';
import { PERMISSOES, PERFIS_ACESSO, PESOS_PERFIL } from '../constants/permissoes';

export { PERMISSOES, PERFIS_ACESSO, PESOS_PERFIL };

export function usePapel() {
  const { papel, permissoes = [] } = useOrg();

  // ── Hierarquia de pesos ──────────────────────────────────────────────────
  const getPeso = (p) => PESOS_PERFIL[p] || 0;
  const meuPeso = getPeso(papel);

  /**
   * Retorna true se o usuário tem peso >= ao nível solicitado.
   * @param {'DONO'|'NIVEL_5'|'NIVEL_4'|'NIVEL_3'|'NIVEL_2'|'NIVEL_1'} nivel
   */
  const isAtLeast = (nivel) => meuPeso >= getPeso(nivel);

  /**
   * Helper central para verificar se o usuário possui a permissão no array
   * retornado pela API ou aplica o fallback pelo peso do perfil padrão.
   * @param {string} code Código canônico da permissão (ex: PERMISSOES.AGENDA_VER)
   * @param {'DONO'|'NIVEL_5'|'NIVEL_4'|'NIVEL_3'|'NIVEL_2'|'NIVEL_1'} fallbackLevel
   */
  const hasPerm = (code, fallbackLevel) => {
    if (permissoes && permissoes.length > 0) {
      // Dono sempre tem controle absoluto
      if (papel === PERFIS_ACESSO.DONO) return true;
      return permissoes.includes(code);
    }
    return isAtLeast(fallbackLevel);
  };

  /**
   * Verifica se o usuário possui TODAS as permissões especificadas.
   * @param {string[]} codes
   * @param {'DONO'|'NIVEL_5'|'NIVEL_4'|'NIVEL_3'|'NIVEL_2'|'NIVEL_1'} [fallbackLevel]
   */
  const hasAllPerms = (codes = [], fallbackLevel) => {
    return codes.every(c => hasPerm(c, fallbackLevel));
  };

  /**
   * Verifica se o usuário possui AO MENOS UMA das permissões especificadas.
   * @param {string[]} codes
   * @param {'DONO'|'NIVEL_5'|'NIVEL_4'|'NIVEL_3'|'NIVEL_2'|'NIVEL_1'} [fallbackLevel]
   */
  const hasAnyPerm = (codes = [], fallbackLevel) => {
    return codes.some(c => hasPerm(c, fallbackLevel));
  };

  // ── Flags de identidade e nível ──────────────────────────────────────────
  const isDono          = papel === PERFIS_ACESSO.DONO;
  const isAdmin         = papel === PERFIS_ACESSO.ADMIN || isDono || papel === PERFIS_ACESSO.NIVEL_5 || papel === PERFIS_ACESSO.ADMINISTRADOR;
  const isSocio         = papel === PERFIS_ACESSO.SOCIO;
  const isMedico        = papel === PERFIS_ACESSO.MEDICO;
  const isEnfermeiro    = papel === PERFIS_ACESSO.ENFERMEIRO;
  const isBiomedico     = papel === PERFIS_ACESSO.BIOMEDICO;
  const isProfissional  = papel === PERFIS_ACESSO.PROFISSIONAL || isMedico || isEnfermeiro || isBiomedico || isAtLeast(PERFIS_ACESSO.NIVEL_3);
  const isRecepcionista = papel === PERFIS_ACESSO.RECEPCIONISTA || papel === PERFIS_ACESSO.SECRETARIA || isAtLeast(PERFIS_ACESSO.NIVEL_2);
  const isCustomProfile = typeof papel === 'string' && papel.startsWith('CST_');
  const isNivel1        = papel === PERFIS_ACESSO.NIVEL_1 || papel === PERFIS_ACESSO.APOIO || (!isCustomProfile && meuPeso <= 10);

  // ── Módulo: Agenda ───────────────────────────────────────────────────────
  const canSeeAgenda            = hasPerm(PERMISSOES.AGENDA_VER, PERFIS_ACESSO.NIVEL_1);
  const canCreateAgenda         = hasPerm(PERMISSOES.AGENDA_CRIAR, PERFIS_ACESSO.NIVEL_2);
  const canEditAgenda           = hasPerm(PERMISSOES.AGENDA_EDITAR, PERFIS_ACESSO.NIVEL_2);
  const canDeleteAgenda         = hasPerm(PERMISSOES.AGENDA_EXCLUIR, PERFIS_ACESSO.NIVEL_3);
  const canWriteAgenda          = canCreateAgenda || canEditAgenda;
  const canManageBloqueiosAgenda = hasPerm(PERMISSOES.AGENDA_BLOQUEIO_GERENCIAR, PERFIS_ACESSO.NIVEL_3);
  const canManageConfirmacoes   = hasPerm(PERMISSOES.CONFIRMACAO_GERENCIAR, PERFIS_ACESSO.NIVEL_2);
  const canSeeAgendaMulti       = hasPerm(PERMISSOES.AGENDA_MULTI_VER, PERFIS_ACESSO.NIVEL_2);
  const canSeeAgendaPropria     = hasPerm(PERMISSOES.AGENDA_PROPRIA_VER, PERFIS_ACESSO.NIVEL_3);
  const canEncaixarForaDisp     = hasPerm(PERMISSOES.AGENDA_FORA_DISP_ENCAIXAR, PERFIS_ACESSO.NIVEL_4);

  // ── Módulo: Pacientes ────────────────────────────────────────────────────
  const canSeePacientes         = hasPerm(PERMISSOES.PACIENTE_VER, PERFIS_ACESSO.NIVEL_1);
  const canCreatePacientes      = hasPerm(PERMISSOES.PACIENTE_CRIAR, PERFIS_ACESSO.NIVEL_2);
  const canEditPacientes        = hasPerm(PERMISSOES.PACIENTE_EDITAR, PERFIS_ACESSO.NIVEL_2);
  const canWritePacientes       = canEditPacientes; // alias legado
  const canInativarPacientes    = hasPerm(PERMISSOES.PACIENTE_EXCLUIR, PERFIS_ACESSO.NIVEL_3);
  const canReativarPacientes    = hasPerm(PERMISSOES.PACIENTE_EXCLUIR, PERFIS_ACESSO.NIVEL_3);

  // ── Módulo: Galeria Clínica ──────────────────────────────────────────────
  const canSeeGaleria           = hasPerm(PERMISSOES.PACIENTE_GALERIA_VER, PERFIS_ACESSO.NIVEL_3);

  // ── Módulo: Anamnese ─────────────────────────────────────────────────────
  const canSeeRespostasAnamnese = hasPerm(PERMISSOES.ANAMNESE_PREENCHIMENTO_VER, PERFIS_ACESSO.NIVEL_3);
  const canStartAnamnese        = hasPerm(PERMISSOES.ANAMNESE_PREENCHIMENTO_CRIAR, PERFIS_ACESSO.NIVEL_3);
  const canSeeConfigAnamnese    = hasPerm(PERMISSOES.ANAMNESE_MODELO_VER, PERFIS_ACESSO.NIVEL_3);
  const canConfigModelosAnamnese= hasPerm(PERMISSOES.ANAMNESE_MODELO_EDITAR, PERFIS_ACESSO.NIVEL_4);
  const canSeeHubAnamnese       = hasPerm(PERMISSOES.HUB_ANAMNESE_VER, PERFIS_ACESSO.NIVEL_2);

  // ── Módulo: Prontuário & Atendimento ─────────────────────────────────────
  const canSeeProntuario        = hasPerm(PERMISSOES.PRONTUARIO_VER, PERFIS_ACESSO.NIVEL_3);
  const canCreateProntuario     = hasPerm(PERMISSOES.PRONTUARIO_CRIAR, PERFIS_ACESSO.NIVEL_3);
  const canSeeNotasPaciente     = hasPerm(PERMISSOES.PACIENTE_NOTA_VER, PERFIS_ACESSO.NIVEL_3);
  const canCreateNotaPaciente   = hasPerm(PERMISSOES.PACIENTE_NOTA_CRIAR, PERFIS_ACESSO.NIVEL_2);
  const canEditNotaPaciente     = hasPerm(PERMISSOES.PACIENTE_NOTA_EDITAR, PERFIS_ACESSO.NIVEL_4);
  const canManageEvolucoes      = hasPerm(PERMISSOES.EVOLUCAO_GERENCIAR, PERFIS_ACESSO.NIVEL_3);
  const canManageOrientacoes    = hasPerm(PERMISSOES.ORIENTACAO_GERENCIAR, PERFIS_ACESSO.NIVEL_3);
  const canSeeHubAvaliacao      = hasPerm(PERMISSOES.HUB_AVALIACAO_VER, PERFIS_ACESSO.NIVEL_2);
  const canExecuteHubProcedimento = hasPerm(PERMISSOES.HUB_PROCEDIMENTO_EXECUTAR, PERFIS_ACESSO.NIVEL_3);
  const canSeeHubOrientacao     = hasPerm(PERMISSOES.HUB_ORIENTACAO_VER, PERFIS_ACESSO.NIVEL_2);

  // ── Módulo: Documentos & Assinaturas ─────────────────────────────────────
  const canSeeDocumentos        = hasPerm(PERMISSOES.PACIENTE_DOCUMENTO_VER, PERFIS_ACESSO.NIVEL_3);
  const canCreateAssinaturaDigital = hasPerm(PERMISSOES.DOCUMENTO_ASSINATURA_CRIAR, PERFIS_ACESSO.NIVEL_2);
  const canSeeConfigTermos      = hasPerm(PERMISSOES.DOC_MODELO_VER, PERFIS_ACESSO.NIVEL_4);
  const canEditConfigTermos     = hasPerm(PERMISSOES.DOC_MODELO_EDITAR, PERFIS_ACESSO.NIVEL_5);
  const canSeeHubTermos         = hasPerm(PERMISSOES.HUB_TERMOS_VER, PERFIS_ACESSO.NIVEL_2);

  // ── Módulo: Catálogo de Procedimentos & Orçamentos ────────────────────────
  const canSeeConfigProcedimentos = hasPerm(PERMISSOES.CATALOGO_VER, PERFIS_ACESSO.NIVEL_4);
  const canEditConfigProcedimentos= hasPerm(PERMISSOES.CATALOGO_EDITAR, PERFIS_ACESSO.NIVEL_4);
  const canEditPrecos           = hasPerm(PERMISSOES.PRECOS_EDITAR, PERFIS_ACESSO.NIVEL_5);
  const canSeeOrcamentos        = hasPerm(PERMISSOES.PACIENTE_ORCAMENTO_VER, PERFIS_ACESSO.NIVEL_2);
  const canEditPrecosOrcados    = hasPerm(PERMISSOES.PACIENTE_ORCAMENTO_EDITAR, PERFIS_ACESSO.NIVEL_4);

  // ── Módulo: Clínica & Parâmetros ─────────────────────────────────────────
  const canSeeConfigClinica     = hasPerm(PERMISSOES.CLINICA_EDITAR, PERFIS_ACESSO.NIVEL_5);
  const canSeeConfigAgenda      = hasPerm(PERMISSOES.HORARIO_EDITAR, PERFIS_ACESSO.NIVEL_5) || 
                                  hasPerm(PERMISSOES.FERIADO_EDITAR, PERFIS_ACESSO.NIVEL_5) || 
                                  isAtLeast(PERFIS_ACESSO.NIVEL_5);
  const canManageEspecialidades = hasPerm(PERMISSOES.ESPECIALIDADE_GERENCIAR, PERFIS_ACESSO.NIVEL_5);

  // ── Módulo: Equipe & Perfis ──────────────────────────────────────────────
  const canSeeConfigEquipe      = hasPerm(PERMISSOES.USUARIO_VER, PERFIS_ACESSO.NIVEL_5);
  const canCreateUsers          = hasPerm(PERMISSOES.USUARIO_CRIAR, PERFIS_ACESSO.NIVEL_5);
  const canManageUsers          = isDono || hasPerm(PERMISSOES.USUARIO_EDITAR, PERFIS_ACESSO.NIVEL_5);
  const canDeleteUsers          = hasPerm(PERMISSOES.USUARIO_EXCLUIR, PERFIS_ACESSO.NIVEL_5);
  const canSeeConfigPerfil      = hasPerm(PERMISSOES.PERFIL_ACESSO_VER, PERFIS_ACESSO.NIVEL_4) || isAtLeast(PERFIS_ACESSO.NIVEL_4);
  const canEditConfigPerfil     = hasPerm(PERMISSOES.PERFIL_ACESSO_EDITAR, PERFIS_ACESSO.NIVEL_5);

  // ── Módulo: Sistema & Auditoria ──────────────────────────────────────────
  const canSeeConfigAuditoria   = hasPerm(PERMISSOES.AUDITORIA_VER, PERFIS_ACESSO.NIVEL_5);
  const canExportPdf            = hasPerm(PERMISSOES.PDF_EXPORTAR, PERFIS_ACESSO.NIVEL_5);
  const canSeeNotificacoes      = hasPerm(PERMISSOES.NOTIFICACAO_VER, PERFIS_ACESSO.NIVEL_1);
  const canManageMsgTemplates   = hasPerm(PERMISSOES.MSG_TEMPLATE_GERENCIAR, PERFIS_ACESSO.NIVEL_5);

  // Acesso geral a configurações
  const canSeeConfig = canSeeConfigAnamnese || 
                       canSeeConfigProcedimentos || 
                       canSeeConfigTermos || 
                       canSeeConfigPerfil || 
                       canSeeConfigClinica || 
                       canSeeConfigAgenda || 
                       canSeeConfigEquipe || 
                       canSeeConfigAuditoria || 
                       isAtLeast(PERFIS_ACESSO.NIVEL_3);

  return {
    papel,
    permissoes,
    PERMISSOES,
    PERFIS_ACESSO,

    // Legado & Identidade
    isAdmin,
    isSocio,
    isMedico,
    isEnfermeiro,
    isBiomedico,
    isProfissional,
    isRecepcionista,
    isDono,
    isNivel1,
    isAtLeast,
    hasPerm,
    hasAllPerms,
    hasAnyPerm,

    // Navegação Principal
    canSeePacientes,
    canSeeAgenda,
    canSeeConfig,

    // Agenda
    canCreateAgenda,
    canEditAgenda,
    canDeleteAgenda,
    canWriteAgenda,
    canManageBloqueiosAgenda,
    canManageConfirmacoes,
    canSeeAgendaMulti,
    canSeeAgendaPropria,
    canEncaixarForaDisp,

    // Pacientes
    canCreatePacientes,
    canEditPacientes,
    canWritePacientes,
    canInativarPacientes,
    canReativarPacientes,

    // Galeria Clínica
    canSeeGaleria,

    // Anamnese
    canSeeRespostasAnamnese,
    canStartAnamnese,
    canSeeConfigAnamnese,
    canConfigModelosAnamnese,
    canSeeHubAnamnese,

    // Prontuário & Atendimento
    canSeeProntuario,
    canCreateProntuario,
    canSeeNotasPaciente,
    canCreateNotaPaciente,
    canEditNotaPaciente,
    canManageEvolucoes,
    canManageOrientacoes,
    canSeeHubAvaliacao,
    canExecuteHubProcedimento,
    canSeeHubOrientacao,

    // Documentos & Assinaturas
    canSeeDocumentos,
    canCreateAssinaturaDigital,
    canSeeConfigTermos,
    canEditConfigTermos,
    canSeeHubTermos,

    // Catálogo & Orçamentos
    canSeeConfigProcedimentos,
    canEditConfigProcedimentos,
    canEditPrecos,
    canSeeOrcamentos,
    canEditPrecosOrcados,

    // Clínica & Configurações
    canSeeConfigClinica,
    canSeeConfigAgenda,
    canManageEspecialidades,

    // Equipe & Gestão
    canSeeConfigEquipe,
    canCreateUsers,
    canManageUsers,
    canDeleteUsers,
    canSeeConfigPerfil,
    canEditConfigPerfil,

    // Sistema
    canSeeConfigAuditoria,
    canExportPdf,
    canSeeNotificacoes,
    canManageMsgTemplates,
  };
}
