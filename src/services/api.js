// Camada de acesso ao backend Spring Boot.
// Header X-Org-Id injetado automaticamente nas chamadas que exigem organização.

const DEFAULT_ORG_ID = 'b0000000-0000-0000-0000-000000000001';

let currentOrgId = DEFAULT_ORG_ID;

export function setOrgId(id) {
  currentOrgId = id || DEFAULT_ORG_ID;
}
export function getOrgId() {
  return currentOrgId;
}

async function request(path, { needsOrg = true, ...fetchOpts } = {}) {
  const headers = { 'Content-Type': 'application/json', ...fetchOpts.headers };
  if (needsOrg && currentOrgId) headers['X-Org-Id'] = currentOrgId;

  const res = await fetch(path, { ...fetchOpts, headers });

  if (res.status === 204) return null;
  if (!res.ok) {
    const body = await res.json().catch(() => ({ message: res.statusText }));
    const err = new Error(body.message || `HTTP ${res.status}`);
    err.status = res.status;
    err.body = body;
    throw err;
  }
  return res.json();
}

// ── Pacientes ──────────────────────────────────────────────

export const pacientesApi = {
  list: () => request('/api/v1/pacientes'),
  get: (id) => request(`/api/v1/pacientes/${id}`),
  search: (q) => request(`/api/v1/pacientes/search?q=${encodeURIComponent(q)}`),
  create: (data) => request('/api/v1/pacientes', { method: 'POST', body: JSON.stringify(data) }),
  update: (id, data) => request(`/api/v1/pacientes/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  remove: (id) => request(`/api/v1/pacientes/${id}`, { method: 'DELETE' }),
};

// ── Notas do paciente ──────────────────────────────────────

export const notasApi = {
  list: (pid) => request(`/api/v1/notas-paciente/paciente/${pid}`),
  create: (pid, data) =>
    request(`/api/v1/notas-paciente/paciente/${pid}`, { method: 'POST', body: JSON.stringify(data) }),
  update: (id, data) => request(`/api/v1/notas-paciente/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  remove: (id) => request(`/api/v1/notas-paciente/${id}`, { method: 'DELETE' }),
};

// ── Equipe / usuários ──────────────────────────────────────

export const equipeApi = {
  list: () => request('/api/v1/equipe'),
  get: (id) => request(`/api/v1/equipe/${id}`),
};

export const usuariosApi = {
  list: () => request('/api/v1/usuarios'),
  get: (id) => request(`/api/v1/usuarios/${id}`),
};

// ── Catálogo de procedimentos ───────────────────────────────

export const catalogosApi = {
  list: () => request('/api/v1/catalogos'),
  get: (id) => request(`/api/v1/catalogos/${id}`),
};

// ── Agenda ─────────────────────────────────────────────────

export const agendasApi = {
  get: (id) => request(`/api/v1/agendas/${id}`),
  byDate: (date) => request(`/api/v1/agendas/by-date?date=${date}`),
  byRange: (start, end) => request(`/api/v1/agendas/by-range?start=${start}&end=${end}`),
  byProfissional: (roleUserId, date) =>
    request(`/api/v1/agendas/by-profissional?roleUserId=${roleUserId}&date=${date}`),
  create: (data) => request('/api/v1/agendas', { method: 'POST', body: JSON.stringify(data) }),
  update: (id, data) => request(`/api/v1/agendas/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  cancelar: (id) => request(`/api/v1/agendas/${id}/cancelar`, { method: 'PATCH' }),
};

/**
 * Compromissos no slot (tb_agendamento): paciente + catálogo sem ProcedimentoFeito.
 * GET …/agendas/{agendaId}/agendamentos · POST /agendamentos · DELETE /agendamentos/{id}
 */
export const agendamentosApi = {
  listByAgenda: (agendaId) => request(`/api/v1/agendas/${agendaId}/agendamentos`),
  create: (body) => request('/api/v1/agendamentos', { method: 'POST', body: JSON.stringify(body) }),
  remove: (id) => request(`/api/v1/agendamentos/${id}`, { method: 'DELETE' }),
};

// ── Procedimentos ──────────────────────────────────────────

export const procedimentosApi = {
  byPaciente: (pid) => request(`/api/v1/procedimentos/paciente/${pid}`),
  create: (data) => request('/api/v1/procedimentos', { method: 'POST', body: JSON.stringify(data) }),
  iniciar: (data) => request('/api/v1/procedimentos/iniciar', { method: 'POST', body: JSON.stringify(data) }),
  patchStatus: (id, statusId) =>
    request(`/api/v1/procedimentos/${id}/status?statusId=${encodeURIComponent(statusId)}`, {
      method: 'PATCH',
    }),
  finalizar: (id) => request(`/api/v1/procedimentos/${id}/finalizar`, { method: 'PATCH' }),
};

// ── Dimensões (sem X-Org-Id) ───────────────────────────────

export const dimensoesApi = {
  estadosCivis: () => request('/api/v1/dimensoes/estados-civis', { needsOrg: false }),
  especialidades: () => request('/api/v1/dimensoes/especialidades', { needsOrg: false }),
  tiposResposta: () => request('/api/v1/dimensoes/tipos-resposta', { needsOrg: false }),
  roles: () => request('/api/v1/dimensoes/roles', { needsOrg: false }),
  statusProcedimento: () => request('/api/v1/dimensoes/status-procedimento', { needsOrg: false }),
  statusAgenda: () => request('/api/v1/dimensoes/status-agenda', { needsOrg: false }),
  statusAnamnese: () => request('/api/v1/dimensoes/status-anamnese', { needsOrg: false }),
  periodosDia: () => request('/api/v1/dimensoes/periodos-dia', { needsOrg: false }),
};

// ── Anamnese ───────────────────────────────────────────────

export const anamneseApi = {
  listCategorias: () => request('/api/v1/anamnese/categorias', { needsOrg: false }),
  createCategoria: (data) =>
    request('/api/v1/anamnese/categorias', { method: 'POST', body: JSON.stringify(data), needsOrg: false }),

  listHabitos: (catId) =>
    request(`/api/v1/anamnese/habitos?categoriaId=${catId}`, { needsOrg: false }),
  listAllHabitos: async () => {
    const cats = await request('/api/v1/anamnese/categorias', { needsOrg: false });
    if (!Array.isArray(cats) || cats.length === 0) return [];
    const results = await Promise.all(
      cats.map((c) =>
        request(`/api/v1/anamnese/habitos?categoriaId=${c.id}`, { needsOrg: false }).catch(() => [])
      )
    );
    return results.flat();
  },
  createHabito: (data) => request('/api/v1/anamnese/habitos', { method: 'POST', body: JSON.stringify(data), needsOrg: false }),

  addAlternativas: (habitoId, data) =>
    request(`/api/v1/anamnese/habitos/${habitoId}/alternativas`, {
      method: 'POST',
      body: JSON.stringify(data),
      needsOrg: false,
    }),

  listFichas: () => request('/api/v1/anamnese/fichas'),
  getFicha: (id) => request(`/api/v1/anamnese/fichas/${id}`),
  createFicha: (data) => request('/api/v1/anamnese/fichas', { method: 'POST', body: JSON.stringify(data) }),
  updateFicha: (id, data) => request(`/api/v1/anamnese/fichas/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  removeFicha: (id) => request(`/api/v1/anamnese/fichas/${id}`, { method: 'DELETE' }),

  listPaciente: (pid) => request(`/api/v1/anamnese/paciente/${pid}`),
  getPaciente: (pid, aid) => request(`/api/v1/anamnese/paciente/${pid}/${aid}`),
  createPaciente: (pid, roleId, data) =>
    request(`/api/v1/anamnese/paciente/${pid}?roleUserId=${roleId}`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  finalizarPaciente: (pid, aid) =>
    request(`/api/v1/anamnese/paciente/${pid}/${aid}/finalizar`, { method: 'PATCH' }),
};
