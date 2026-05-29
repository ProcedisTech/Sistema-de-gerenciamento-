import { useOrg } from '../contexts/OrgContext';

export function usePapel() {
  const { papel } = useOrg();

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

  // ── Flags legadas (mantidas para não quebrar código existente) ───────────
  const isDono          = papel === 'DONO';
  const isAdmin         = papel === 'ADMIN' || isDono || papel === 'NIVEL_5';
  const isProfissional  = papel === 'PROFISSIONAL' || isAtLeast('NIVEL_3');
  const isRecepcionista = papel === 'RECEPCIONISTA' || isAtLeast('NIVEL_2');
  const isNivel1        = papel === 'NIVEL_1' || meuPeso <= 10;

  // ── Navegação principal ──────────────────────────────────────────────────
  /** Todos os níveis podem ver Pacientes e Agenda */
  const canSeePacientes = true;
  const canSeeAgenda    = true;
  /** Configurações: N3 ou superior */
  const canSeeConfig    = isAtLeast('NIVEL_3');

  // ── Ações dentro de Pacientes ────────────────────────────────────────────
  /** N1 = apenas leitura; N2+ = criação/edição */
  const canWritePacientes   = isAtLeast('NIVEL_2'); // alias legado
  const canCreatePacientes  = isAtLeast('NIVEL_2'); // cadastrar novo paciente
  const canEditPacientes    = isAtLeast('NIVEL_2'); // editar ficha do paciente
  /** Inativar/excluir é ação mais destrutiva — requer N3+ */
  const canInativarPacientes = isAtLeast('NIVEL_3');

  // ── Ações dentro de Agenda ───────────────────────────────────────────────
  /** N1 = apenas leitura; N2+ = criar/editar/cancelar agendamentos */
  const canWriteAgenda = isAtLeast('NIVEL_2');

  // ── Seções de Configurações ──────────────────────────────────────────────
  /**
   * Anamnese (categorias, perguntas, fichas): N3+
   * Único grupo visível para N3.
   */
  const canSeeConfigAnamnese = isAtLeast('NIVEL_3');

  /**
   * Procedimentos + Termos de Consentimento: N4+
   */
  const canSeeConfigProcedimentos = isAtLeast('NIVEL_4');
  const canSeeConfigTermos        = isAtLeast('NIVEL_4');

  /**
   * Perfil do Profissional: N4+
   */
  const canSeeConfigPerfil = isAtLeast('NIVEL_4');

  /**
   * Dados da Clínica (grupo "Sistema"): N5+
   */
  const canSeeConfigClinica = isAtLeast('NIVEL_5');

  /**
   * Agenda — horários, feriados, templates: N5+
   */
  const canSeeConfigAgenda = isAtLeast('NIVEL_5');

  /**
   * Equipe — usuários e acessos, pacientes inativados: N5+
   */
  const canSeeConfigEquipe = isAtLeast('NIVEL_5');

  /** Auditoria: apenas Dono ou N5 */
  const canSeeConfigAuditoria = isAtLeast('NIVEL_5');

  /**
   * Gerenciar usuários (criar / editar nível e cargo): Dono ou N5
   */
  const canManageUsers = isDono || isAtLeast('NIVEL_5');

  return {
    papel,

    // Legado
    isAdmin,
    isProfissional,
    isRecepcionista,
    isAtLeast,

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

    // Gerência
    canManageUsers,
  };
}
