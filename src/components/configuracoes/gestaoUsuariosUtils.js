// Utilitários compartilhados entre InviteModal e EditRoleModal.
import { resolveApiUrl } from '../../config/apiEnv';

// Ordenação clínica canônica para os perfis de acesso do sistema
export const CODIGO_ORDER = {
  DONO: 1,
  ADMINISTRADOR: 2,
  NIVEL_5: 2,
  SOCIO: 3,
  PROFISSIONAL_CLINICO: 4,
  MEDICO: 4,
  NIVEL_4: 4,
  ENFERMEIRO: 4,
  BIOMEDICO: 4,
  NIVEL_3: 4,
  SECRETARIA: 5,
  NIVEL_2: 5,
  APOIO: 6,
  NIVEL_1: 6,
};

// Rótulos curtos pros módulos nas barrinhas de cobertura dos cards.
export const MODULO_LABEL_CURTO = {
  AGENDA: 'Agenda',
  PACIENTES: 'Pac.',
  ATENDIMENTO: 'Atendimento',
  ANAMNESE: 'Anamn.',
  PRONTUARIO: 'Pront.',
  'PRONTUÁRIO': 'Pront.',
  DOCUMENTOS: 'Docs',
  CATALOGO: 'Catál.',
  'CATÁLOGO': 'Catál.',
  CLINICA: 'Clínica',
  'CLÍNICA': 'Clínica',
  EQUIPE: 'Equipe',
  EQUIPE_SISTEMA: 'Equipe',
  SISTEMA: 'Sistema',
};

// Ordenação clínica canônica para os cargos do sistema
export const ROLE_DISPLAY_ORDER = {
  ADMINISTRADOR: 1,
  GERENTE: 2,
  SOCIO: 3,
  MEDICO: 4,
  DENTISTA: 5,
  BIOMEDICO: 6,
  ESTETICISTA: 7,
  ENFERMEIRO: 8,
  RECEPCIONISTA: 9,
  SECRETARIA: 10,
  APOIO: 11,
  OUTRO: 12,
};

const CARGO_DISPLAY_LABELS = {
  ADMINISTRADOR: 'Administrador',
  GERENTE: 'Gerente',
  SOCIO: 'Sócio / Investidor',
  MEDICO: 'Médico',
  DENTISTA: 'Dentista',
  BIOMEDICO: 'Biomédico',
  ESTETICISTA: 'Esteticista',
  ENFERMEIRO: 'Enfermeiro(a)',
  RECEPCIONISTA: 'Recepcionista',
  SECRETARIA: 'Secretária',
  APOIO: 'Auxiliar / Apoio',
  OUTRO: 'Outro',
  PROFISSIONAL: 'Profissional / Médico',
};

/** Formata o nome de um Cargo (ex.: "medico") para exibição (ex.: "Médico"). */
export const formatCargoLabel = (nome) => {
  if (!nome) return '';
  const label = CARGO_DISPLAY_LABELS[nome.toUpperCase()];
  if (label) return label;
  return nome.charAt(0).toUpperCase() + nome.slice(1).toLowerCase();
};

/**
 * As permissões de cada Perfil são gerenciadas como fonte única da verdade no backend
 * (tb_perfil_acesso_permissao) e carregadas dinamicamente via GET /api/v1/perfis-acesso/{id}/permissoes.
 */
export const getPermissoesPadraoPorPerfilId = () => [];


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
    body: JSON.stringify({
      nome,
      descricao: descricao || '',
    })
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
