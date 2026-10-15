import React from 'react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { HorarioClinicaPanel } from './HorarioClinicaPanel.jsx';

const mocks = vi.hoisted(() => ({
  buscarConfig: vi.fn(),
  atualizarConfig: vi.fn(),
  buscarHorarios: vi.fn(),
  atualizarHorarios: vi.fn(),
  success: vi.fn(),
  error: vi.fn(),
  isDono: vi.fn(() => true),
}));

vi.mock('../../services/api.js', () => ({
  configuracoesClinicaApi: {
    buscar: mocks.buscarConfig,
    atualizar: mocks.atualizarConfig,
  },
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
  mocks.buscarConfig.mockResolvedValue({ tipoOrg: 'clinica' });
  mocks.buscarHorarios.mockResolvedValue([
    { id: 'h1', diaSemana: 1, horaInicio: '08:00', horaFim: '18:00', ativo: true },
  ]);
  mocks.atualizarConfig.mockResolvedValue({});
  mocks.atualizarHorarios.mockResolvedValue([]);
  mocks.isDono.mockReturnValue(true);
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

it('permite que o Dono edite e salve horários e tipoOrg', async () => {
  mocks.isDono.mockReturnValue(true);
  const onDirty = vi.fn();
  render(<HorarioClinicaPanel onDirtyChange={onDirty} />);

  expect(await screen.findByRole('button', { name: 'Salvar' })).toBeDisabled(); // Inicialmente limpo

  // Altera um horário (liga terça-feira)
  const switchTerca = screen.getByRole('switch', { name: 'Terça-feira inativo' });
  fireEvent.click(switchTerca);

  const btnSalvar = screen.getByRole('button', { name: 'Salvar' });
  expect(btnSalvar).not.toBeDisabled();

  fireEvent.click(btnSalvar);
  await waitFor(() => {
    expect(mocks.atualizarConfig).toHaveBeenCalledWith({ tipoOrg: 'clinica' });
    expect(mocks.atualizarHorarios).toHaveBeenCalled();
    expect(mocks.success).toHaveBeenCalledWith('Configurações salvas');
  });
});

it('bloqueia edição e exibe banner exclusivo do Dono para usuários não-dono', async () => {
  mocks.isDono.mockReturnValue(false);
  render(<HorarioClinicaPanel />);

  expect(
    await screen.findByText(
      'Apenas o Dono da clínica pode alterar o tipo de organização e os horários gerais de funcionamento.',
    ),
  ).toBeInTheDocument();
  expect(screen.getByText('Exclusivo do Dono')).toBeInTheDocument();

  // Radio buttons desabilitados
  const radios = screen.getAllByRole('radio');
  expect(radios[0]).toBeDisabled();
  expect(radios[1]).toBeDisabled();

  // Botão Salvar desabilitado
  const btnSalvar = screen.getByRole('button', { name: 'Salvar' });
  expect(btnSalvar).toBeDisabled();
  expect(btnSalvar).toHaveAttribute('title', 'Apenas o Dono da clínica pode salvar');
});
