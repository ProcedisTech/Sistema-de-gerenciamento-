import { describe, it, expect } from 'vitest';
import { getRailCardActions, getGroupedRailCardActions, getRailPrimaryLabel, getConsultaEmAndamento } from './agendaCardActions.js';

describe('agendaCardActions', () => {
  describe('getRailCardActions', () => {
    it('inclui cancelar para status pendente e confirmado se canCancelarAgendamento for true', () => {
      const pending = getRailCardActions('pendente', true, true);
      expect(pending.secondary).toContain('cancelar');

      const confirmed = getRailCardActions('confirmado', true, true);
      expect(confirmed.secondary).toContain('cancelar');
    });

    it('NÃO inclui cancelar se canCancelarAgendamento for false', () => {
      const pending = getRailCardActions('pendente', true, false);
      expect(pending.secondary).not.toContain('cancelar');

      const confirmed = getRailCardActions('confirmado', true, false);
      expect(confirmed.secondary).not.toContain('cancelar');
    });

    it('mantém padrão retrocompatível (canCancelarAgendamento padrão true)', () => {
      const res = getRailCardActions('confirmado', true);
      expect(res.secondary).toContain('cancelar');
    });
  });

  describe('getGroupedRailCardActions', () => {
    it('inclui cancelar se houver status ativo e canCancelarAgendamento for true', () => {
      const res = getGroupedRailCardActions(['pendente', 'confirmado'], true, true);
      expect(res.secondary).toContain('cancelar');
    });

    it('NÃO inclui cancelar se canCancelarAgendamento for false', () => {
      const res = getGroupedRailCardActions(['pendente', 'confirmado'], true, false);
      expect(res.secondary).not.toContain('cancelar');
    });
  });

  describe('getRailPrimaryLabel', () => {
    it('retorna labels corretos', () => {
      expect(getRailPrimaryLabel('confirmar')).toBe('Confirmar');
      expect(getRailPrimaryLabel('iniciar')).toBe('Iniciar atendimento');
      expect(getRailPrimaryLabel(null)).toBeNull();
    });
  });
});

