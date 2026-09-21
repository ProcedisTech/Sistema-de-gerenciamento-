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

/** Dado o nome ou objeto do Cargo selecionado, sugere o Perfil de Acesso correspondente. */
export const getPresetProfileId = (roleOrRoleName, perfis = []) => {
  if (!roleOrRoleName) return null;
  if (typeof roleOrRoleName === 'object' && roleOrRoleName.perfilAcessoPadraoId) {
    const directMatch = perfis.find(p => String(p.id) === String(roleOrRoleName.perfilAcessoPadraoId));
    if (directMatch) return directMatch.id;
  }
  const roleName = typeof roleOrRoleName === 'object' ? roleOrRoleName.nome : roleOrRoleName;
  if (!roleName) return null;
  const nameLower = roleName.toLowerCase();

  // Sócio / Investidor
  if (nameLower.includes('socio') || nameLower.includes('sócio')) {
    const match = perfis.find(p =>
      (p.codigo || '').toUpperCase() === 'SOCIO' ||
      (p.nome || '').toLowerCase().includes('sócio') ||
      (p.nome || '').toLowerCase().includes('socio') ||
      (p.codigo || '').toUpperCase() === 'NIVEL_5'
    );
    if (match) return match.id;
  }

  // Administrador / Gerente
  if (nameLower.includes('administrador') || nameLower.includes('gerente') || nameLower === 'adm' || nameLower === 'admin') {
    const match = perfis.find(p =>
      (p.codigo || '').toUpperCase() === 'ADMINISTRADOR' ||
      (p.nome || '').toLowerCase().includes('administrador') ||
      (p.codigo || '').toUpperCase() === 'NIVEL_5'
    );
    if (match) return match.id;
  }

  // Profissional Clínico (Médico, Dentista, Enfermeiro, Biomédico, Esteticista, etc.)
  if (
    nameLower.includes('medico') || nameLower.includes('médico') ||
    nameLower.includes('dentista') || nameLower.includes('responsavel') ||
    nameLower.includes('enfermeir') ||
    nameLower.includes('biomedic') || nameLower.includes('biomédic') ||
    nameLower.includes('estetic') ||
    nameLower.includes('saude') || nameLower.includes('saúde') ||
    nameLower.includes('clinico') || nameLower.includes('clínico')
  ) {
    const match = perfis.find(p =>
      (p.codigo || '').toUpperCase() === 'PROFISSIONAL_CLINICO' ||
      (p.nome || '').toLowerCase().includes('profissional clínico') ||
      (p.nome || '').toLowerCase().includes('profissional clinico') ||
      (p.codigo || '').toUpperCase() === 'MEDICO' ||
      (p.codigo || '').toUpperCase() === 'NIVEL_4' ||
      (p.codigo || '').toUpperCase() === 'BIOMEDICO' ||
      (p.codigo || '').toUpperCase() === 'ENFERMEIRO' ||
      (p.codigo || '').toUpperCase() === 'NIVEL_3'
    );
    if (match) return match.id;
  }

  // Recepção / Secretária
  if (
    nameLower.includes('recepcionista') || nameLower.includes('recepcao') || nameLower.includes('recepção') ||
    nameLower.includes('secretari') || nameLower.includes('secretári') || nameLower.includes('atend')
  ) {
    const match = perfis.find(p =>
      (p.codigo || '').toUpperCase() === 'SECRETARIA' ||
      (p.nome || '').toLowerCase().includes('secretár') ||
      (p.nome || '').toLowerCase().includes('secretar') ||
      (p.nome || '').toLowerCase().includes('recepção') ||
      (p.nome || '').toLowerCase().includes('recepcao') ||
      (p.codigo || '').toUpperCase() === 'NIVEL_2'
    );
    if (match) return match.id;
  }

  // Apoio / Básico
  const apoioMatch = perfis.find(p =>
    (p.codigo || '').toUpperCase() === 'APOIO' ||
    (p.nome || '').toLowerCase().includes('apoio') ||
    (p.codigo || '').toUpperCase() === 'NIVEL_1'
  );
  return apoioMatch ? apoioMatch.id : null;
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
