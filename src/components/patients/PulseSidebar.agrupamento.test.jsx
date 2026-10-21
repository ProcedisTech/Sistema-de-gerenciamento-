import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import '@testing-library/jest-dom';
import { PulseSidebar } from './PulseSidebar.jsx';
import { agruparAgendamentosHojePulse } from '../../utils/sortAgendamentosHojePulse.js';

const papel = vi.hoisted(() => ({
  isNivel1: false,
  canDeleteAgenda: true,
  canStartAnamnese: true,
  roleUserId: 'ru-eu',
}));

vi.mock('../../hooks/usePapel.js', () => ({ usePapel: () => papel }));
vi.mock('../../hooks/usePatientProfilePhotoSrc.js', () => ({
  usePatientProfilePhotoSrc: () => ({ src: null, loading: false }),
}));
vi.mock('../hooks/useFusoClinica', () => ({
  useFusoClinica: () => ({ fuso: 'America/Sao_Paulo', pronto: true, recarregarFuso: () => {} }),
}));
vi.mock('../../contexts/useToast.js', () => ({
  useToast: () => ({ success: vi.fn(), error: vi.fn(), info: vi.fn() }),
}));

const DF = 'America/Sao_Paulo';
// 12:00Z = 09:00 em Brasília
const NOW = new Date('2026-10-02T12:00:00Z');

function ag(id, overrides) {
  return {
    id,
    agendaId: id,
    data: '2026-10-02',
    tipo: 'atendimento',
    pacienteId: 'p1',
    pacienteNome: 'Maria Silva',
    profissionalRoleUserId: 'ru-eu',
    roleUserId: 'ru-eu',
    status: 'pendente',
    procedimentoNome: 'Botox',
    ...overrides,
  };
}

function montar(rows) {
  const kpi = {
    agendamentosHoje: rows,
    entradasHoje: agruparAgendamentosHojePulse(rows, DF, NOW),
    semPlanoList: [],
    totalSemPlano: 0,
    aniversariantesList: [],
    recarregarAgendaHoje: vi.fn(async () => {}),
  };
  const agendaSchedule = {
    handleAtualizarStatus: vi.fn(async () => true),
    refreshDashboard: vi.fn(async () => {}),
    handleEnviarWhatsApp: vi.fn(),
    openReagendarModal: vi.fn(),
  };
  const utils = render(
    <PulseSidebar
      kpi={kpi}
      loading={false}
      nomeUsuario="Ana"
      getPatientInitials={() => 'MS'}
      agendaSchedule={agendaSchedule}
      onStartAttendance={vi.fn()}
      onSlotCancelar={vi.fn()}
      onVoltarConsulta={vi.fn()}
    />,
  );
  return { ...utils, kpi, agendaSchedule };
}

/** Lista de cards da seção "Agendamentos de hoje". */
function cardsDaSecao() {
  const regiao = screen.getByRole('region', { name: /Agendamentos de hoje/ });
  return within(regiao).getAllByText(/Maria Silva|Ana Souza/).map((el) => el.closest('div.rounded-xl'));
}

function contadorDaSecao() {
  const header = screen.getByRole('button', { name: /Agendamentos de hoje/ });
  return header.querySelector('span.rounded-full')?.textContent ?? null;
}

const resumo = () => screen.getByText((_, el) => el?.tagName === 'P' && /^Hoje você tem/.test(el.textContent || '')).textContent;

