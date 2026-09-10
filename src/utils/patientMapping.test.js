import { describe, it, expect } from 'vitest';
import {
  mergePacienteDtoWithEditing,
  patientToPacienteUpdateDTO,
} from './patientMapping';

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
