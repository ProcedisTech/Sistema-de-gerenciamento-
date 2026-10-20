import React from 'react';
import { render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import '@testing-library/jest-dom';
import { PatientsTodayStrip } from './PatientsTodayStrip.jsx';
import { agruparAgendamentosHojePulse } from '../../utils/sortAgendamentosHojePulse.js';

vi.mock('../hooks/useFusoClinica', () => ({
  useFusoClinica: () => ({ fuso: 'America/Sao_Paulo', pronto: true, recarregarFuso: () => {} }),
}));

const DF = 'America/Sao_Paulo';
const NOW = new Date('2026-10-02T12:00:00Z'); // 09:00 em Brasília

const ag = (id, overrides) => ({
  id,
  agendaId: id,
  data: '2026-10-02',
  tipo: 'atendimento',
  pacienteId: 'p1',
  pacienteNome: 'Maria Silva',
  profissionalRoleUserId: 'ru-a',
  roleUserId: 'ru-a',
  status: 'pendente',
  ...overrides,
});

describe('PatientsTodayStrip · conta cards', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(NOW);
  });
  afterEach(() => vi.useRealTimers());

  it('grupo de 2 + 1 simples: próximo = 1º card, "+1 mais hoje" (não +2)', () => {
    const rows = [
      ag('a1', { horaInicio: '10:00', horaFim: '10:30' }),
      ag('a2', { horaInicio: '10:30', horaFim: '11:00' }),
      ag('b1', { horaInicio: '14:00', horaFim: '14:30', pacienteId: 'p2', pacienteNome: 'Ana Souza' }),
    ];
    render(
      <PatientsTodayStrip
        kpi={{ agendamentosHoje: rows, entradasHoje: agruparAgendamentosHojePulse(rows, DF, NOW), aniversariantesList: [] }}
      />,
    );
    expect(screen.getByText('Maria Silva')).toBeInTheDocument();
    expect(screen.getByText('10:00')).toBeInTheDocument();
    expect(screen.getByText('+1 mais hoje')).toBeInTheDocument();
    expect(screen.queryByText('+2 mais hoje')).not.toBeInTheDocument();
  });

  it('só um grupo de 2: nenhum "+N mais hoje"', () => {
    const rows = [
      ag('a1', { horaInicio: '10:00', horaFim: '10:30' }),
      ag('a2', { horaInicio: '10:30', horaFim: '11:00' }),
    ];
    render(
      <PatientsTodayStrip
        kpi={{ agendamentosHoje: rows, entradasHoje: agruparAgendamentosHojePulse(rows, DF, NOW), aniversariantesList: [] }}
      />,
    );
    expect(screen.getByText('Maria Silva')).toBeInTheDocument();
    expect(screen.queryByText(/mais hoje/)).not.toBeInTheDocument();
  });
});
