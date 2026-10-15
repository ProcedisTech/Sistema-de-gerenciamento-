import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  FUSO_PADRAO,
  agoraDaClinica,
  agoraCalendarioDaClinica,
  diaDoInstante,
  formatarDataCalendario,
  formatarInstante,
  hojeDaClinica,
  idadeEm,
  instanteDoHorarioDaClinica,
  instanteMs,
  parseDataCalendario,
  parseDataHoraCalendario,
  proximoAniversario,
  somarDias,
  diaDaSemana,
} from './datasClinica.js';

const AC = 'America/Rio_Branco';
const DF = 'America/Sao_Paulo';
const SEM_UF = null;

describe('hojeDaClinica / agoraDaClinica nas viradas', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  // [instante UTC, hoje DF, hoje AC, hhmm DF, hhmm AC]
  const casos = [
    ['2026-10-01T23:59:00Z', '2026-10-01', '2026-10-01', '20:59', '18:59'], // 20:59 Brasília / 18:59 Rio Branco
    ['2026-10-02T00:00:00Z', '2026-10-01', '2026-10-01', '21:00', '19:00'], // 21:00 Brasília / 19:00 Rio Branco
    ['2026-10-02T02:59:00Z', '2026-10-01', '2026-10-01', '23:59', '21:59'], // 23:59 Brasília
    ['2026-10-02T03:00:00Z', '2026-10-02', '2026-10-01', '00:00', '22:00'], // 00:00 Brasília
    ['2026-10-02T04:59:00Z', '2026-10-02', '2026-10-01', '01:59', '23:59'], // 23:59 Rio Branco
    ['2026-10-02T05:00:00Z', '2026-10-02', '2026-10-02', '02:00', '00:00'], // 00:00 Rio Branco
  ];

  it.each(casos)('em %s', (utc, hojeDf, hojeAc, hhmmDf, hhmmAc) => {
    vi.setSystemTime(new Date(utc));
    expect(hojeDaClinica(DF)).toBe(hojeDf);
    expect(hojeDaClinica(SEM_UF)).toBe(hojeDf);
    expect(hojeDaClinica(AC)).toBe(hojeAc);
    expect(agoraDaClinica(DF).hhmm).toBe(hhmmDf);
    expect(agoraDaClinica(AC).hhmm).toBe(hhmmAc);
    const [h, m] = hhmmAc.split(':').map(Number);
    expect(agoraDaClinica(AC).minutos).toBe(h * 60 + m);
    expect(agoraCalendarioDaClinica(AC)).toBe(`${hojeAc}T${hhmmAc}`);
  });

  it('nunca devolve o dia UTC à noite', () => {
    vi.setSystemTime(new Date('2026-10-02T01:30:00Z')); // 22:30 Brasília, 20:30 Rio Branco
    expect(hojeDaClinica(DF)).toBe('2026-10-01');
    expect(hojeDaClinica(AC)).toBe('2026-10-01');
  });

  it('fuso inválido cai no padrão', () => {
    vi.setSystemTime(new Date('2026-10-02T02:00:00Z'));
    expect(hojeDaClinica('Fuso/Inexistente')).toBe(hojeDaClinica(FUSO_PADRAO));
  });
});

describe('instantes', () => {
  it('formatarInstante usa o fuso da clínica', () => {
    const criadoEm = '2026-10-01T02:52:00Z';
    expect(formatarInstante(criadoEm, DF, 'data')).toBe('30/09/2026');
    expect(formatarInstante(criadoEm, AC, 'data')).toBe('30/09/2026');
    expect(formatarInstante(criadoEm, DF, 'hora')).toBe('23:52');
    expect(formatarInstante(criadoEm, AC, 'hora')).toBe('21:52');
    expect(formatarInstante('2026-10-01T04:00:00Z', DF, 'data')).toBe('01/10/2026');
    expect(formatarInstante('2026-10-01T04:00:00Z', AC, 'data')).toBe('30/09/2026');
  });

  it('aceita offset explícito e Date', () => {
    expect(formatarInstante('2026-10-01T10:00:00-05:00', DF, 'hora')).toBe('12:00');
    expect(formatarInstante(new Date('2026-10-01T15:00:00Z'), AC, 'hora')).toBe('10:00');
  });

  it('rejeita instante sem fuso', () => {
    expect(formatarInstante('2026-10-01T02:52:00', DF)).toBe('');
    expect(Number.isNaN(instanteMs('2026-10-01T02:52:00'))).toBe(true);
    expect(diaDoInstante('2026-10-01', DF)).toBe('');
  });

  it('diaDoInstante no fuso da clínica', () => {
    expect(diaDoInstante('2026-10-02T03:30:00Z', DF)).toBe('2026-10-02');
    expect(diaDoInstante('2026-10-02T03:30:00Z', AC)).toBe('2026-10-01');
  });
});

