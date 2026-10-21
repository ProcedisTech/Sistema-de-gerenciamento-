import { describe, expect, it } from 'vitest';
import { cardDoAtalho, linhasDoCard, loteDasLinhas, STATUS_AGENDA_ATIVOS } from './loteAgendasDoPaciente.js';
import { agruparAgendamentosHojePulse } from './sortAgendamentosHojePulse.js';

const DF = 'America/Sao_Paulo';
const DIA = '2026-10-09';
// 08:10 UTC = 05:10 em Brasília
const AGORA_DATE = new Date('2026-10-09T08:10:00Z');

function linha(id, extras) {
  return {
    id,
    agendaId: id,
    data: DIA,
    tipo: 'atendimento',
    horaInicio: '10:00',
    horaFim: '10:30',
    status: 'confirmado',
    pacienteId: 'p-ana',
    pacienteNome: 'Ana',
    profissionalRoleUserId: 'ru-1',
    roleUserId: 'ru-1',
    procedimentoNome: 'Botox',
    catalogoProcedimentoSaudeId: 'cat-1',
    planejamentoItemId: null,
    atendimentoId: null,
    atendimentoStatusCodigo: null,
    ...extras,
  };
}

const cards = (rows) => agruparAgendamentosHojePulse(rows, DF, AGORA_DATE);
const ids = (r) => (r ? r.linhas.map((l) => l.id) : null);

describe('loteAgendasDoPaciente · STATUS_AGENDA_ATIVOS (usado pela Frente 5)', () => {
  it('continua exportado com os 3 status ativos', () => {
    expect(STATUS_AGENDA_ATIVOS).toEqual(['pendente', 'aguardando_confirmacao', 'confirmado']);
  });
});

describe('loteDasLinhas (mesmo mapeamento da Agenda)', () => {
  it('mapeia cada linha do card, na ordem, com os 4 campos da Agenda', () => {
    const lote = loteDasLinhas([
      linha('a1', { planejamentoItemId: 'pi-1' }),
      { agendaId: 'a2', tipoProcedimento: { nome: 'Peeling' }, procedimentoNome: 'x', catalogoProcedimentoSaudeId: '' },
    ]);
    expect(lote).toEqual([
      { agendaId: 'a1', procedimentoNome: 'Botox', catalogoProcedimentoSaudeId: 'cat-1', planejamentoItemId: 'pi-1' },
      { agendaId: 'a2', procedimentoNome: 'Peeling', catalogoProcedimentoSaudeId: '', planejamentoItemId: null },
    ]);
  });

  it('sem linhas → lote vazio', () => {
    expect(loteDasLinhas(undefined)).toEqual([]);
  });
});

describe('linhasDoCard', () => {
  it('Ana 05:00 e 16:00 (dois cards): o slot das 05:00 traz só as 05:00', () => {
    const rows = [
      linha('a05', { horaInicio: '05:00', horaFim: '05:30' }),
      linha('a16', { horaInicio: '16:00', horaFim: '16:30' }),
    ];
    expect(linhasDoCard(cards(rows), 'a05').map((l) => l.id)).toEqual(['a05']);
  });

  it('grupo consecutivo: traz as linhas do grupo inteiro', () => {
    const rows = [
      linha('g1', { horaInicio: '09:00', horaFim: '09:30' }),
      linha('g2', { horaInicio: '09:30', horaFim: '10:00' }),
      linha('a16', { horaInicio: '16:00', horaFim: '16:30' }),
    ];
    expect(linhasDoCard(cards(rows), 'g2').map((l) => l.id)).toEqual(['g1', 'g2']);
  });

  it('agenda fora dos cards → só o slot', () => {
    const slot = linha('fora');
    expect(linhasDoCard([], 'fora', slot)).toEqual([slot]);
    expect(linhasDoCard([], 'fora')).toEqual([]);
  });
});

