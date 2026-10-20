import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { HorarioSemanaEditor } from './HorarioSemanaEditor';

describe('HorarioSemanaEditor', () => {
  it('renderiza os 7 dias e badges de status da clínica quando gradeClinica é fornecida', () => {
    const diasConfig = [
      { ativo: false, turnos: [] }, // 0: Domingo
      { ativo: true, turnos: [{ horaInicio: '08:00', horaFim: '18:00' }] }, // 1: Segunda
      { ativo: false, turnos: [] },
      { ativo: false, turnos: [] },
      { ativo: false, turnos: [] },
      { ativo: false, turnos: [] },
      { ativo: true, turnos: [{ horaInicio: '09:00', horaFim: '13:00' }] }, // 6: Sábado
    ];

    const gradeClinica = [
      { diaSemana: 1, horaInicio: '08:00', horaFim: '18:00', ativo: true },
    ];

    render(
      <HorarioSemanaEditor
        diasConfig={diasConfig}
        onChange={vi.fn()}
        gradeClinica={gradeClinica}
      />
    );

    // Segunda-feira deve mostrar o expediente da clínica
    const statusSegunda = screen.getByTestId('clinica-status-1');
    expect(statusSegunda).toHaveTextContent('Expediente: 08:00 - 18:00');

    // Sábado deve mostrar clínica fechada e o alerta de exceção
    const statusSabado = screen.getByTestId('clinica-status-6');
    expect(statusSabado).toHaveTextContent('Clínica fechada');

    const alertaSabado = screen.getByTestId('alerta-dia-fechado-6');
    expect(alertaSabado).toHaveTextContent('Horário de exceção (clínica fechada)');
  });

  it('exibe alerta de turno fora do expediente quando horário ultrapassa o da clínica', () => {
    const diasConfig = [
      { ativo: false, turnos: [] },
      { ativo: true, turnos: [{ horaInicio: '08:00', horaFim: '20:00' }] }, // Ultrapassa 18h
      { ativo: false, turnos: [] },
      { ativo: false, turnos: [] },
      { ativo: false, turnos: [] },
      { ativo: false, turnos: [] },
      { ativo: false, turnos: [] },
    ];

    const gradeClinica = [
      { diaSemana: 1, horaInicio: '08:00', horaFim: '18:00', ativo: true },
    ];

    render(
      <HorarioSemanaEditor
        diasConfig={diasConfig}
        onChange={vi.fn()}
        gradeClinica={gradeClinica}
      />
    );

    const alertaTurno = screen.getByTestId('alerta-turno-fora-1-0');
    expect(alertaTurno).toHaveTextContent('Fora do expediente da clínica (08:00 - 18:00)');
  });
});
