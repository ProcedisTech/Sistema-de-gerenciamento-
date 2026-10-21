import { describe, expect, it } from 'vitest';
import { getExecutionSummary, getTimingBadge } from './agendaTimingBadges.js';
import { mapAgendaDtoToDashboardRow } from './agendaDashboardMapping.js';
import { agendaContrato } from '../test/contrato/fixtures.js';

const AC = 'America/Rio_Branco';
const DF = 'America/Sao_Paulo';

const realizado = {
  data: '2026-10-02',
  horaInicio: '09:00',
  status: 'realizado',
  criadoEm: '2026-10-02T12:00:00Z',
  atualizadoEm: '2026-10-02T12:30:00Z',
};

describe('getTimingBadge — horário previsto no fuso da clínica', () => {
  it('início real às 12:00Z: no horário em DF (09:00), adiantado 2h em AC (07:00 contra 09:00)', () => {
    expect(getTimingBadge(realizado, DF).label).toBe('No horário');
    expect(getTimingBadge(realizado, AC).label).toBe('Adiantado 2h');
  });
});

describe('getExecutionSummary — horários reais exibidos no fuso da clínica', () => {
  it('DF', () => {
    const s = getExecutionSummary(realizado, DF);
    expect(s).toMatchObject({ dataReal: '02/10', horaInicioReal: '09:00', horaFimReal: '09:30', duracaoRealMin: 30 });
    expect(s.rangeText).toBe('02/10 · 09:00–09:30');
  });

  it('AC', () => {
    const s = getExecutionSummary(realizado, AC);
    expect(s).toMatchObject({ dataReal: '02/10', horaInicioReal: '07:00', horaFimReal: '07:30', duracaoRealMin: 30 });
  });

  it('sem execução', () => {
    expect(getExecutionSummary({ data: '2026-10-02', horaInicio: '09:00', status: 'pendente' }, DF).hasExecution).toBe(false);
  });
});

// Frente 4: com consulta ligada, o horário real vem de tb_atendimento (iniciado_em/encerrado_em),
// não de criadoEm/atualizadoEm da agenda (que contam quando a agenda foi criada/editada).
const realizadoComConsulta = {
  ...realizado,
  criadoEm: '2026-10-01T15:00:00Z', // agenda criada na véspera
  atualizadoEm: '2026-10-02T13:40:00Z', // agenda editada depois do fim da consulta
  atendimentoIniciadoEm: '2026-10-02T12:20:00Z', // 09:20 em DF
  atendimentoEncerradoEm: '2026-10-02T13:05:00Z', // 10:05 em DF
};

