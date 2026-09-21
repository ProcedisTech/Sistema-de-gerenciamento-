import { describe, it, expect } from 'vitest';
import { getRailCardActions, getGroupedRailCardActions, getRailPrimaryLabel } from './agendaCardActions.js';

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