describe('agendaCardActions — consulta em andamento (Camada 2)', () => {
  const EU = 'ru-eu';
  const OUTRA = 'ru-outra';
  const linha = (status, anfitriao = EU, id = 'at-1') => ({
    atendimentoId: id,
    atendimentoStatusCodigo: status,
    atendimentoAnfitriaoRoleUserId: anfitriao,
  });

  it('getConsultaEmAndamento: aberto com anfitriã = eu → emAndamento, minha, atendimentoId', () => {
    expect(getConsultaEmAndamento([linha('aberto')], EU)).toEqual({ emAndamento: true, minha: true, atendimentoId: 'at-1' });
  });

  it('getConsultaEmAndamento: só "aberto" é em andamento (a pausa não existe mais; status desconhecido não conta)', () => {
    expect(getConsultaEmAndamento([linha('pausado')], EU)).toEqual({ emAndamento: false, minha: false, atendimentoId: null });
  });

  it('getConsultaEmAndamento: abandonado/finalizado/sem consulta → não está em andamento', () => {
    expect(getConsultaEmAndamento([linha('abandonado')], EU).emAndamento).toBe(false);
    expect(getConsultaEmAndamento([linha('finalizado')], EU).emAndamento).toBe(false);
    expect(getConsultaEmAndamento([{}], EU).emAndamento).toBe(false);
    expect(getConsultaEmAndamento(null, EU).emAndamento).toBe(false);
  });

  it('getConsultaEmAndamento: anfitriã outra → minha=false; sem meu id → minha=false', () => {
    expect(getConsultaEmAndamento([linha('aberto', OUTRA)], EU).minha).toBe(false);
    expect(getConsultaEmAndamento([linha('aberto', OUTRA)], null).minha).toBe(false);
    expect(getConsultaEmAndamento([linha('aberto', '')], '').minha).toBe(false);
  });

  it('getConsultaEmAndamento: grupo com 1 de 2 aberto → emAndamento (basta um)', () => {
    const r = getConsultaEmAndamento([{ atendimentoStatusCodigo: null }, linha('aberto', EU, 'at-9')], EU);
    expect(r).toEqual({ emAndamento: true, minha: true, atendimentoId: 'at-9' });
  });

  it('getRailCardActions: aberto + minha → primary voltar, emAndamento, atendimentoId', () => {
    const and = getConsultaEmAndamento([linha('aberto')], EU);
    const r = getRailCardActions('confirmado', true, true, and);
    expect(r.primary).toBe('voltar');
    expect(r.emAndamento).toBe(true);
    expect(r.atendimentoId).toBe('at-1');
  });

  it('getRailCardActions: anfitriã outra → primary null (sem iniciar), mas emAndamento', () => {
    const and = getConsultaEmAndamento([linha('aberto', OUTRA)], EU);
    const r = getRailCardActions('confirmado', true, true, and);
    expect(r.primary).toBeNull();
    expect(r.primary).not.toBe('iniciar');
    expect(r.emAndamento).toBe(true);
  });

  it('getRailCardActions: abandonado → igual ao normal (iniciar)', () => {
    const and = getConsultaEmAndamento([linha('abandonado')], EU);
    const r = getRailCardActions('confirmado', true, true, and);
    expect(r.primary).toBe('iniciar');
    expect(r.emAndamento).toBe(false);
    expect(r.secondary).toEqual(['anamnese', 'whatsapp', 'reagendar', 'cancelar']);
  });

  it('com andamento: cancelar e reagendar fora do secondary; whatsapp e anamnese ficam', () => {
    const and = getConsultaEmAndamento([linha('aberto')], EU);
    for (const r of [
      getRailCardActions('confirmado', true, true, and),
      getRailCardActions('pendente', true, true, and),
      getGroupedRailCardActions(['pendente', 'confirmado'], true, true, and),
    ]) {
      expect(r.secondary).not.toContain('cancelar');
      expect(r.secondary).not.toContain('reagendar');
      expect(r.secondary).toContain('whatsapp');
      expect(r.secondary).toContain('anamnese');
    }
  });

  it('getGroupedRailCardActions: grupo com 1 de 2 aberto → voltar + emAndamento', () => {
    const and = getConsultaEmAndamento([linha(null), linha('aberto', EU, 'at-2')], EU);
    const r = getGroupedRailCardActions(['confirmado', 'confirmado'], true, true, and);
    expect(r.primary).toBe('voltar');
    expect(r.emAndamento).toBe(true);
    expect(r.atendimentoId).toBe('at-2');
  });

  it('getGroupedRailCardActions: outra profissional → primary null, sem iniciar/confirmar', () => {
    const and = getConsultaEmAndamento([linha('aberto', OUTRA)], EU);
    expect(getGroupedRailCardActions(['pendente'], true, true, and).primary).toBeNull();
    expect(getGroupedRailCardActions(['confirmado'], true, true, and).primary).toBeNull();
  });

  it('getRailPrimaryLabel("voltar") = "Voltar à consulta"', () => {
    expect(getRailPrimaryLabel('voltar')).toBe('Voltar à consulta');
  });

  it('sem andamento (4º parâmetro ausente ou emAndamento=false) → igual ao de hoje', () => {
    const semAnd = { emAndamento: false, minha: false, atendimentoId: null };
    expect(getRailCardActions('confirmado', true, true)).toEqual({
      primary: 'iniciar', secondary: ['anamnese', 'whatsapp', 'reagendar', 'cancelar'], emAndamento: false,
    });
    expect(getRailCardActions('pendente', true, true, semAnd)).toEqual({
      primary: 'confirmar', secondary: ['anamnese', 'whatsapp', 'reagendar', 'cancelar'], emAndamento: false,
    });
    expect(getRailCardActions('realizado', true, true, semAnd)).toEqual({
      primary: null, secondary: ['anamnese', 'whatsapp', 'reagendar'], emAndamento: false,
    });
    expect(getGroupedRailCardActions(['confirmado', 'confirmado'], true, true, semAnd)).toEqual({
      primary: 'iniciar', secondary: ['anamnese', 'whatsapp', 'reagendar', 'cancelar'], emAndamento: false,
    });
  });
});
