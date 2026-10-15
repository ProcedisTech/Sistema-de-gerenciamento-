import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { AgendaTopbar } from './AgendaTopbar.jsx';
import { WeekTimeGrid } from './WeekTimeGrid.jsx';
import { AgendaDayRailTimelineStrip } from './AgendaDayRailTimelineStrip.jsx';
import { formatCountdown, getNowLineLeftPercent } from '../../utils/agendaRailHelpers.js';
import { agoraDaClinica } from '../../utils/datasClinica.js';

const org = vi.hoisted(() => ({ fusoHorario: null }));

vi.mock('../../contexts/OrgContext', () => ({
  useOrg: () => ({ fusoHorario: org.fusoHorario, recarregarContextoOrg: vi.fn() }),
}));

function nowTopPx() {
  const [linha] = screen.getAllByTitle('Hora atual');
  return parseFloat(linha.style.top);
}

describe('relógio da agenda no fuso da clínica', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    org.fusoHorario = null;
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  describe('AgendaTopbar', () => {
    beforeEach(() => {
      // 19:30 em Rio Branco = 21:30 em Brasília = 00:30 UTC de 02/10.
      vi.setSystemTime(new Date('2026-10-02T00:30:00Z'));
    });

    it('mostra a hora da clínica do Acre', () => {
      org.fusoHorario = 'America/Rio_Branco';
      render(<AgendaTopbar viewMode="dia" onChangeViewMode={() => {}} />);
      expect(screen.getByLabelText('Horário atual 19:30')).toBeTruthy();
    });

    it('mostra a hora da clínica de Brasília', () => {
      org.fusoHorario = 'America/Sao_Paulo';
      render(<AgendaTopbar viewMode="dia" onChangeViewMode={() => {}} />);
      expect(screen.getByLabelText('Horário atual 21:30')).toBeTruthy();
    });

    it('sem fuso carregado mostra placeholder em vez da hora do navegador', () => {
      render(<AgendaTopbar viewMode="dia" onChangeViewMode={() => {}} />);
      expect(screen.getByLabelText('Horário atual --:--')).toBeTruthy();
    });
  });

  describe('linha do "agora"', () => {
    beforeEach(() => {
      // 10:00 em Rio Branco, 12:00 em Brasília (15:00 UTC de 01/10).
      vi.setSystemTime(new Date('2026-10-01T15:00:00Z'));
      if (!Element.prototype.scrollTo) {
        Element.prototype.scrollTo = () => {};
      }
    });

    it('semana: sem fuso carregado não desenha a linha', () => {
      render(
        <WeekTimeGrid
          weekDayIsos={['2026-09-27', '2026-09-28', '2026-09-29', '2026-09-30', '2026-10-01', '2026-10-02', '2026-10-03']}
          appointments={[]}
          todayIso="2026-10-01"
        />,
      );
      expect(screen.queryAllByTitle('Hora atual')).toHaveLength(0);
    });

    it('semana: a linha fica no minuto da clínica (AC 2h acima de DF)', () => {
      const props = {
        weekDayIsos: ['2026-09-27', '2026-09-28', '2026-09-29', '2026-09-30', '2026-10-01', '2026-10-02', '2026-10-03'],
        appointments: [],
        todayIso: '2026-10-01',
      };

      org.fusoHorario = 'America/Rio_Branco';
      const { unmount } = render(<WeekTimeGrid {...props} />);
      const topAc = nowTopPx();
      unmount();

      org.fusoHorario = 'America/Sao_Paulo';
      render(<WeekTimeGrid {...props} />);
      const topDf = nowTopPx();

      expect(topDf - topAc).toBe((120 / 30) * 48);
    });

    it('trilho do dia: posição da linha segue os minutos da clínica', () => {
      const axis = { startMin: 6 * 60, endMin: 22 * 60 };
      const minAc = agoraDaClinica('America/Rio_Branco').minutos;
      const minDf = agoraDaClinica('America/Sao_Paulo').minutos;
      expect(minAc).toBe(10 * 60);
      expect(minDf).toBe(12 * 60);

      expect(getNowLineLeftPercent(minAc, '2026-10-01', '2026-10-01', axis)).toBeCloseTo(25);
      expect(getNowLineLeftPercent(minDf, '2026-10-01', '2026-10-01', axis)).toBeCloseTo(37.5);
      expect(getNowLineLeftPercent(null, '2026-10-01', '2026-10-01', axis)).toBeNull();

      const { container } = render(
        <AgendaDayRailTimelineStrip
          appointments={[]}
          selectedDay="2026-10-01"
          todayIso="2026-10-01"
          nowMinutes={minAc}
        />,
      );
      const linha = container.querySelector('[aria-hidden][style*="left"].bg-vivid-teal-700');
      expect(linha).toBeTruthy();
      const esperado = getNowLineLeftPercent(minAc, '2026-10-01', '2026-10-01');
      expect(parseFloat(linha.style.left)).toBeCloseTo(esperado);
    });

    it('contagem regressiva usa o minuto da clínica', () => {
      expect(formatCountdown('11:00', agoraDaClinica('America/Rio_Branco').minutos)).toBe('1h');
      expect(formatCountdown('11:00', agoraDaClinica('America/Sao_Paulo').minutos)).toBe('agora');
      expect(formatCountdown('11:00', null)).toBe('');
    });
  });
});
