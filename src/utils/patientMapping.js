import { calculateAgeFromISODate } from '../components/utils/formatters';
import { resolveApiUrl } from '../config/apiEnv.js';

/** Códigos de sexo aceitos na API (Spring): M, F, N (prefiro não dizer / não declarado). */
export function normalizeSexoForApi(raw) {
  const u = String(raw ?? '').trim().toUpperCase();
  if (u === 'F' || u === 'M' || u === 'N') return u;
  return null;
}

/**
 * Backend pode enviar path relativo à API (ex. /api/v1/pacientes/{id}/foto-perfil?v=…).
 * Com front em outro host (Netlify), precisamos prefixar VITE_API_BASE_URL para o <img> carregar.
 */
function normalizeFotoPerfilUrl(raw) {
  if (typeof raw !== 'string') return '';
  const t = raw.trim();
  if (!t) return '';
  if (t.startsWith('http://') || t.startsWith('https://') || t.startsWith('data:')) return t;
  if (t.startsWith('/')) return resolveApiUrl(t);
  return t;
}

/** Shape usada nas telas (lista, jornada, perfil). */
export function mapBackendPatient(dto) {
  if (!dto) return null;
  /** Contrato atual: fotoPerfilUrl (path /api/v1/.../foto-perfil?v=… ou URL absoluta). Aliases só para legado. */
  const rawFoto =
    (typeof dto.fotoPerfilUrl === 'string' && dto.fotoPerfilUrl.trim()) ||
    (typeof dto.urlFotoPerfil === 'string' && dto.urlFotoPerfil.trim()) ||
    (typeof dto.fotoUrl === 'string' && dto.fotoUrl.trim()) ||
    '';
  return {
    id: dto.id,
    nome: dto.nomeCompleto || '',
    dataNascimento: dto.dataNascimento || '',
    idade: calculateAgeFromISODate(dto.dataNascimento),
    sexo: (dto.sexo || '').toLowerCase(),
    estadoCivil: dto.estadoCivilNome || '',
    estadoCivilId: dto.estadoCivilId || '',
    profissao: dto.profissao || '',
    alergias: '',
    cpf: dto.cpf || '',
    rg: dto.rg || '',
    telefone: dto.telefone || '',
    email: dto.email || '',
    endereco: dto.endereco || '',
    instagram: dto.instagram || '',
    tiktok: dto.tiktok || '',
    nomeMae: dto.nomeMae || '',
    nomePai: dto.nomePai || '',
    indicacao: dto.indicacao || '',
    genero: dto.genero || '',
    status: dto.ativo !== false ? 'ativo' : 'inativo',
    /** Canônico no Spring: só fotoPerfilUrl; aliases no front são opcionais. */
    fotoPerfilUrl: rawFoto ? normalizeFotoPerfilUrl(rawFoto) : '',
    ultimaVisita: '',
    proximoRetorno: '',
    saldoDevedor: 0,
    lgpdAssinado: false,
    lgpdRenovacao: '',
    medicamentos: [],
    condicoesSaude: '',
    queixasEsteticas: [],
    cirurgiasAnteriores: '',
    observacoesImportantes: '',
    procedures: [],
    notas: [],
    galeria: [],
  };
}

/** Monta PacienteCreateDTO a partir do check-in da jornada (paciente novo). */
export function journeyToPacienteCreateDTO(j) {
  return {
    nomeCompleto: (j.nome || '').trim(),
    dataNascimento: j.dataNascimento || null,
    cpf: String(j.cpf || '').replace(/\D/g, '') || null,
    rg: String(j.rg || '').replace(/\D/g, '') || null,
    telefone: (j.telefone || '').trim() || null,
    email: (j.email || '').trim() || null,
    profissao: (j.profissao || '').trim() || null,
    sexo: normalizeSexoForApi(j.sexo),
    estadoCivilId: j.estadoCivilId || undefined,
    endereco: (j.endereco || '').trim() || null,
  };
}

/** Mescla edição leve do perfil em PacienteCreateDTO para PUT completo. */
export function patientToPacienteUpdateDTO(patient, editing) {
  return {
    nomeCompleto: (editing?.nome ?? patient.nome ?? '').trim(),
    dataNascimento: patient.dataNascimento || null,
    cpf: String(patient.cpf || '').replace(/\D/g, '') || null,
    rg: String(patient.rg || '').replace(/\D/g, '') || null,
    telefone: (editing?.telefone ?? patient.telefone ?? '').trim() || null,
    email: (editing?.email ?? patient.email ?? '').trim() || null,
    profissao: (editing?.profissao ?? patient.profissao ?? '').trim() || null,
    sexo: normalizeSexoForApi(editing?.sexo ?? patient.sexo),
    instagram: patient.instagram || null,
    tiktok: patient.tiktok || null,
    nomeMae: patient.nomeMae || null,
    nomePai: patient.nomePai || null,
    indicacao: patient.indicacao || null,
    endereco: patient.endereco || null,
    genero: patient.genero || null,
    estadoCivilId: patient.estadoCivilId || undefined,
  };
}

/** PUT completo: parte do GET /pacientes/{id} + campos editados na UI. */
export function mergePacienteDtoWithEditing(dto, editing) {
  if (!dto) return null;
  const sexoNorm = normalizeSexoForApi(dto.sexo);
  return {
    nomeCompleto: (editing?.nome ?? dto.nomeCompleto ?? '').trim(),
    dataNascimento: dto.dataNascimento || null,
    cpf: dto.cpf || null,
    rg: dto.rg || null,
    telefone: (editing?.telefone ?? dto.telefone ?? '').trim() || null,
    email: (editing?.email ?? dto.email ?? '').trim() || null,
    instagram: dto.instagram || null,
    tiktok: dto.tiktok || null,
    nomeMae: dto.nomeMae || null,
    nomePai: dto.nomePai || null,
    profissao: (editing?.profissao ?? dto.profissao ?? '').trim() || null,
    indicacao: dto.indicacao || null,
    endereco: (editing?.endereco ?? dto.endereco ?? '').trim() || null,
    sexo: (sexoNorm ?? dto.sexo) || null,
    genero: dto.genero || null,
    estadoCivilId: dto.estadoCivilId || undefined,
  };
}