describe('cardDoAtalho (atalho "escolher paciente")', () => {
  it('regra 1: card em andamento (início ≤ agora < fim) ganha dos outros', () => {
    const rows = [
      linha('a03', { horaInicio: '03:00', horaFim: '03:30' }),
      linha('a05', { horaInicio: '05:00', horaFim: '05:30' }),
      linha('a16', { horaInicio: '16:00', horaFim: '16:30' }),
    ];
    const r = cardDoAtalho(cards(rows), 'p-ana', `${DIA} 05:10`);
    expect(ids(r)).toEqual(['a05']);
    expect(r.primeira.id).toBe('a05');
  });

  it('regra 2: dois atrasados → vai o mais recente, e ele ganha do próximo', () => {
    const rows = [
      linha('a01', { horaInicio: '01:00', horaFim: '01:30' }),
      linha('a03', { horaInicio: '03:00', horaFim: '03:30' }),
      linha('a16', { horaInicio: '16:00', horaFim: '16:30' }),
    ];
    expect(ids(cardDoAtalho(cards(rows), 'p-ana', `${DIA} 05:10`))).toEqual(['a03']);
  });

  it('regra 3: nenhum em andamento nem atrasado → o próximo (menor início > agora)', () => {
    const rows = [
      linha('a16', { horaInicio: '16:00', horaFim: '16:30' }),
      linha('a09', { horaInicio: '09:00', horaFim: '09:30' }),
      linha('a03-real', { horaInicio: '03:00', horaFim: '03:30', status: 'realizado' }),
    ];
    expect(ids(cardDoAtalho(cards(rows), 'p-ana', `${DIA} 05:10`))).toEqual(['a09']);
  });

  it('nenhum card ativo e não iniciado → null (o atalho segue sem agenda, avulsa)', () => {
    const rows = [
      linha('a05-real', { horaInicio: '05:00', horaFim: '05:30', status: 'realizado' }),
      linha('a09-canc', { horaInicio: '09:00', horaFim: '09:30', status: 'cancelado' }),
      linha('a16-aberta', { horaInicio: '16:00', horaFim: '16:30', atendimentoId: 'at-1', atendimentoStatusCodigo: 'aberto' }),
      linha('outra', { horaInicio: '05:00', horaFim: '05:30', pacienteId: 'p-outra', pacienteNome: 'Outra' }),
    ];
    expect(cardDoAtalho(cards(rows), 'p-ana', `${DIA} 05:10`)).toBeNull();
    expect(cardDoAtalho([], 'p-ana', `${DIA} 05:10`)).toBeNull();
  });

  it('consulta encerrada/cancelada na agenda ativa conta como não iniciada', () => {
    const rows = [
      linha('a05', { horaInicio: '05:00', horaFim: '05:30', atendimentoId: 'at-1', atendimentoStatusCodigo: 'CANCELADO' }),
    ];
    expect(ids(cardDoAtalho(cards(rows), 'p-ana', `${DIA} 05:10`))).toEqual(['a05']);
  });

  it('consulta abandonada na agenda ativa conta como não iniciada (igual ao card)', () => {
    const rows = [
      linha('a05', { horaInicio: '05:00', horaFim: '05:30', atendimentoId: 'at-1', atendimentoStatusCodigo: 'abandonado' }),
      linha('a16', { horaInicio: '16:00', horaFim: '16:30' }),
    ];
    const r = cardDoAtalho(cards(rows), 'p-ana', `${DIA} 05:10`);
    expect(ids(r)).toEqual(['a05']);
    expect(r.primeira.id).toBe('a05');
  });

  it('consulta aberta na agenda segura o card (fica de fora)', () => {
    const rows = [
      linha('a05', { horaInicio: '05:00', horaFim: '05:30', atendimentoId: 'at-1', atendimentoStatusCodigo: 'aberto' }),
      linha('a16', { horaInicio: '16:00', horaFim: '16:30' }),
    ];
    expect(ids(cardDoAtalho(cards(rows), 'p-ana', `${DIA} 05:10`))).toEqual(['a16']);
  });

  it('Ana 05:00 e 16:00: o atalho às 05:10 leva lote só com 05:00', () => {
    const rows = [
      linha('a05', { horaInicio: '05:00', horaFim: '05:30' }),
      linha('a16', { horaInicio: '16:00', horaFim: '16:30' }),
    ];
    const r = cardDoAtalho(cards(rows), 'p-ana', `${DIA} 05:10`);
    expect(loteDasLinhas(r.linhas).map((l) => l.agendaId)).toEqual(['a05']);
  });
});
