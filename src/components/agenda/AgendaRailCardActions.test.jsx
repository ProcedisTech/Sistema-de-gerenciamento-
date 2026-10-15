import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AgendaRailCardActions } from './AgendaRailCardActions.jsx';

describe('AgendaRailCardActions', () => {
  const mockAppointment = {
    id: 'appt-1',
    status: 'confirmado',
    pacienteNome: 'Maria Silva',
  };

  it('exibe o botão Cancelar quando secondary contém "cancelar" e onCancelar é fornecido', () => {
    const handleCancelar = vi.fn();
    render(
      <AgendaRailCardActions
        appointment={mockAppointment}
        actions={{ primary: null, secondary: ['cancelar', 'reagendar'] }}
        onCancelar={handleCancelar}
      />
    );

    const btn = screen.getByRole('button', { name: /cancelar/i });
    expect(btn).toBeInTheDocument();

    fireEvent.click(btn);
    expect(handleCancelar).toHaveBeenCalledWith(mockAppointment);
  });

  it('NÃO exibe o botão Cancelar se onCancelar for null mesmo que secondary contenha "cancelar"', () => {
    render(
      <AgendaRailCardActions
        appointment={mockAppointment}
        actions={{ primary: null, secondary: ['cancelar', 'reagendar'] }}
        onCancelar={null}
      />
    );

    expect(screen.queryByRole('button', { name: /cancelar/i })).not.toBeInTheDocument();
  });

  it('NÃO exibe o botão Cancelar se secondary não contiver "cancelar"', () => {
    const handleCancelar = vi.fn();
    render(
      <AgendaRailCardActions
        appointment={mockAppointment}
        actions={{ primary: null, secondary: ['reagendar', 'whatsapp'] }}
        onCancelar={handleCancelar}
      />
    );

    expect(screen.queryByRole('button', { name: /cancelar/i })).not.toBeInTheDocument();
  });
});

describe('AgendaRailCardActions — consulta em andamento (Camada 2)', () => {
  const appt = { id: 'appt-2', status: 'confirmado', pacienteNome: 'Ana' };

  it('mostra "Em andamento" e "Voltar à consulta" quando a consulta é minha', () => {
    render(
      <AgendaRailCardActions
        appointment={appt}
        actions={{ primary: 'voltar', secondary: ['anamnese', 'whatsapp'], emAndamento: true, atendimentoId: 'at-7' }}
      />
    );
    expect(screen.getByText('Em andamento')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Voltar à consulta' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /reagendar/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /cancelar/i })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /whatsapp/i })).toBeInTheDocument();
  });

  it('clique em "Voltar à consulta" chama onVoltarConsulta(atendimentoId) mesmo com onPrimaryClick presente', () => {
    const onVoltar = vi.fn();
    const onPrimary = vi.fn();
    const onIniciar = vi.fn();
    render(
      <AgendaRailCardActions
        appointment={appt}
        actions={{ primary: 'voltar', secondary: [], emAndamento: true, atendimentoId: 'at-7' }}
        onVoltarConsulta={onVoltar}
        onPrimaryClick={onPrimary}
        onIniciarAtendimento={onIniciar}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: 'Voltar à consulta' }));
    expect(onVoltar).toHaveBeenCalledTimes(1);
    expect(onVoltar).toHaveBeenCalledWith('at-7');
    expect(onPrimary).not.toHaveBeenCalled();
    expect(onIniciar).not.toHaveBeenCalled();
  });

  it('outra profissional: chip "Em andamento" sem botão principal', () => {
    render(
      <AgendaRailCardActions
        appointment={appt}
        actions={{ primary: null, secondary: ['anamnese', 'whatsapp'], emAndamento: true, atendimentoId: 'at-7' }}
        onVoltarConsulta={vi.fn()}
      />
    );
    expect(screen.getByText('Em andamento')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /voltar à consulta/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /iniciar atendimento/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^confirmar$/i })).not.toBeInTheDocument();
  });

  it('sem andamento: sem chip, com "Iniciar atendimento"', () => {
    render(
      <AgendaRailCardActions
        appointment={appt}
        actions={{ primary: 'iniciar', secondary: ['whatsapp'], emAndamento: false }}
      />
    );
    expect(screen.queryByText('Em andamento')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Iniciar atendimento' })).toBeInTheDocument();
  });
});
