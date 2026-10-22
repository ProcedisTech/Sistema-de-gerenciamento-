import React from 'react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { HorarioClinicaPanel } from './HorarioClinicaPanel.jsx';

const mocks = vi.hoisted(() => ({
  buscarHorarios: vi.fn(),
  atualizarHorarios: vi.fn(),
  success: vi.fn(),
  error: vi.fn(),
  isDono: vi.fn(() => true),
}));

vi.mock('../../services/api.js', () => ({
  organizacoesHorariosApi: {
    buscar: mocks.buscarHorarios,
    atualizar: mocks.atualizarHorarios,
  },
  getApiErrorToastMessage: (e, fallback) => e.message || fallback,
}));

vi.mock('../../contexts/OrgContext.jsx', () => ({
  useOrg: () => ({ orgId: 'test-org-123' }),
}));

vi.mock('../../hooks/usePapel.js', () => ({
  usePapel: () => ({ isDono: mocks.isDono() }),
}));

vi.mock('../../contexts/useToast.js', () => ({
  useToast: () => ({ success: mocks.success, error: mocks.error }),
}));

beforeEach(() => {
  mocks.buscarHorarios.mockResolvedValue([
    { id: 'h1', diaSemana: 1, horaInicio: '08:00', horaFim: '18:00', ativo: true },
  ]);
  mocks.atualizarHorarios.mockResolvedValue([]);
  mocks.isDono.mockReturnValue(true);
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

it('permite que o Dono edite e salve horários da clínica sem seletor de tipoOrg', async () => {
  mocks.isDono.mockReturnValue(true);
  const onDirty = vi.fn();
  const onInvalidate = vi.fn();
  render(<HorarioClinicaPanel onDirtyChange={onDirty} onDisponibilidadeInvalidate={onInvalidate} />);

  expect(await screen.findByRole('button', { name: 'Salvar' })).toBeDisabled();
  expect(screen.queryByRole('radio')).not.toBeInTheDocument();

  const switchTerca = screen.getByRole('switch', { name: 'Terça-feira inativo' });
  fireEvent.click(switchTerca);
  expect(onDirty).toHaveBeenLastCalledWith(true);

  const btnSalvar = screen.getByRole('button', { name: 'Salvar' });
  expect(btnSalvar).not.toBeDisabled();

  fireEvent.click(btnSalvar);
  await waitFor(() => {
    expect(mocks.atualizarHorarios).toHaveBeenCalledWith(
      'test-org-123',
      expect.arrayContaining([
        expect.objectContaining({ diaSemana: 1, horaInicio: '08:00', horaFim: '18:00' }),
        expect.objectContaining({ diaSemana: 2, horaInicio: '08:00', horaFim: '18:00' }),
      ]),
    );
    expect(onInvalidate).toHaveBeenCalledWith({ scope: 'all' });
    expect(mocks.success).toHaveBeenCalledWith('Configurações salvas');
    expect(onDirty).toHaveBeenLastCalledWith(false);
  });
});

it('bloqueia edição e exibe banner exclusivo do Dono para usuários não-dono', async () => {
  mocks.isDono.mockReturnValue(false);
  render(<HorarioClinicaPanel />);

  expect(
    await screen.findByText(
      'Apenas o Dono da clínica pode alterar os horários gerais de funcionamento.',
    ),
  ).toBeInTheDocument();
  expect(screen.getByText('Exclusivo do Dono')).toBeInTheDocument();
  expect(screen.queryByRole('radio')).not.toBeInTheDocument();

  const btnSalvar = screen.getByRole('button', { name: 'Salvar' });
  expect(btnSalvar).toBeDisabled();
  expect(btnSalvar).toHaveAttribute('title', 'Apenas o Dono da clínica pode salvar');
});

it('exibe alerta de erro e permite tentar novamente quando o carregamento falha', async () => {
  mocks.buscarHorarios.mockRejectedValueOnce(new Error('Falha ao carregar horários'));
  render(<HorarioClinicaPanel />);

  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Não foi possível carregar os horários de funcionamento da clínica.',
  );
  expect(mocks.error).toHaveBeenCalledWith('Falha ao carregar horários');
  fireEvent.click(screen.getByRole('button', { name: 'Tentar novamente' }));

  expect(await screen.findByRole('switch', { name: 'Segunda-feira ativo' })).toBeInTheDocument();
  expect(mocks.buscarHorarios).toHaveBeenCalledTimes(2);
});

it('preserva rascunho e permite tentar salvar novamente quando a API falha', async () => {
  const dirty = vi.fn();
  render(<HorarioClinicaPanel onDirtyChange={dirty} />);
  await screen.findByRole('switch', { name: 'Segunda-feira ativo' });

  fireEvent.click(screen.getByRole('switch', { name: 'Terça-feira inativo' }));
  expect(dirty).toHaveBeenLastCalledWith(true);

  mocks.atualizarHorarios.mockRejectedValueOnce(new Error('Falha temporária'));
  fireEvent.click(screen.getByRole('button', { name: 'Salvar' }));

  await waitFor(() => expect(mocks.error).toHaveBeenCalledWith('Falha temporária'));
  expect(screen.getByRole('button', { name: 'Salvar' })).toBeEnabled();
  expect(dirty).toHaveBeenLastCalledWith(true);

  fireEvent.click(screen.getByRole('button', { name: 'Salvar' }));
  await waitFor(() => expect(dirty).toHaveBeenLastCalledWith(false));
});
