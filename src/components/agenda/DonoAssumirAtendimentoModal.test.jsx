import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { DonoAssumirAtendimentoModal } from './DonoAssumirAtendimentoModal.jsx';

describe('DonoAssumirAtendimentoModal', () => {
  const mockAppointment = {
    pacienteNome: 'Ana Carolina Lima Carvalho',
    procedimentoNome: 'Toxina Botulínica (Botox)',
    profissionalNome: 'Dra. Camila Souza',
  };

  it('não renderiza nada quando isOpen for false', () => {
    const { container } = render(
      <DonoAssumirAtendimentoModal
        isOpen={false}
        appointment={mockAppointment}
        onClose={vi.fn()}
        onConfirm={vi.fn()}
      />
    );
    expect(container.firstChild).toBeNull();
  });

  it('renderiza Etapa 1 por padrão ao abrir', () => {
    render(
      <DonoAssumirAtendimentoModal
        isOpen={true}
        appointment={mockAppointment}
        donoNome="Dr. Guilherme Barcelos"
        onClose={vi.fn()}
        onConfirm={vi.fn()}
      />
    );

    expect(screen.getByText(/Etapa 1 de 2 · Responsabilidade Clínica/i)).toBeInTheDocument();
    expect(screen.getByText('Dra. Camila Souza')).toBeInTheDocument();
    expect(screen.getByText('Dr. Guilherme Barcelos')).toBeInTheDocument();
    expect(screen.getByText(/Atenção aos registros médicos e legais/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Avançar para Confirmação/i })).toBeInTheDocument();
  });

  it('avança para Etapa 2 ao clicar em Avançar e permite voltar à Etapa 1', () => {
    render(
      <DonoAssumirAtendimentoModal
        isOpen={true}
        appointment={mockAppointment}
        donoNome="Dr. Guilherme Barcelos"
        onClose={vi.fn()}
        onConfirm={vi.fn()}
      />
    );

    // Clica para avançar
    fireEvent.click(screen.getByRole('button', { name: /Avançar para Confirmação/i }));

    // Agora está na Etapa 2
    expect(screen.getByText(/Etapa 2 de 2 · Confirmação Definitiva/i)).toBeInTheDocument();
    expect(screen.getByText(/Confirmar Início Imediato da Consulta/i)).toBeInTheDocument();
    expect(screen.getByText(/Sim, Iniciar Atendimento/i)).toBeInTheDocument();

    // Clica para voltar
    fireEvent.click(screen.getByRole('button', { name: /Voltar à Etapa 1/i }));
    expect(screen.getByText(/Etapa 1 de 2 · Responsabilidade Clínica/i)).toBeInTheDocument();
  });

  it('chama onConfirm com o agendamento ao clicar em Sim, Iniciar Atendimento na Etapa 2', () => {
    const onConfirmMock = vi.fn();
    render(
      <DonoAssumirAtendimentoModal
        isOpen={true}
        appointment={mockAppointment}
        donoNome="Dr. Guilherme Barcelos"
        onClose={vi.fn()}
        onConfirm={onConfirmMock}
      />
    );

    // Avança para etapa 2
    fireEvent.click(screen.getByRole('button', { name: /Avançar para Confirmação/i }));

    // Confirma
    fireEvent.click(screen.getByRole('button', { name: /Sim, Iniciar Atendimento/i }));
    expect(onConfirmMock).toHaveBeenCalledTimes(1);
    expect(onConfirmMock).toHaveBeenCalledWith(mockAppointment);
  });

  it('chama onClose ao clicar em Cancelar ou no botão X', () => {
    const onCloseMock = vi.fn();
    render(
      <DonoAssumirAtendimentoModal
        isOpen={true}
        appointment={mockAppointment}
        donoNome="Dr. Guilherme Barcelos"
        onClose={onCloseMock}
        onConfirm={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /Cancelar/i }));
    expect(onCloseMock).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: /Fechar modal/i }));
    expect(onCloseMock).toHaveBeenCalledTimes(2);
  });
});

