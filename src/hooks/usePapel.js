import { useOrg } from '../contexts/OrgContext';

export function usePapel() {
  const { papel, permissoes = [] } = useOrg();

  // ── Hierarquia de pesos ──────────────────────────────────────────────────
  const pesos = {
    'DONO':        100,
    'NIVEL_5':      50,
    'NIVEL_4':      40,
    'NIVEL_3':      30,
    'NIVEL_2':      20,
    'NIVEL_1':      10,
    // Legado (mantido para retrocompatibilidade)
    'ADMIN':        50,
    'PROFISSIONAL': 30,
    'RECEPCIONISTA':20,
  };

  const getPeso    = (p) => pesos[p] || 0;
  const meuPeso    = getPeso(papel);

  /**
   * Retorna true se o usuário tem peso >= ao nível solicitado.
   * @param {'DONO'|'NIVEL_5'|'NIVEL_4'|'NIVEL_3'|'NIVEL_2'|'NIVEL_1'} nivel
   */
  const isAtLeast = (nivel) => meuPeso >= getPeso(nivel);

  // Helper para verificar a permissão no array ou fazer fallback no peso
  const hasPerm = (code, fallbackLevel) => {
    if (permissoes && permissoes.length > 0) {
      // Dono sempre pode tudo, mesmo se array estiver incompleto (por segurança)
      if (papel === 'DONO') return true;
      return permissoes.includes(code);
    }
    return isAtLeast(fallbackLevel);
  };

  // ── Flags legadas (mantidas para não quebrar código existente) ───────────
  const isDono          = papel === 'DONO';
  const isAdmin         = papel === 'ADMIN' || isDono || papel === 'NIVEL_5';
  const isProfissional  = papel === 'PROFISSIONAL' || isAtLeast('NIVEL_3');
  const isRecepcionista = papel === 'RECEPCIONISTA' || isAtLeast('NIVEL_2');
  const isCustomProfile = typeof papel === 'string' && papel.startsWith('CST_');
  const isNivel1        = papel === 'NIVEL_1' || (!isCustomProfile && meuPeso <= 10);

  // ── Navegação principal ──────────────────────────────────────────────────
  const canSeePacientes = hasPerm('PACIENTE_VER', 'NIVEL_1');
  const canSeeAgenda    = hasPerm('AGENDA_VER', 'NIVEL_1');
  
  // ── Ações dentro de Pacientes ────────────────────────────────────────────
  const canWritePacientes   = hasPerm('PACIENTE_EDITAR', 'NIVEL_2'); // alias legado
  const canCreatePacientes  = hasPerm('PACIENTE_CRIAR', 'NIVEL_2');
  const canEditPacientes    = hasPerm('PACIENTE_EDITAR', 'NIVEL_2');
  const canInativarPacientes = hasPerm('PACIENTE_EXCLUIR', 'NIVEL_3');
  const canReativarPacientes = hasPerm('PACIENTE_EXCLUIR', 'NIVEL_3');

  // ── Ações dentro de Agenda ───────────────────────────────────────────────
  const canWriteAgenda = hasPerm('AGENDA_CRIAR', 'NIVEL_2') || hasPerm('AGENDA_EDITAR', 'NIVEL_2');

  // ── Ações de Atendimento e Prontuário ────────────────────────────────────
  const canSeeProntuario = hasPerm('PRONTUARIO_VER', 'NIVEL_3');
  const canStartAnamnese = hasPerm('ANAMNESE_PREENCHIMENTO_CRIAR', 'NIVEL_3');
  const canCreateNotaPaciente = hasPerm('PACIENTE_NOTA_CRIAR', 'NIVEL_2');
  const canSeeGaleria = hasPerm('PACIENTE_GALERIA_VER', 'NIVEL_3');
  const canSeeDocumentos = hasPerm('PACIENTE_DOCUMENTO_VER', 'NIVEL_3');

  // ── Seções de Configurações ──────────────────────────────────────────────
  const canSeeConfigAnamnese = hasPerm('ANAMNESE_MODELO_VER', 'NIVEL_3');
  const canSeeConfigProcedimentos = hasPerm('CATALOGO_VER', 'NIVEL_4');
  const canSeeConfigTermos        = hasPerm('DOC_MODELO_VER', 'NIVEL_4');
  const canSeeConfigPerfil = hasPerm('PERFIL_ACESSO_VER', 'NIVEL_4') || isAtLeast('NIVEL_4');
  const canSeeConfigClinica = hasPerm('CLINICA_EDITAR', 'NIVEL_5');
  const canSeeConfigAgenda = hasPerm('HORARIO_EDITAR', 'NIVEL_5') || hasPerm('FERIADO_EDITAR', 'NIVEL_5') || isAtLeast('NIVEL_5');
  const canSeeConfigEquipe = hasPerm('USUARIO_VER', 'NIVEL_5');
  const canSeeConfigAuditoria = hasPerm('AUDITORIA_VER', 'NIVEL_5');

  const canSeeConfig = canSeeConfigAnamnese || canSeeConfigProcedimentos || canSeeConfigTermos || canSeeConfigPerfil || canSeeConfigClinica || canSeeConfigAgenda || canSeeConfigEquipe || canSeeConfigAuditoria || isAtLeast('NIVEL_3');

  // Gerenciar usuários (criar / editar nível e cargo): Dono ou quem tem USUARIO_EDITAR
  const canManageUsers = isDono || hasPerm('USUARIO_EDITAR', 'NIVEL_5');

  return {
    papel,

    // Legado
    isAdmin,
    isProfissional,
    isRecepcionista,
    isAtLeast,
    hasPerm,

    // Identidade
    isDono,
    isNivel1,

    // Navegação principal
    canSeePacientes,
    canSeeAgenda,
    canSeeConfig,

    // Ações por módulo
    canWritePacientes,
    canCreatePacientes,
    canEditPacientes,
    canInativarPacientes,
    canReativarPacientes,
    canWriteAgenda,

    // Seções de Configurações
    canSeeConfigAnamnese,
    canSeeConfigProcedimentos,
    canSeeConfigTermos,
    canSeeConfigPerfil,
    canSeeConfigClinica,
    canSeeConfigAgenda,
    canSeeConfigEquipe,
    canSeeConfigAuditoria,

    canSeeProntuario,
    canStartAnamnese,
    canCreateNotaPaciente,
    canSeeGaleria,
    canSeeDocumentos,

    // Gerência
    canManageUsers,
  };
}