describe('calendário', () => {
  it('nascimento nunca no dia anterior, em qualquer fuso de processo', () => {
    expect(formatarDataCalendario('1990-05-10')).toBe('10/05/1990');
    expect(formatarDataCalendario('1990-05-10', 'longa')).toBe('10 de maio de 1990');
    expect(formatarDataCalendario('2026-01-01', 'diaMes')).toBe('01/01');
    expect(formatarDataCalendario('2026-10-05', { weekday: 'long' })).toBe('segunda-feira');
  });

  it('parse manual e rejeita instante', () => {
    expect(parseDataCalendario('2026-02-29')).toBeNull();
    expect(parseDataCalendario('2028-02-29')).toEqual({ ano: 2028, mes: 2, dia: 29 });
    expect(parseDataCalendario('10/05/1990')).toEqual({ ano: 1990, mes: 5, dia: 10 });
    expect(parseDataCalendario('2026-10-01T02:52:00Z')).toBeNull();
  });

  it('parseDataHoraCalendario (proximoAgendamento)', () => {
    expect(parseDataHoraCalendario('2026-10-05T14:30:00')).toMatchObject({
      dataIso: '2026-10-05', hhmm: '14:30', minutos: 870,
    });
    expect(parseDataHoraCalendario('2026-10-05T14:30:00Z')).toBeNull();
  });

  it('somarDias e diaDaSemana atravessam meses e anos', () => {
    expect(somarDias('2026-12-31', 1)).toBe('2027-01-01');
    expect(somarDias('2028-03-01', -1)).toBe('2028-02-29');
    expect(diaDaSemana('2026-10-04')).toBe(0);
  });
});

describe('aniversário e idade', () => {
  it('29/02 em ano não bissexto vira 28/02', () => {
    expect(proximoAniversario('2000-02-29', '2027-02-01')).toMatchObject({
      dataIso: '2027-02-28', dias: 27, ehHoje: false, idadeQueCompleta: 27,
    });
    expect(proximoAniversario('2000-02-29', '2027-02-28')).toMatchObject({ ehHoje: true, dias: 0 });
    expect(idadeEm('2000-02-29', '2027-02-27')).toBe(26);
    expect(idadeEm('2000-02-29', '2027-02-28')).toBe(27);
  });

  it('29/02 em ano bissexto fica em 29/02', () => {
    expect(proximoAniversario('2000-02-29', '2028-02-28')).toMatchObject({ dataIso: '2028-02-29', dias: 1 });
    expect(idadeEm('2000-02-29', '2028-02-28')).toBe(27);
    expect(idadeEm('2000-02-29', '2028-02-29')).toBe(28);
  });

  it('próximo aniversário passa para o ano seguinte', () => {
    expect(proximoAniversario('1990-01-15', '2026-10-01')).toMatchObject({
      dataIso: '2027-01-15', idadeQueCompleta: 37,
    });
  });

  it('aniversário hoje usa o hoje da clínica, não o UTC', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-02T01:00:00Z')); // 22:00 de 01/10 em Brasília
    expect(proximoAniversario('1990-10-01', hojeDaClinica(DF)).ehHoje).toBe(true);
    expect(proximoAniversario('1990-10-01', hojeDaClinica(AC)).ehHoje).toBe(true);
    vi.useRealTimers();
  });
});

describe('instanteDoHorarioDaClinica', () => {
  it.each([
    [AC, '2026-10-02', '09:00', '2026-10-02T14:00:00.000Z'],
    [DF, '2026-10-02', '09:00', '2026-10-02T12:00:00.000Z'],
    ['America/Noronha', '2026-10-02', '09:00', '2026-10-02T11:00:00.000Z'],
    [DF, '2018-11-15', '09:00', '2018-11-15T11:00:00.000Z'], // horário de verão (−02)
    [AC, '2026-10-02', '23:30', '2026-10-03T04:30:00.000Z'],
    [AC, '2026-10-03', '00:30', '2026-10-03T05:30:00.000Z'],
    [DF, '2018-11-04', '00:30', '2018-11-04T03:30:00.000Z'], // lacuna do início do horário de verão
  ])('%s %s %s → %s', (fuso, data, hora, esperado) => {
    expect(new Date(instanteDoHorarioDaClinica(data, hora, fuso)).toISOString()).toBe(esperado);
  });

  it('aceita hora com segundos e devolve NaN para entrada inválida', () => {
    expect(instanteDoHorarioDaClinica('2026-10-02', '09:00:00', AC)).toBe(Date.parse('2026-10-02T14:00:00Z'));
    expect(instanteDoHorarioDaClinica('2026-02-30', '09:00', AC)).toBeNaN();
    expect(instanteDoHorarioDaClinica('2026-10-02', '25:00', AC)).toBeNaN();
  });
});
