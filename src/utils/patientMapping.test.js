import { describe, it, expect } from 'vitest';
import {
  mapBackendPatient,
  mergePacienteDtoWithEditing,
  patientToPacienteUpdateDTO,
  proximoAgendamentoEhFuturo,
} from './patientMapping';

const FUSO_DF = 'America/Sao_Paulo';
const FUSO_AC = 'America/Rio_Branco';

describe('mapBackendPatient · datas', () => {
  const dto = {
    id: 'p1',
    nomeCompleto: 'Maria',
    dataNascimento: '1990-10-01',
    proximoAgendamento: '2026-10-05T09:30:00',
    ultimaVinda: '2026-10-01T02:52:00Z',
  };

  it('proximoAgendamento é calendário: mesma data/hora em qualquer fuso', () => {
    for (const fuso of [FUSO_DF, FUSO_AC]) {
      const p = mapBackendPatient(dto, { fuso, hojeIso: '2026-10-01' });
      expect(p.proximoAgendamento).toBe('2026-10-05T09:30');
      expect(p.proximoRetorno).toBe('05/10/2026');
    }
  });

  it('ultimaVinda é instante: dia exibido no fuso da clínica', () => {
    expect(mapBackendPatient(dto, { fuso: FUSO_DF }).ultimaVisita).toBe('30/09/2026');
    expect(mapBackendPatient(dto, { fuso: FUSO_AC }).ultimaVisita).toBe('30/09/2026');
  });

  it('idade usa o hoje da clínica (aniversário hoje conta)', () => {
    expect(mapBackendPatient(dto, { hojeIso: '2026-10-01' }).idade).toBe(36);
    expect(mapBackendPatient(dto, { hojeIso: '2026-09-30' }).idade).toBe(35);
  });

  it('índice do .map não é tratado como opções', () => {
    expect(mapBackendPatient(dto, 3).proximoAgendamento).toBe('2026-10-05T09:30');
  });

  it('sem proximoAgendamento → null', () => {
    expect(mapBackendPatient({ ...dto, proximoAgendamento: null }).proximoAgendamento).toBeNull();
  });
});

describe('proximoAgendamentoEhFuturo', () => {
  // 2026-10-05 12:00Z = 09:00 em DF, 07:00 no AC
  const agoraMs = Date.parse('2026-10-05T12:00:00Z');

  it('09:30 ainda não passou em DF (09:00) nem no AC (07:00)', () => {
    expect(proximoAgendamentoEhFuturo('2026-10-05T09:30', FUSO_DF, agoraMs)).toBe(true);
    expect(proximoAgendamentoEhFuturo('2026-10-05T09:30', FUSO_AC, agoraMs)).toBe(true);
  });

  it('08:00 já passou em DF, mas não no AC', () => {
    expect(proximoAgendamentoEhFuturo('2026-10-05T08:00', FUSO_DF, agoraMs)).toBe(false);
    expect(proximoAgendamentoEhFuturo('2026-10-05T08:00', FUSO_AC, agoraMs)).toBe(true);
  });

  it('valor inválido → false', () => {
    expect(proximoAgendamentoEhFuturo(null, FUSO_DF, agoraMs)).toBe(false);
  });
});

describe('mergePacienteDtoWithEditing', () => {
  const dto = {
    nomeCompleto: 'João',
    dataNascimento: '1985-06-01',
    cpf: '12345678901',
    sexo: 'M',
    email: 'joao@old.com',
    genero: 'M',
    telefone: '+5511999999999',
  };

  it('omite genero do payload', () => {
    const payload = mergePacienteDtoWithEditing(dto, { nome: 'João', email: '' });
    expect(payload).not.toHaveProperty('genero');
  });

  it('email vazio persiste como null', () => {
    const payload = mergePacienteDtoWithEditing(dto, { nome: 'João', email: '   ' });
    expect(payload.email).toBeNull();
  });
});

describe('patientToPacienteUpdateDTO', () => {
  it('omite genero do payload', () => {
    const patient = { nome: 'Ana', sexo: 'F', genero: 'F', email: 'ana@test.com' };
    const payload = patientToPacienteUpdateDTO(patient, {});
    expect(payload).not.toHaveProperty('genero');
  });
});