describe('com consulta ligada — horário real da consulta', () => {
  it('início e fim vêm da consulta (não de criadoEm/atualizadoEm)', () => {
    const s = getExecutionSummary(realizadoComConsulta, DF);
    expect(s).toMatchObject({ hasExecution: true, dataReal: '02/10', horaInicioReal: '09:20', horaFimReal: '10:05', duracaoRealMin: 45 });
    expect(s.rangeText).toBe('02/10 · 09:20–10:05');
    expect(s.badge.label).toBe('Atrasado 20 min');
  });

  it('pontualidade usa o início da consulta', () => {
    expect(getTimingBadge(realizadoComConsulta, DF).label).toBe('Atrasado 20 min');
    expect(getTimingBadge({ ...realizadoComConsulta, atendimentoIniciadoEm: '2026-10-02T11:40:00Z' }, DF).label).toBe('Adiantado 20 min');
  });

  it('parâmetro explícito ainda vence o início da consulta', () => {
    expect(getTimingBadge(realizadoComConsulta, DF, '2026-10-02T12:02:00Z').label).toBe('No horário');
    expect(getExecutionSummary(realizadoComConsulta, DF, '2026-10-02T12:02:00Z').horaInicioReal).toBe('09:02');
  });

  it('horaFimReal ainda vence o fim da consulta', () => {
    const s = getExecutionSummary({ ...realizadoComConsulta, horaFimReal: '2026-10-02T12:50:00Z' }, DF);
    expect(s).toMatchObject({ horaFimReal: '09:50', duracaoRealMin: 30 });
  });

  it('consulta sem fim gravado: fim cai na regra de hoje (atualizadoEm do realizado)', () => {
    const s = getExecutionSummary({ ...realizadoComConsulta, atendimentoEncerradoEm: null }, DF);
    expect(s).toMatchObject({ horaInicioReal: '09:20', horaFimReal: '10:40', duracaoRealMin: 80 });
  });

  it('consulta aberta em agenda não realizada: nada aparece, como hoje (sem faixa, sem selo)', () => {
    const emCurso = {
      data: '2026-10-02',
      horaInicio: '09:00',
      status: 'confirmado',
      criadoEm: '2026-10-01T15:00:00Z',
      atendimentoIniciadoEm: '2026-10-02T12:20:00Z',
      atendimentoEncerradoEm: null,
    };
    expect(getExecutionSummary(emCurso, DF).hasExecution).toBe(false);
    expect(getTimingBadge(emCurso, DF)).toBeNull();
  });

  it('do AgendaDTO do contrato até a faixa: o mapeamento leva os horários da consulta', () => {
    const row = mapAgendaDtoToDashboardRow(
      agendaContrato({
        statusCodigo: 'realizado',
        statusNome: 'Realizado',
        atendimentoStatusCodigo: 'encerrado',
        atendimentoEncerradoEm: '2026-10-05T18:10:00Z',
      }),
    );
    expect(row).toMatchObject({
      status: 'realizado',
      atendimentoIniciadoEm: '2026-10-05T17:32:00Z',
      atendimentoEncerradoEm: '2026-10-05T18:10:00Z',
    });
    const s = getExecutionSummary(row, DF);
    expect(s.rangeText).toBe('05/10 · 14:32–15:10');
    expect(s.duracaoRealMin).toBe(38);
    expect(s.badge.label).toBe('No horário');
  });

  it('AgendaDTO sem consulta: mapeamento traz nulos e a faixa segue criadoEm/atualizadoEm', () => {
    const row = mapAgendaDtoToDashboardRow(
      agendaContrato({
        statusCodigo: 'realizado',
        statusNome: 'Realizado',
        atendimentoId: null,
        atendimentoStatusCodigo: null,
        atendimentoAnfitriaoRoleUserId: null,
        atendimentoIniciadoEm: null,
        atendimentoEncerradoEm: null,
        criadoEm: '2026-10-05T17:30:00Z',
        atualizadoEm: '2026-10-05T18:00:00Z',
      }),
    );
    expect(row).toMatchObject({ atendimentoIniciadoEm: null, atendimentoEncerradoEm: null });
    expect(getExecutionSummary(row, DF).rangeText).toBe('05/10 · 14:30–15:00');
  });
});

describe('consulta cancelada não fornece horário (decisão do Johnn, 09/10)', () => {
  const cancelada = {
    ...realizadoComConsulta,
    atendimentoStatusCodigo: 'cancelado',
    atendimentoEncerradoEm: '2026-10-03T13:00:00Z', // hora do cancelamento, no dia seguinte
  };
  const semConsulta = { ...realizadoComConsulta, atendimentoIniciadoEm: null, atendimentoEncerradoEm: null };

  it('agenda realizada ligada a consulta cancelada: faixa e selo da regra de hoje (criadoEm/atualizadoEm)', () => {
    const s = getExecutionSummary(cancelada, DF);
    expect(s).toEqual(getExecutionSummary(semConsulta, DF));
    expect(s).toMatchObject({ dataReal: '01/10', horaInicioReal: '12:00', horaFimReal: '10:40' });
    expect(s.horaFimReal).not.toBe('10:00'); // nunca a hora do cancelamento
    expect(getTimingBadge(cancelada, DF)).toEqual(getTimingBadge(semConsulta, DF));
  });

  it('status em maiúsculas também é cancelado', () => {
    expect(getExecutionSummary({ ...cancelada, atendimentoStatusCodigo: 'CANCELADO' }, DF)).toEqual(
      getExecutionSummary(semConsulta, DF),
    );
  });

  it('outros status seguem usando o horário da consulta', () => {
    const encerrada = { ...realizadoComConsulta, atendimentoStatusCodigo: 'encerrado' };
    expect(getExecutionSummary(encerrada, DF).rangeText).toBe('02/10 · 09:20–10:05');
  });
});