describe('PulseSidebar · cards agrupados como na Agenda', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(NOW);
    try { window.localStorage.clear(); } catch { /* sem storage */ }
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('grupo de 2 = 1 linha com "Botox + Preenchimento Labial", "Hoje você tem 1" e contador 1', () => {
    montar([
      ag('a1', { horaInicio: '10:00', horaFim: '10:30', procedimentoNome: 'Botox' }),
      ag('a2', { horaInicio: '10:30', horaFim: '11:00', procedimentoNome: 'Preenchimento Labial' }),
    ]);
    expect(cardsDaSecao()).toHaveLength(1);
    expect(screen.getByText('Botox + Preenchimento Labial')).toBeInTheDocument();
    expect(resumo()).toMatch(/^Hoje você tem 1 atendimento\.?$/);
    expect(contadorDaSecao()).toBe('1');
  });

  it('9h e 16h do mesmo paciente = 2 linhas, "Hoje você tem 2"', () => {
    montar([
      ag('a9', { horaInicio: '09:00', horaFim: '09:30' }),
      ag('a16', { horaInicio: '16:00', horaFim: '16:30' }),
    ]);
    expect(cardsDaSecao()).toHaveLength(2);
    expect(resumo()).toMatch(/^Hoje você tem 2 atendimentos/);
    expect(contadorDaSecao()).toBe('2');
  });

  it('Maria 9h + 9h30 (mesma profissional) com outro paciente às 9h de outra profissional = 1 linha da Maria com "Botox + Preenchimento Labial"', () => {
    montar([
      ag('m1', { horaInicio: '09:00', horaFim: '09:30', procedimentoNome: 'Botox' }),
      ag('o1', {
        horaInicio: '09:00',
        horaFim: '09:30',
        pacienteId: 'p2',
        pacienteNome: 'Ana Souza',
        profissionalRoleUserId: 'ru-outra',
        roleUserId: 'ru-outra',
        procedimentoNome: 'Peeling',
      }),
      ag('m2', { horaInicio: '09:30', horaFim: '10:00', procedimentoNome: 'Preenchimento Labial' }),
    ]);
    const cards = cardsDaSecao();
    expect(cards).toHaveLength(2);
    const regiao = screen.getByRole('region', { name: /Agendamentos de hoje/ });
    expect(within(regiao).getAllByText('Maria Silva')).toHaveLength(1);
    expect(within(regiao).getAllByText('Ana Souza')).toHaveLength(1);
    expect(screen.getByText('Botox + Preenchimento Labial')).toBeInTheDocument();
    expect(contadorDaSecao()).toBe('2');
  });

  it('Confirmar num card simples chama handleAtualizarStatus e depois kpi.recarregarAgendaHoje', async () => {
    const { agendaSchedule, kpi } = montar([ag('s1', { horaInicio: '10:00', horaFim: '10:30' })]);
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar' }));
    await waitFor(() => expect(kpi.recarregarAgendaHoje).toHaveBeenCalledTimes(1));
    expect(agendaSchedule.handleAtualizarStatus).toHaveBeenCalledTimes(1);
    expect(agendaSchedule.handleAtualizarStatus).toHaveBeenCalledWith('s1', 'confirmado');
    expect(agendaSchedule.handleAtualizarStatus.mock.invocationCallOrder[0]).toBeLessThan(
      kpi.recarregarAgendaHoje.mock.invocationCallOrder[0],
    );
  });

  it('Confirmar no grupo confirma só os pendentes e recarrega a agenda de hoje', async () => {
    const { agendaSchedule, kpi } = montar([
      ag('g1', { horaInicio: '10:00', horaFim: '10:30', status: 'pendente', procedimentoNome: 'Botox' }),
      ag('g2', { horaInicio: '10:30', horaFim: '11:00', status: 'confirmado', procedimentoNome: 'Preenchimento Labial' }),
      ag('g3', { horaInicio: '11:00', horaFim: '11:30', status: 'aguardando_confirmacao', procedimentoNome: 'Peeling' }),
    ]);
    expect(cardsDaSecao()).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar' }));
    await waitFor(() => expect(kpi.recarregarAgendaHoje).toHaveBeenCalledTimes(1));
    const ids = agendaSchedule.handleAtualizarStatus.mock.calls.map((c) => c[0]);
    expect(ids).toEqual(['g1', 'g3']);
    for (const call of agendaSchedule.handleAtualizarStatus.mock.calls) {
      expect(call[1]).toBe('confirmado');
    }
    const ultimaConfirmacao = Math.max(...agendaSchedule.handleAtualizarStatus.mock.invocationCallOrder);
    expect(ultimaConfirmacao).toBeLessThan(kpi.recarregarAgendaHoje.mock.invocationCallOrder[0]);
  });

  it('controle: confirmado sem consulta aberta mostra Iniciar atendimento, Reagendar e Cancelar', () => {
    montar([ag('c1', { horaInicio: '10:00', horaFim: '10:30', status: 'confirmado' })]);
    expect(screen.getByRole('button', { name: /Iniciar atendimento/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reagendar' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancelar agendamento' })).toBeInTheDocument();
    expect(screen.queryByText('Em andamento')).not.toBeInTheDocument();
  });

  it('consulta aberta por outra profissional → "Em andamento", sem Iniciar atendimento, sem Cancelar/Reagendar', () => {
    montar([
      ag('c1', {
        horaInicio: '10:00',
        horaFim: '10:30',
        status: 'confirmado',
        atendimentoStatusCodigo: 'aberto',
        atendimentoAnfitriaoRoleUserId: 'ru-outra',
        atendimentoId: 'at-1',
      }),
    ]);
    expect(screen.getByText('Em andamento')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Iniciar atendimento/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Voltar à consulta/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Cancelar agendamento' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Reagendar' })).not.toBeInTheDocument();
  });
});
