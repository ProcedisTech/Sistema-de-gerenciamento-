import { describe, expect, it } from 'vitest';
import { normalizeDisponibilidade } from './normalizeDisponibilidade.js';

describe('normalizeDisponibilidade — Backlog B-45 & Issue #260', () => {
  const clinicaHorarios = [
    { diaSemana: 1, horaInicio: '08:00', horaFim: '18:00', ativo: true },
    { diaSemana: 2, horaInicio: '08:00', horaFim: '18:00', ativo: true },
  ];

  const turnosManuais = [
    { diaSemana: 3, horaInicio: '09:00', horaFim: '13:00', ativo: true },
    { diaSemana: 4, horaInicio: '14:00', horaFim: '17:00', ativo: true },
  ];

  it('herda grade da clínica quando seguirHorarioClinica é true (envelope do backend)', () => {
    const raw = {
      seguirHorarioClinica: true,
      turnos: [],
      gradeClinica: [
        { diaSemana: 1, horaInicio: '08:00', horaFim: '18:00', ativo: true },
      ],
    };
    const result = normalizeDisponibilidade(raw, clinicaHorarios);
    expect(result).toHaveLength(1);
    expect(result[0].diaSemana).toBe(1);
    expect(result[0].horaInicio).toBe('08:00');
  });

  it('usa turnos manuais quando seguirHorarioClinica é false', () => {
    const raw = {
      seguirHorarioClinica: false,
      turnos: turnosManuais,
      gradeClinica: clinicaHorarios,
    };
    const result = normalizeDisponibilidade(raw, clinicaHorarios);
    expect(result).toHaveLength(2);
    expect(result[0].diaSemana).toBe(3);
    expect(result[0].horaInicio).toBe('09:00');
    expect(result[1].diaSemana).toBe(4);
    expect(result[1].horaInicio).toBe('14:00');
  });

  it('filtra turnos com ativo === false', () => {
    const raw = {
      seguirHorarioClinica: false,
      turnos: [
        { diaSemana: 1, horaInicio: '08:00', horaFim: '12:00', ativo: true },
        { diaSemana: 2, horaInicio: '08:00', horaFim: '12:00', ativo: false },
      ],
      gradeClinica: [],
    };
    const result = normalizeDisponibilidade(raw, clinicaHorarios);
    expect(result).toHaveLength(1);
    expect(result[0].diaSemana).toBe(1);
  });

  it('suporta array direto legado (compatibilidade retroativa)', () => {
    const raw = [
      { diaSemana: 5, horaInicio: '10:00', horaFim: '16:00', ativo: true },
    ];
    const result = normalizeDisponibilidade(raw, clinicaHorarios);
    expect(result).toHaveLength(1);
    expect(result[0].diaSemana).toBe(5);
  });

  it('quando raw é array vazio [], preserva lista vazia (profissional zerado)', () => {
    const result = normalizeDisponibilidade([], clinicaHorarios);
    expect(result).toEqual([]);
  });

  it('quando raw é null ou undefined, devolve clinicaHorarios (autônomo / sem profissional)', () => {
    const result = normalizeDisponibilidade(null, clinicaHorarios);
    expect(result).toHaveLength(2);
    expect(result[0].horaInicio).toBe('08:00');
  });

  it('quando raw.gradeClinica está vazio mas seguirHorarioClinica é true, faz fallback para clinicaHorarios', () => {
    const raw = {
      seguirHorarioClinica: true,
      turnos: [],
      gradeClinica: [],
    };
    const result = normalizeDisponibilidade(raw, clinicaHorarios);
    expect(result).toEqual(clinicaHorarios);
  });
});
