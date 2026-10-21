/**
 * Dados fixos dos cenários do roteiro do encerrar (Etapa 0, Y5).
 * Cada id de fixture vira um marcador no JSON (`${PACIENTE}`, `${AGENDA_1}`...), que o replay do
 * backend troca pelos ids que ele mesmo semeou.
 */
import { ORG_ID, ROLE_USER_ID } from './servidorEncerrarFalso.js';

export const IDS = {
  ORG: ORG_ID,
  ROLE_USER: ROLE_USER_ID,
  PACIENTE: '33333333-3333-4333-8333-333333333333',
  CATALOGO_1: '55555555-5555-4555-8555-555555555551',
  CATALOGO_2: '55555555-5555-4555-8555-555555555552',
  AGENDA_1: '66666666-6666-4666-8666-666666666661',
  AGENDA_2: '66666666-6666-4666-8666-666666666662',
  AGENDA_3: '66666666-6666-4666-8666-666666666663',
  AGENDA_4: '66666666-6666-4666-8666-666666666664',
  PLANO_1: '77777777-7777-4777-8777-777777777771',
  PLANO_ITEM_1: '77777777-7777-4777-8777-777777777781',
  PF_ORIGEM: '88888888-8888-4888-8888-888888888881',
  TERMO_1: '99999999-9999-4999-8999-999999999991',
  ASSINATURA_EXISTENTE: '99999999-9999-4999-8999-999999999981',
  FICHA_BASICA: '99999999-9999-4999-8999-999999999971',
  TIPO_CONSULTA: '44444444-4444-4444-8444-444444444441',
  TIPO_RETORNO: '44444444-4444-4444-8444-444444444442',
  TIPO_ESTETICA: '44444444-4444-4444-8444-444444444443',
  TIPO_BLOQUEIO: '44444444-4444-4444-8444-444444444444',
};

/** GET /api/v1/dimensoes/tipos-procedimento: códigos exatos de tb_tipo_procedimento (não existe `procedimento`). */
export const tiposProcedimento = [
  { tipoProcedimentoId: IDS.TIPO_CONSULTA, codigo: 'CONSULTA', nome: 'Consulta' },
  { tipoProcedimentoId: IDS.TIPO_RETORNO, codigo: 'retorno', nome: 'Retorno' },
  { tipoProcedimentoId: IDS.TIPO_ESTETICA, codigo: 'ESTETICA', nome: 'Estética' },
  { tipoProcedimentoId: IDS.TIPO_BLOQUEIO, codigo: 'bloqueio', nome: 'Bloqueio' },
];

export const pacienteDto = {
  id: IDS.PACIENTE,
  nomeCompleto: 'Maria Souza',
  cpf: '52998224725',
  telefone: '68999990000',
  sexo: 'F',
  dataNascimento: '1990-05-10',
  ativo: true,
};

export const catalogoClinica = [
  {
    id: IDS.CATALOGO_1,
    procedimento: { nomeProcedimento: 'Toxina botulínica', tipoCodigo: 'ESTETICA', duracaoEstimadaMinutos: 60 },
  },
  {
    id: IDS.CATALOGO_2,
    procedimento: { nomeProcedimento: 'Preenchimento labial', tipoCodigo: 'ESTETICA', duracaoEstimadaMinutos: 60 },
  },
];

/** AgendaResponseDTO (src/test/contrato/agenda-dto.json) com o essencial de cada cenário. */
export function agendaDto({
  id,
  data = '2026-10-06',
  horaInicio = '10:00:00',
  horaFim = '11:00:00',
  status = 'confirmado',
  tipoCodigo = 'ESTETICA',
  tipoNome = 'Estética',
  catalogoId = IDS.CATALOGO_1,
  catalogoNome = 'Toxina botulínica',
  planejamentoItemId = null,
  procedimentoFeitoOrigemId = null,
}) {
  return {
    id,
    dataAgendamento: data,
    horaInicio,
    horaFim,
    statusCodigo: status,
    statusNome: status,
    observacao: null,
    profissionalRoleUserId: ROLE_USER_ID,
    profissionalNome: 'Beatriz Lima',
    criadoPorRoleUserId: ROLE_USER_ID,
    criadoPorNome: 'Beatriz Lima',
    roleUserId: ROLE_USER_ID,
    pacienteId: IDS.PACIENTE,
    pacienteNome: 'Maria Souza',
    pacienteFotoUrl: null,
    agendaIdOrigem: null,
    criadoEm: '2026-10-01T13:00:00Z',
    atualizadoEm: '2026-10-01T13:00:00Z',
    tipoProcedimentoNome: tipoNome,
    tipoProcedimentoCodigo: tipoCodigo,
    catalogoProcedimentoNome: catalogoNome,
    motivoCancelamentoNome: null,
    motivoCancelamentoCodigo: null,
    motivoCancelamentoId: null,
    motivoCancelamentoObservacao: null,
    tipoProcedimentoId: tiposProcedimento.find((t) => t.codigo === tipoCodigo)?.tipoProcedimentoId ?? null,
    catalogoProcedimentoSaudeId: catalogoId,
    planejamentoItemId,
    procedimentoFeitoOrigemId,
  };
}

/** Troca ids de fixture e ids gerados pelo servidor falso pelos marcadores, em qualquer profundidade. */
export function marcar(valor, marcadoresGerados) {
  const porId = new Map(Object.entries(IDS).map(([nome, id]) => [id, nome]));
  for (const [id, nome] of marcadoresGerados) porId.set(id, nome);
  const trocar = (s) => {
    let out = s;
    for (const [id, nome] of porId) out = out.split(id).join(`\${${nome}}`);
    return out;
  };
  const visitar = (v) => {
    if (typeof v === 'string') return trocar(v);
    if (Array.isArray(v)) return v.map(visitar);
    if (v && typeof v === 'object') {
      return Object.fromEntries(Object.entries(v).map(([k, x]) => [trocar(k), visitar(x)]));
    }
    return v;
  };
  return visitar(valor);
}
