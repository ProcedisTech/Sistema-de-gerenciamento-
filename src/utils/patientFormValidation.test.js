import { describe, it, expect } from 'vitest';
import {
  isPacienteEmailFormatValid,
  validatePacienteFormBasics,
} from './patientFormValidation';

const validBasics = {
  nome: 'Maria Silva',
  dataNascimentoIso: '1990-01-15',
  sexo: 'F',
  estadoCivilId: 'uuid-ec',
  profissaoId: 'uuid-prof',
  cpf: '529.982.247-25',
  telefoneCountryCode: 'BR',
  telefoneNumero: '11999999999',
};

describe('isPacienteEmailFormatValid', () => {
  it('aceita formato válido', () => {
    expect(isPacienteEmailFormatValid('a@b.co')).toBe(true);
  });

  it('rejeita formato inválido', () => {
    expect(isPacienteEmailFormatValid('foo')).toBe(false);
    expect(isPacienteEmailFormatValid('a@b')).toBe(false);
  });
});

describe('validatePacienteFormBasics — email', () => {
  const opts = { skipCpf: true };

  it('email vazio não gera erro', () => {
    const errors = validatePacienteFormBasics({ ...validBasics, email: '' }, opts);
    expect(errors.email).toBeUndefined();
  });

  it('email inválido gera erro', () => {
    const errors = validatePacienteFormBasics({ ...validBasics, email: 'foo' }, opts);
    expect(errors.email).toBe(true);
  });

  it('email válido não gera erro', () => {
    const errors = validatePacienteFormBasics({ ...validBasics, email: 'maria@exemplo.com' }, opts);
    expect(errors.email).toBeUndefined();
  });
});
