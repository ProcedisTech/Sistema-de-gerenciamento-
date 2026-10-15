import React from 'react';
import { render, screen } from '@testing-library/react';
import { vi } from 'vitest';
import '@testing-library/jest-dom';
import { ConfirmacaoPublicaPage } from './ConfirmacaoPublicaPage.jsx';

const buscar = vi.hoisted(() => vi.fn());

vi.mock('../../services/api.js', () => ({
  confirmacaoPublicaApi: { buscar, responder: vi.fn() },
  getApiErrorToastMessage: (_e, fallback) => fallback,
}));

describe('ConfirmacaoPublicaPage — valores de calendário', () => {
  beforeEach(() => {
    window.history.pushState({}, '', '/confirmar/tok-1');
  });

  afterEach(() => {
    buscar.mockReset();
    window.history.pushState({}, '', '/');
  });

  it('mostra dataAgendamento ISO e horaInicio como vieram, sem converter fuso', async () => {
    buscar.mockResolvedValue({
      status: 'aguardando',
      pacienteNome: 'Ana',
      dataAgendamento: '2026-10-01',
      horaInicio: '21:30:00',
      fusoHorario: 'America/Rio_Branco',
    });
    render(<ConfirmacaoPublicaPage />);
    expect(await screen.findByText('01/10/2026')).toBeInTheDocument();
    expect(screen.getByText('21:30')).toBeInTheDocument();
    expect(buscar).toHaveBeenCalledWith('tok-1');
  });

  it('aceita dataAgendamento já em dd/MM/yyyy', async () => {
    buscar.mockResolvedValue({
      status: 'aguardando',
      pacienteNome: 'Ana',
      dataAgendamento: '31/12/2026',
      horaInicio: '08:00',
    });
    render(<ConfirmacaoPublicaPage />);
    expect(await screen.findByText('31/12/2026')).toBeInTheDocument();
    expect(screen.getByText('08:00')).toBeInTheDocument();
  });
});
