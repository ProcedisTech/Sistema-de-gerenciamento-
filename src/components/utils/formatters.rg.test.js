import { describe, expect, it } from 'vitest';
import {
  formatRgForDisplay,
  maskRG,
  normalizeRgForApi,
  sanitizeRG,
  validateRgField,
} from './formatters.js';
import {
  journeyToPacienteCreateDTO,
  mergePacienteDtoWithEditing,
  patientToPacienteUpdateDTO,
} from '../../utils/patientMapping.js';
import { buildPacienteCtx } from '../../utils/pacienteCtx.js';
import { validatePacienteFormBasics } from '../../utils/patientFormValidation.js';

describe('RG multi-UF — máscara adaptativa (maskRG / sanitizeRG)', () => {
  it('formata progressivamente de 1 a 14 caracteres incluindo DF (7), MG (UF) e CIN (11)', () => {
    expect(maskRG('1')).toBe('1');
    expect(maskRG('123')).toBe('123');
    expect(maskRG('1234')).toBe('1.234');
    expect(maskRG('3456789')).toBe('3.456.789'); // DF
    expect(maskRG('12345678')).toBe('12.345.678'); // 8 dígitos
    expect(maskRG('123456789')).toBe('12.345.678-9'); // SP/RJ
    expect(maskRG('1234567890')).toBe('12.345.678-90'); // RS/BA
    expect(maskRG('12345678901')).toBe('123.456.789-01'); // CIN
    expect(maskRG('123456789012')).toBe('12.345.678.901-2');
    expect(maskRG('mg12345678')).toBe('MG-12.345.678');
    expect(sanitizeRG('mg')).toBe('MG');
  });

  it('formata dígito verificador X com hífen e permite substituir X ao digitar novo número', () => {
    expect(maskRG('1234x')).toBe('1.234-X');
    expect(maskRG('1234567x')).toBe('1.234.567-X');
    expect(maskRG('12345678x')).toBe('12.345.678-X');
    // Ao digitar 9 após o X, não trava e substitui pelo número
    expect(maskRG('12.345.678-X9')).toBe('12.345.678-9');
    // X antes de 4 dígitos não é aceito no corpo
    expect(maskRG('12X34')).toBe('1.234');
  });

  it('respeita limite de 14 caracteres limpos contando prefixo de UF', () => {
    expect(normalizeRgForApi('12345678901234567890')).toHaveLength(14);
    expect(normalizeRgForApi('MG123456789012345')).toBe('MG123456789012');
    expect(normalizeRgForApi('MG123456789012345')).toHaveLength(14);
  });

  it('retorna vazio/null para nulos ou em branco e armazena limpo sem pontuação', () => {
    expect(maskRG(null)).toBe('');
    expect(maskRG(undefined)).toBe('');
    expect(normalizeRgForApi('')).toBeNull();
    expect(normalizeRgForApi('   ')).toBeNull();
    expect(normalizeRgForApi(' 3.456.789 ')).toBe('3456789');
    expect(normalizeRgForApi('12.345.678-x')).toBe('12345678X');
    expect(normalizeRgForApi('MG-12.345.678')).toBe('MG12345678');
  });
});

