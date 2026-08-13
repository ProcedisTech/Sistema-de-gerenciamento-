// Utilitários compartilhados entre InviteModal e EditRoleModal.
import { resolveApiUrl } from '../../config/apiEnv';

const CARGO_DISPLAY_LABELS = {
  ADMINISTRADOR: 'Administrador',
  MEDICO: 'Médico',
  ESTETICISTA: 'Esteticista',
  RECEPCIONISTA: 'Recepcionista',
  DENTISTA: 'Dentista',
  BIOMEDICO: 'Biomédico',
  PROFISSIONAL: 'Profissional / Médico',
};

/** Formata o nome de um Cargo (ex.: "medico") para exibição (ex.: "Médico"). */
export const formatCargoLabel = (nome) => {
  if (!nome) return '';
  const label = CARGO_DISPLAY_LABELS[nome.toUpperCase()];
  if (label) return label;
  return nome.charAt(0).toUpperCase() + nome.slice(1).toLowerCase();
};

/** Dado o nome do Cargo selecionado, sugere o Nível de Permissão correspondente. */
export const getPresetProfileId = (roleName, perfis) => {
  if (!roleName) return null;
  const nameLower = roleName.toLowerCase();

  if (nameLower.includes('administrador') || nameLower === 'adm') {
    // Nível 5 - Administrador
    const match = perfis.find(p =>
      (p.nome || '').toLowerCase().includes('administrador') ||
      (p.codigo || '').toLowerCase().includes('nivel_5')
    );
    return match ? match.id : null;
  }

  if (nameLower.includes('medico') || nameLower.includes('esteticista') || nameLower.includes('dentista') || nameLower.includes('biomedico') || nameLower.includes('biomédico')) {
    // Nível 4 - Profissional Sênior
    const match = perfis.find(p =>
      (p.nome || '').toLowerCase().includes('sênior') ||
      (p.nome || '').toLowerCase().includes('senior') ||
      (p.codigo || '').toLowerCase().includes('nivel_4')
    );
    return match ? match.id : null;
  }

  if (nameLower.includes('profissional')) {
    // Nível 3 - Profissional Padrão
    const match = perfis.find(p =>
      (p.nome || '').toLowerCase().includes('padrão') ||
      (p.nome || '').toLowerCase().includes('padrao') ||
      (p.codigo || '').toLowerCase().includes('nivel_3')
    );
    return match ? match.id : null;
  }

  if (nameLower.includes('recepcionista') || nameLower.includes('recepcao')) {
    // Nível 2 - Recepção
    const match = perfis.find(p =>
      (p.nome || '').toLowerCase().includes('recepção') ||
      (p.nome || '').toLowerCase().includes('recepcao') ||
      (p.codigo || '').toLowerCase().includes('nivel_2')
    );
    return match ? match.id : null;
  }

  return null;
};

/**
 * Permissões padrão por Nível, usadas como ponto de partida no checklist quando a
 * clínica ainda não customizou aquele Nível (API retorna [] em
 * GET /api/v1/perfis-acesso/{id}/permissoes). Só pré-marca os checkboxes — o admin
 * pode editar livremente antes de salvar. Códigos que não existirem no catálogo da
 * clínica (`permissoes`) simplesmente não casam com nada, sem quebrar nada.
 */
export const DEFAULT_PERMISSOES_POR_NIVEL = {
  NIVEL_1: ['AGENDA_VER', 'PACIENTE_VER'],
  NIVEL_2: ['AGENDA_VER', 'PACIENTE_VER', 'AGENDA_CRIAR', 'AGENDA_EDITAR', 'CATALOGO_VER', 'PACIENTE_CRIAR', 'PACIENTE_EDITAR'],
  NIVEL_3: ['AGENDA_VER', 'PACIENTE_VER', 'AGENDA_CRIAR', 'AGENDA_EDITAR', 'CATALOGO_VER', 'PACIENTE_CRIAR', 'PACIENTE_EDITAR', 'PACIENTE_EXCLUIR', 'ANAMNESE_PREENCHIMENTO_CRIAR', 'PRONTUARIO_VER', 'PRONTUARIO_CRIAR', 'PACIENTE_NOTA_CRIAR', 'ANAMNESE_MODELO_VER', 'DOC_MODELO_VER', 'PACIENTE_GALERIA_VER', 'PACIENTE_DOCUMENTO_VER'],
  NIVEL_4: ['AGENDA_VER', 'PACIENTE_VER', 'AGENDA_CRIAR', 'AGENDA_EDITAR', 'CATALOGO_VER', 'PACIENTE_CRIAR', 'PACIENTE_EDITAR', 'PACIENTE_EXCLUIR', 'ANAMNESE_PREENCHIMENTO_CRIAR', 'PRONTUARIO_VER', 'PRONTUARIO_CRIAR', 'PACIENTE_NOTA_CRIAR', 'ANAMNESE_MODELO_VER', 'DOC_MODELO_VER', 'PACIENTE_GALERIA_VER', 'PACIENTE_DOCUMENTO_VER', 'CLINICA_EDITAR', 'HORARIO_EDITAR'],
  NIVEL_5: ['AGENDA_VER', 'PACIENTE_VER', 'AGENDA_CRIAR', 'AGENDA_EDITAR', 'CATALOGO_VER', 'PACIENTE_CRIAR', 'PACIENTE_EDITAR', 'PACIENTE_EXCLUIR', 'ANAMNESE_PREENCHIMENTO_CRIAR', 'PRONTUARIO_VER', 'PRONTUARIO_CRIAR', 'PACIENTE_NOTA_CRIAR', 'ANAMNESE_MODELO_VER', 'DOC_MODELO_VER', 'PACIENTE_GALERIA_VER', 'PACIENTE_DOCUMENTO_VER', 'CLINICA_EDITAR', 'HORARIO_EDITAR', 'USUARIO_VER', 'AUDITORIA_VER', 'PDF_EXPORTAR', 'PRECOS_EDITAR'],
};

/**
 * Resolve as permissões padrão de um Nível (por perfilAcessoId) para a lista de
 * permissaoId correspondente no catálogo atual da clínica.
 */
export const getPermissoesPadraoPorPerfilId = (perfilAcessoId, perfisAcesso, permissoes) => {
  const perfil = (perfisAcesso || []).find(p => String(p.id) === String(perfilAcessoId));
  const codigos = DEFAULT_PERMISSOES_POR_NIVEL[(perfil?.codigo || '').toUpperCase()] || [];
  return (permissoes || [])
    .filter(p => codigos.includes(p.codigo))
    .map(p => p.permissaoId);
};

/**
 * Cria um novo Perfil de Acesso (POST) e atribui a ele o conjunto de permissões
 * informado (PUT), usado pelo pop-up de "permissões customizadas" ao salvar um
 * membro com o checklist divergente do template do Nível selecionado.
 */
export const criarPerfilComPermissoes = async ({ nome, descricao, permissoes, fetchHeaders }) => {
  const res = await fetch(resolveApiUrl('/api/v1/perfis-acesso'), {
    method: 'POST',
    headers: { ...(await fetchHeaders()), 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ nome, descricao: descricao || '' })
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.message || 'Erro ao criar o novo perfil de acesso.');
  }
  const perfilCriado = await res.json();

  const putRes = await fetch(resolveApiUrl(`/api/v1/perfis-acesso/${perfilCriado.id}/permissoes`), {
    method: 'PUT',
    headers: { ...(await fetchHeaders()), 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(permissoes || [])
  });
  if (!putRes.ok) {
    throw new Error('Perfil criado, mas houve erro ao atribuir as permissões.');
  }

  return perfilCriado;
};
