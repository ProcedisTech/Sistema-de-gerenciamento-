import { calculateAgeFromISODate } from '../components/utils/formatters';
import { resolveApiUrl } from '../config/apiEnv.js';
import { maskCep, normalizeCepForApi } from './cepUtils.js';

/** Códigos de sexo aceitos na API (Spring): M, F, N (prefiro não dizer / não declarado). */
export function normalizeSexoForApi(raw) {
  const u = String(raw ?? '').trim().toUpperCase();
  if (u === 'F' || u === 'M' || u === 'N') return u;
  return null;
}

function dtoPick(dto, camelKey, snakeKey) {
  if (!dto) return '';
  const v = dto[camelKey] ?? dto[snakeKey];
  if (v == null || v === '') return '';
  return String(v).trim();
}

function trimOrNull(v) {
  const t = String(v ?? '').trim();
  return t ? t : null;
}

function normalizeUf(raw) {
  const u = String(raw ?? '')
    .trim()
    .toUpperCase()
    .slice(0, 2);
  return u || null;
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

/** Instant/data do backend → string preservada ou null. */
function pickDateTimeIso(dto, camelKey, snakeKey) {
  if (!dto || typeof dto !== 'object') return null;
  const v = dto[camelKey] ?? dto[snakeKey];
  if (v == null || v === '') return null;
  const s = String(v).trim();
  return s || null;
}

/** True se a string parece ISO instant (evita tratar dd/mm legado como Instant em proximoRetorno). */
function looksIsoLikeInstantString(s) {
  const t = String(s ?? '').trim();
  if (!t) return false;
  return /^\d{4}-\d{2}-\d{2}/.test(t) || t.includes('T') || /Z$/i.test(t);
}

/**
 * Primeiro valor entre vários pares camel/snake que `new Date` parseia sem NaN.
 * Usado para ultima visita / próximo agendamento com aliases do DTO Spring.
 */
function pickFirstParsableInstant(dto, pairs) {
  if (!dto || typeof dto !== 'object' || !Array.isArray(pairs)) return null;
  for (const [camelKey, snakeKey] of pairs) {
    const s = pickDateTimeIso(dto, camelKey, snakeKey);
    if (!s) continue;
    const time = new Date(s).getTime();
    if (!Number.isNaN(time)) return s;
  }
  return null;
}

/** Data apenas dd/mm/aaaa (America/Sao_Paulo) para lista/seeds que usam ultimaVisita. */
function toPtBrDateOnly(isoOrStr) {
  if (!isoOrStr) return '';
  const t = new Date(isoOrStr);
  if (Number.isNaN(t.getTime())) return '';
  return t.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
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

  const cepDigits = normalizeCepForApi(dtoPick(dto, 'cep', 'cep'));

  const ultimaVinda = pickFirstParsableInstant(dto, [
    ['ultimaVinda', 'ultima_vinda'],
    ['ultimaVisita', 'ultima_visita'],
    ['dataUltimaVisita', 'data_ultima_visita'],
    ['ultimaVisitaEm', 'ultima_visita_em'],
    ['dataUltimoProcedimento', 'data_ultimo_procedimento'],
    ['ultimoAtendimentoEm', 'ultimo_atendimento_em'],
  ]);

  let proximoAgendamento = pickFirstParsableInstant(dto, [
    ['proximoAgendamento', 'proximo_agendamento'],
  ]);
  if (proximoAgendamento == null) {
    const rawProx = dto.proximoRetorno ?? dto.proximo_retorno;
    if (rawProx != null && rawProx !== '') {
      const s = String(rawProx).trim();
      if (s && looksIsoLikeInstantString(s)) {
        const time = new Date(s).getTime();
        if (!Number.isNaN(time)) proximoAgendamento = s;
      }
    }
  }

  /** Texto legado (ex. dd/mm): pickFirst ignora quando `new Date` não parseia — precisa camel e snake. */
  const ultimaVisitaLegacy =
    ultimaVinda != null
      ? toPtBrDateOnly(ultimaVinda)
      : String(
          dtoPick(dto, 'ultimaVisita', 'ultima_visita') ||
            dtoPick(dto, 'ultimaVisitaFormatada', 'ultima_visita_formatada') ||
            '',
        ).trim();
  const proximoRetornoLegacy =
    proximoAgendamento != null
      ? toPtBrDateOnly(proximoAgendamento)
      : String(dto.proximoRetorno || '').trim();

  return {
    id: dto.id,
    nome: dto.nomeCompleto || '',
    dataNascimento: dto.dataNascimento || '',
    idade: calculateAgeFromISODate(dto.dataNascimento),
    sexo: (dto.sexo || '').toLowerCase(),
    estadoCivil: dto.estadoCivilNome || '',
    estadoCivilId: dto.estadoCivilId || '',
    profissaoId: dto.profissaoId ?? dto.profissao_id ?? null,
    profissaoNome: dto.profissaoNome ?? dto.profissao_nome ?? null,
    profissaoCategoria: dto.profissaoCategoria ?? dto.profissao_categoria ?? null,
    alergias: dtoPick(dto, 'alergias', 'alergias'),
    ultimaAnamneseDataHora: pickDateTimeIso(dto, 'ultimaAnamneseDataHora', 'ultima_anamnese_data_hora'),
    ultimaAnamneseEm: pickDateTimeIso(dto, 'ultimaAnamneseEm', 'ultima_anamnese_em'),
    cpf: dto.cpf || '',
    rg: dto.rg || '',
    telefone: dto.telefone || '',
    email: dto.email || '',
    cep: cepDigits ? maskCep(cepDigits) : '',
    enderecoRua: dtoPick(dto, 'enderecoRua', 'endereco_rua'),
    enderecoNumero: dtoPick(dto, 'enderecoNumero', 'endereco_numero'),
    enderecoComplemento: dtoPick(dto, 'enderecoComplemento', 'endereco_complemento'),
    enderecoBairro: dtoPick(dto, 'enderecoBairro', 'endereco_bairro'),
    enderecoCidade: dtoPick(dto, 'enderecoCidade', 'endereco_cidade'),
    enderecoEstado: normalizeUf(dtoPick(dto, 'enderecoEstado', 'endereco_estado')) || '',
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
    ultimaVinda,
    proximoAgendamento,
    ultimaVisita: ultimaVisitaLegacy,
    proximoRetorno: proximoRetornoLegacy,
    createdAt: pickDateTimeIso(dto, 'createdAt', 'created_at') ?? pickDateTimeIso(dto, 'criadoEm', 'criado_em'),
    saldoDevedor: 0,
    lgpdAssinado: false,
    lgpdRenovacao: '',
    medicamentos: [],
    condicoesSaude: dtoPick(dto, 'condicoesSaude', 'condicoes_saude'),
    queixasEsteticas: [],
    cirurgiasAnteriores: '',
    observacoes:
      dtoPick(dto, 'observacoes', 'observacoes') ||
      dtoPick(dto, 'observacao', 'observacao') ||
      dtoPick(dto, 'notas', 'notas') ||
      dtoPick(dto, 'observacoesImportantes', 'observacoes_importantes') ||
      '',
    observacoesImportantes:
      dtoPick(dto, 'observacoesImportantes', 'observacoes_importantes') ||
      dtoPick(dto, 'observacoes', 'observacoes') ||
      '',
    procedures: [],
    notas: [],
    galeria: [],
    // Campos de status vindos do backend (v1)
    statusPlanoCodigo: dto.statusPlanoCodigo ?? null,
    statusPlanoNome: dto.statusPlanoNome ?? null,
    statusPlanoCorHex: dto.statusPlanoCorHex ?? null,
    menorDeIdade: dto.menorDeIdade === true,
    semRetorno60Dias: dto.semRetorno60Dias === true,
    ehNovo: dto.ehNovo === true,
    ehAniversariante: dto.ehAniversariante === true,
    anamneseDesatualizada: dto.anamneseDesatualizada === true,
    anamnesePendente: dto.anamnesePendente === true,
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
    profissaoId: String(j.profissaoId ?? '').trim() || null,
    sexo: normalizeSexoForApi(j.sexo),
    estadoCivilId: j.estadoCivilId || undefined,
    cep: null,
    enderecoRua: null,
    enderecoNumero: null,
    enderecoComplemento: null,
    enderecoBairro: null,
    enderecoCidade: null,
    enderecoEstado: null,
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
    profissaoId:
      editing?.profissaoId !== undefined
        ? String(editing.profissaoId ?? '').trim() || null
        : (patient.profissaoId != null && String(patient.profissaoId).trim() !== ''
            ? String(patient.profissaoId).trim()
            : null),
    sexo: normalizeSexoForApi(editing?.sexo ?? patient.sexo),
    instagram: patient.instagram || null,
    tiktok: patient.tiktok || null,
    nomeMae: patient.nomeMae || null,
    nomePai: patient.nomePai || null,
    indicacao: patient.indicacao || null,
    cep: normalizeCepForApi(editing?.cep ?? patient.cep),
    enderecoRua: trimOrNull(editing?.enderecoRua ?? patient.enderecoRua),
    enderecoNumero: trimOrNull(editing?.enderecoNumero ?? patient.enderecoNumero),
    enderecoComplemento: trimOrNull(editing?.enderecoComplemento ?? patient.enderecoComplemento),
    enderecoBairro: trimOrNull(editing?.enderecoBairro ?? patient.enderecoBairro),
    enderecoCidade: trimOrNull(editing?.enderecoCidade ?? patient.enderecoCidade),
    enderecoEstado: normalizeUf(editing?.enderecoEstado ?? patient.enderecoEstado),
    endereco: null,
    genero: patient.genero || null,
    estadoCivilId: patient.estadoCivilId || undefined,
  };
}

/** PUT completo: parte do GET /pacientes/{id} + campos editados na UI. */
export function mergePacienteDtoWithEditing(dto, editing) {
  if (!dto) return null;
  const sexoMerged = normalizeSexoForApi(editing?.sexo ?? dto.sexo);
  const rgDigits = String(editing?.rg ?? dto.rg ?? '').replace(/\D/g, '') || '';
  return {
    nomeCompleto: (editing?.nome ?? dto.nomeCompleto ?? '').trim(),
    dataNascimento: (editing?.dataNascimentoIso ?? dto.dataNascimento) || null,
    cpf: dto.cpf || null,
    rg: rgDigits || null,
    telefone: (editing?.telefone ?? dto.telefone ?? '').trim() || null,
    email: (editing?.email ?? dto.email ?? '').trim() || null,
    instagram: (editing?.instagram ?? dto.instagram ?? '').trim() || null,
    tiktok: (editing?.tiktok ?? dto.tiktok ?? '').trim() || null,
    nomeMae: (editing?.nomeMae ?? dto.nomeMae ?? '').trim() || null,
    nomePai: (editing?.nomePai ?? dto.nomePai ?? '').trim() || null,
    profissaoId:
      editing?.profissaoId !== undefined
        ? String(editing.profissaoId ?? '').trim() || null
        : (dto.profissaoId ?? dto.profissao_id ?? null),
    indicacao: (editing?.indicacao ?? dto.indicacao ?? '').trim() || null,
    cep: normalizeCepForApi(editing?.cep ?? dto.cep),
    enderecoRua: trimOrNull(
      editing?.enderecoRua ?? dtoPick(dto, 'enderecoRua', 'endereco_rua'),
    ),
    enderecoNumero: trimOrNull(
      editing?.enderecoNumero ?? dtoPick(dto, 'enderecoNumero', 'endereco_numero'),
    ),
    enderecoComplemento: trimOrNull(
      editing?.enderecoComplemento ?? dtoPick(dto, 'enderecoComplemento', 'endereco_complemento'),
    ),
    enderecoBairro: trimOrNull(
      editing?.enderecoBairro ?? dtoPick(dto, 'enderecoBairro', 'endereco_bairro'),
    ),
    enderecoCidade: trimOrNull(
      editing?.enderecoCidade ?? dtoPick(dto, 'enderecoCidade', 'endereco_cidade'),
    ),
    enderecoEstado: normalizeUf(
      editing?.enderecoEstado ?? dtoPick(dto, 'enderecoEstado', 'endereco_estado'),
    ),
    endereco: null,
    sexo: (sexoMerged ?? dto.sexo) || null,
    genero: (editing?.genero ?? dto.genero ?? '').trim() || null,
    estadoCivilId:
      editing?.estadoCivilId !== undefined && editing?.estadoCivilId !== ''
        ? editing.estadoCivilId
        : dto.estadoCivilId || undefined,
  };
}
