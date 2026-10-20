/**
 * Testador T6 (B-42 rodada 3, item 6a): a lista de status de consulta fechada vem de consultaServidor.js.
 * Trava os 3 valores (encerrado também, que o teste original não cobre), maiúsculas e status nulo/indefinido/vazio.
 */
import { describe, expect, it } from 'vitest';
import { cardDoAtalho } from './loteAgendasDoPaciente.js';
import { STATUS_FECHADOS } from '../components/consulta/consultaServidor.js';
import { agruparAgendamentosHojePulse } from './sortAgendamentosHojePulse.js';

const DF = 'America/Sao_Paulo';
const DIA = '2026-10-09';
const AGORA_DATE = new Date('2026-10-09T08:10:00Z');

const linha = (id, extras) => ({
  id,
  agendaId: id,
  data: DIA,
  tipo: 'atendimento',
  horaInicio: '05:00',
  horaFim: '05:30',
  status: 'confirmado',
  pacienteId: 'p-ana',
  pacienteNome: 'Ana',
  profissionalRoleUserId: 'ru-1',
  roleUserId: 'ru-1',
  procedimentoNome: 'Botox',
  catalogoProcedimentoSaudeId: 'cat-1',
  planejamentoItemId: null,
  atendimentoId: 'at-1',
  atendimentoStatusCodigo: null,
  ...extras,
});

const atalho = (statusConsulta, extras = {}) => {
  const rows = [linha('a05', { atendimentoStatusCodigo: statusConsulta, ...extras })];
  const r = cardDoAtalho(agruparAgendamentosHojePulse(rows, DF, AGORA_DATE), 'p-ana', `${DIA} 05:10`);
  return r ? r.linhas.map((l) => l.id) : null;
};

describe('T6 · loteAgendasDoPaciente usa STATUS_FECHADOS de consultaServidor.js', () => {
  it('a lista é exatamente encerrado, cancelado, abandonado', () => {
    expect([...STATUS_FECHADOS].sort()).toEqual(['abandonado', 'cancelado', 'encerrado']);
  });

  it.each(['encerrado', 'ENCERRADO', 'cancelado', 'Abandonado'])('consulta %s: agenda conta como não iniciada', (s) => {
    expect(atalho(s)).toEqual(['a05']);
  });

  it.each([null, undefined, '', 'aberto', 'xyz'])('consulta com id e status %s: segura o card', (s) => {
    expect(atalho(s)).toBeNull();
  });

  it('sem consulta (atendimentoId nulo): não iniciada, qualquer que seja o status da consulta', () => {
    expect(atalho('aberto', { atendimentoId: null })).toEqual(['a05']);
  });
});
