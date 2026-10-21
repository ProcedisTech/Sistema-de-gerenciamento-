import { describe, expect, it } from 'vitest';
import { getExecutionSummary, getTimingBadge } from './agendaTimingBadges.js';
import { mapAgendaDtoToDashboardRow } from './agendaDashboardMapping.js';
import { agendaContrato } from '../test/contrato/fixtures.js';

const DF = 'America/Sao_Paulo';

// Frente 4 (B-42), testador T4 — caso NÃO DETERMINADO "agenda realizada ligada a consulta cancelada".
// O backend (AtendimentoService.cancelarPorOutra) grava encerrado_em = hora do cancelamento (quando OUTRA profissional
// abre o paciente sobre a consulta abandonada) e deixa a agenda realizada ligada. Decisão do Johnn (09/10): consulta
// cancelada não fornece horário — o DTO continua expondo, o front ignora e usa a regra de hoje (criadoEm/atualizadoEm).
describe('agenda realizada ligada a consulta cancelada (consulta cancelada não fornece horário)', () => {
  const row = mapAgendaDtoToDashboardRow(
    agendaContrato({
      dataAgendamento: '2026-10-02',
      horaInicio: '09:00:00',
      horaFim: '09:30:00',
      statusCodigo: 'realizado',
      statusNome: 'Realizado',
      criadoEm: '2026-10-01T15:00:00Z', // agenda criada na véspera
      atualizadoEm: '2026-10-02T12:40:00Z', // marcada realizada às 09:40 (DF)
      atendimentoStatusCodigo: 'cancelado',
      atendimentoIniciadoEm: '2026-10-02T12:05:00Z', // consulta dela começou 09:05 (DF)
      atendimentoEncerradoEm: '2026-10-03T13:00:00Z', // cancelada no dia seguinte, 10:00 (DF), pelo abrir da outra
    }),
  );

  it('o mapeamento leva status e horários da consulta cancelada', () => {
    expect(row).toMatchObject({
      status: 'realizado',
      atendimentoStatusCodigo: 'cancelado',
      atendimentoIniciadoEm: '2026-10-02T12:05:00Z',
      atendimentoEncerradoEm: '2026-10-03T13:00:00Z',
    });
  });

  it('selo ignora o início da consulta cancelada e usa criadoEm (regra de hoje)', () => {
    expect(getTimingBadge(row, DF).label).toBe('Adiantado 21h');
  });

  it('faixa ignora a consulta cancelada: criadoEm–atualizadoEm, nunca a hora do cancelamento', () => {
    const s = getExecutionSummary(row, DF);
    expect(s).toMatchObject({ hasExecution: true, dataReal: '01/10', horaInicioReal: '12:00', horaFimReal: '09:40' });
    expect(s.duracaoRealMin).toBe(1300);
    expect(s.rangeText).toBe('01/10 · 12:00–09:40');
  });

  it('a mesma agenda sem o fim da consulta (abandonada, ainda não cancelada): fim cai em atualizadoEm', () => {
    const s = getExecutionSummary({ ...row, atendimentoStatusCodigo: 'abandonado', atendimentoEncerradoEm: null }, DF);
    expect(s).toMatchObject({ horaInicioReal: '09:05', horaFimReal: '09:40', duracaoRealMin: 35 });
  });
});
