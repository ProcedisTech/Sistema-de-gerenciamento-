import { describe, expect, it } from 'vitest';
import {
  formatCartaoDiaPtBr,
  patientUltimaVisitaDayFromDto,
} from './patientProfileDerivedDates.js';

const FUSO_SP = 'America/Sao_Paulo';
const FUSO_ACRE = 'America/Rio_Branco';

describe('patientProfileDerivedDates · última visita do paciente', () => {
  it('exibe "-" quando paciente é nulo ou última vinda é nula/vazia', () => {
    expect(patientUltimaVisitaDayFromDto(null, FUSO_SP)).toBe('-');
    expect(patientUltimaVisitaDayFromDto({}, FUSO_SP)).toBe('-');
    expect(patientUltimaVisitaDayFromDto({ ultimaVinda: null }, FUSO_SP)).toBe('-');
    expect(patientUltimaVisitaDayFromDto({ ultimaVinda: '' }, FUSO_SP)).toBe('-');
    expect(patientUltimaVisitaDayFromDto({ ultimaVinda: '   ' }, FUSO_SP)).toBe('-');
  });

  it('formata ultimaVinda (instante UTC) no fuso da clínica', () => {
    // 2026-10-02 14:00 em São Paulo = 2026-10-02T17:00:00Z
    const paciente = {
      ultimaVinda: '2026-10-02T17:00:00Z',
    };
    expect(patientUltimaVisitaDayFromDto(paciente, FUSO_SP)).toBe('02/10/2026');
  });

  it('respeita a virada do dia no fuso da clínica perto da meia-noite UTC', () => {
    // 01:00 UTC de 03/10 é 22:00 de 02/10 em São Paulo (-03:00)
    const paciente = {
      ultimaVinda: '2026-10-03T01:00:00Z',
    };
    expect(patientUltimaVisitaDayFromDto(paciente, FUSO_SP)).toBe('02/10/2026');
    // E no Acre (-05:00), 01:00 UTC ainda é 20:00 de 02/10
    expect(patientUltimaVisitaDayFromDto(paciente, FUSO_ACRE)).toBe('02/10/2026');
  });

  it('mantém fallback para ultimaVisita legada em dd/mm/aaaa quando ultimaVinda for nulo', () => {
    const paciente = {
      ultimaVinda: null,
      ultimaVisita: '15/09/2026',
    };
    expect(patientUltimaVisitaDayFromDto(paciente, FUSO_SP)).toBe('15/09/2026');
  });

  it('formatCartaoDiaPtBr retorna "-" para valores nulos ou inválidos', () => {
    expect(formatCartaoDiaPtBr(null, FUSO_SP)).toBe('-');
    expect(formatCartaoDiaPtBr(undefined, FUSO_SP)).toBe('-');
    expect(formatCartaoDiaPtBr('', FUSO_SP)).toBe('-');
  });
});