describe('RG multi-UF — validação (validateRgField & validatePacienteFormBasics)', () => {
  it('aceita vazio (opcional) e formatos válidos de qualquer UF', () => {
    expect(validateRgField('').ok).toBe(true);
    expect(validateRgField(null).ok).toBe(true);
    expect(validateRgField('3.456.789')).toEqual({ ok: true, rgNormalized: '3456789', message: '' });
    expect(validateRgField('12.345.678-x')).toEqual({ ok: true, rgNormalized: '12345678X', message: '' });
    expect(validateRgField('MG-12.345.678')).toEqual({ ok: true, rgNormalized: 'MG12345678', message: '' });
    expect(validateRgField('123.456.789-01')).toEqual({ ok: true, rgNormalized: '12345678901', message: '' });
  });

  it('rejeita RG curto, longo, com UF de 1 letra, X fora do fim ou símbolos inválidos', () => {
    expect(validateRgField('12').ok).toBe(false);
    expect(validateRgField('1234').ok).toBe(false);
    expect(validateRgField('ABC').ok).toBe(false);
    expect(validateRgField('MG').ok).toBe(false);
    expect(validateRgField('---').ok).toBe(false);
    expect(validateRgField('12X3456').ok).toBe(false);
    expect(validateRgField('12345@#67').ok).toBe(false);
    expect(validateRgField('123456789012345').ok).toBe(false);
    const uf1Letra = validateRgField('M-12.345.678');
    expect(uf1Letra.ok).toBe(false);
    expect(uf1Letra.message).toContain('2 letras');
  });

  it('validatePacienteFormBasics valida rg quando skipRg não está ativo e ignora com skipRg: true', () => {
    const base = {
      nome: 'Ana Silva',
      dataNascimentoIso: '1990-05-10',
      sexo: 'F',
      estadoCivilId: 'ec-1',
      profissaoId: 'prof-1',
      cpf: '52998224725',
      telefoneCountryCode: 'BR',
      telefoneNumero: '(61) 99999-8888',
      email: '',
    };
    expect(validatePacienteFormBasics({ ...base, rg: '123' })).toEqual({ rg: true });
    expect(validatePacienteFormBasics({ ...base, rg: '123' }, { skipRg: true })).toEqual({});
    expect(validatePacienteFormBasics({ ...base, rg: '3.456.789' })).toEqual({});
    expect(validatePacienteFormBasics({ ...base, rg: '' })).toEqual({});
  });
});

describe('formatRgForDisplay, buildPacienteCtx & patientMapping (preservação de legados)', () => {
  it('formatRgForDisplay formata RGs limpos salvos no banco e preserva legados fora do padrão sem mutilar', () => {
    expect(formatRgForDisplay('3456789')).toBe('3.456.789');
    expect(formatRgForDisplay('12345678X')).toBe('12.345.678-X');
    expect(formatRgForDisplay('MG12345678')).toBe('MG-12.345.678');
    expect(formatRgForDisplay('MG-12.345.678/SSP')).toBe('MG-12.345.678/SSP');
    expect(formatRgForDisplay('1234')).toBe('1234');
    expect(formatRgForDisplay('')).toBe('');
  });

  it('buildPacienteCtx entrega RG formatado para termos/PDF a partir do valor limpo no banco', () => {
    const ctx = buildPacienteCtx({ nome: 'Carlos', cpf: '11122233344', rg: 'MG12345678' });
    expect(ctx.rg).toBe('MG-12.345.678');
    expect(buildPacienteCtx({ nome: 'Carlos', rg: null }).rg).toBeNull();
  });

  it('journeyToPacienteCreateDTO e patientToPacienteUpdateDTO salvam RG limpo e permitem limpar para null', () => {
    expect(journeyToPacienteCreateDTO({ nome: 'Ana', rg: 'MG-12.345.678' }).rg).toBe('MG12345678');
    expect(journeyToPacienteCreateDTO({ nome: 'Ana', rg: '   ' }).rg).toBeNull();

    const patient = { nome: 'Ana', cpf: '12345678901', rg: '12345678X' };
    expect(patientToPacienteUpdateDTO(patient, { rg: 'MG-99.888.777' }).rg).toBe('MG99888777');
    expect(patientToPacienteUpdateDTO(patient, { rg: '' }).rg).toBeNull();
    expect(patientToPacienteUpdateDTO(patient, {}).rg).toBe('12345678X');
  });

  it('mergePacienteDtoWithEditing preserva RG legado se rgTouched=false e normaliza quando editado/limpo', () => {
    const dtoLegado = { nomeCompleto: 'Ana', cpf: '12345678901', rg: 'MG-12.345.678/SSP' };
    expect(
      mergePacienteDtoWithEditing(dtoLegado, {
        nome: 'Ana Maria',
        rg: 'MG-12.345.678/SSP',
        rgTouched: false,
      }).rg,
    ).toBe('MG-12.345.678/SSP');

    expect(
      mergePacienteDtoWithEditing(dtoLegado, {
        rg: '12.345.678-X',
        rgTouched: true,
      }).rg,
    ).toBe('12345678X');

    expect(
      mergePacienteDtoWithEditing(dtoLegado, {
        rg: '',
        rgTouched: true,
      }).rg,
    ).toBeNull();
  });
});
