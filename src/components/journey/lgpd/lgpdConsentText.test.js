/**
 * lgpdConsentText.test.js
 *
 * Testes unitários para a função pura de interpolação do Termo LGPD.
 * Cobertura:
 *   1. Interpolação correta com todos os campos presentes
 *   2. Fallback para cada campo ausente individualmente
 *   3. Fallback com contexto completamente vazio
 *   4. Fallback com campos nulos, undefined e strings vazias
 *   5. validateLgpdContext: contexto completo vs. incompleto
 *   6. sanitizeField: edge cases
 */

import {
  buildLgpdConsentText,
  validateLgpdContext,
  sanitizeField,
  PLACEHOLDER_AUSENTE,
} from './lgpdConsentText';

// ── Fixtures ──────────────────────────────────────────────────────────────────

const CTX_COMPLETO = {
  paciente:     { nome: 'Maria Silva',   cpf: '123.456.789-00' },
  clinica:      { nome: 'Clínica Bella', cnpj: '12.345.678/0001-90' },
  profissional: { nome: 'Dr. João Costa' },
};

// ── sanitizeField ─────────────────────────────────────────────────────────────

describe('sanitizeField', () => {
  it('retorna o valor quando string válida', () => {
    expect(sanitizeField('Maria')).toBe('Maria');
  });

  it('retorna PLACEHOLDER_AUSENTE para undefined', () => {
    expect(sanitizeField(undefined)).toBe(PLACEHOLDER_AUSENTE);
  });

  it('retorna PLACEHOLDER_AUSENTE para null', () => {
    expect(sanitizeField(null)).toBe(PLACEHOLDER_AUSENTE);
  });

  it('retorna PLACEHOLDER_AUSENTE para string vazia', () => {
    expect(sanitizeField('')).toBe(PLACEHOLDER_AUSENTE);
  });

  it('retorna PLACEHOLDER_AUSENTE para string só de espaços', () => {
    expect(sanitizeField('   ')).toBe(PLACEHOLDER_AUSENTE);
  });

  it('aceita fallback customizado', () => {
    expect(sanitizeField(null, 'N/A')).toBe('N/A');
  });

  it('converte número para string', () => {
    expect(sanitizeField(42)).toBe('42');
  });
});

// ── buildLgpdConsentText — contexto completo ──────────────────────────────────

describe('buildLgpdConsentText com contexto completo', () => {
  it('inclui o nome do paciente no texto', () => {
    const text = buildLgpdConsentText(CTX_COMPLETO);
    expect(text).toContain('Maria Silva');
  });

  it('inclui o CPF do paciente no texto', () => {
    const text = buildLgpdConsentText(CTX_COMPLETO);
    expect(text).toContain('123.456.789-00');
  });

  it('inclui o nome da clínica no texto', () => {
    const text = buildLgpdConsentText(CTX_COMPLETO);
    expect(text).toContain('Clínica Bella');
  });

  it('inclui o CNPJ da clínica no texto', () => {
    const text = buildLgpdConsentText(CTX_COMPLETO);
    expect(text).toContain('12.345.678/0001-90');
  });

  it('inclui o nome do profissional no texto', () => {
    const text = buildLgpdConsentText(CTX_COMPLETO);
    expect(text).toContain('Dr. João Costa');
  });

  it('inclui a referência à Lei 13.709/2018', () => {
    const text = buildLgpdConsentText(CTX_COMPLETO);
    expect(text).toContain('13.709/2018');
  });

  it('inclui os 4 artigos do termo', () => {
    const text = buildLgpdConsentText(CTX_COMPLETO);
    expect(text).toContain('1. Dos Dados Coletados');
    expect(text).toContain('2. Da Finalidade do Tratamento');
    expect(text).toContain('3. Do Armazenamento e Compartilhamento');
    expect(text).toContain('4. Dos Direitos do Titular');
  });

  it('termina com a cláusula de aceite', () => {
    const text = buildLgpdConsentText(CTX_COMPLETO);
    expect(text.trim()).toMatch(/Por estar de acordo, aceito o presente termo\.$/);
  });

  it('retorna string (não objeto, não undefined)', () => {
    const text = buildLgpdConsentText(CTX_COMPLETO);
    expect(typeof text).toBe('string');
    expect(text.length).toBeGreaterThan(100);
  });
});

// ── buildLgpdConsentText — campos ausentes individualmente ────────────────────

describe('buildLgpdConsentText com campos ausentes', () => {
  it('substitui paciente.nome pelo placeholder quando ausente', () => {
    const ctx = { ...CTX_COMPLETO, paciente: { cpf: '123.456.789-00' } };
    const text = buildLgpdConsentText(ctx);
    expect(text).toContain(PLACEHOLDER_AUSENTE);
    expect(text).not.toContain('Maria Silva');
  });

  it('substitui paciente.cpf pelo placeholder quando ausente', () => {
    const ctx = { ...CTX_COMPLETO, paciente: { nome: 'Maria Silva' } };
    const text = buildLgpdConsentText(ctx);
    expect(text).toContain(PLACEHOLDER_AUSENTE);
    expect(text).not.toContain('123.456.789-00');
  });

  it('substitui clinica.nome pelo placeholder quando ausente', () => {
    const ctx = { ...CTX_COMPLETO, clinica: { cnpj: '12.345.678/0001-90' } };
    const text = buildLgpdConsentText(ctx);
    expect(text).toContain(PLACEHOLDER_AUSENTE);
  });

  it('substitui clinica.cnpj pelo placeholder quando ausente', () => {
    const ctx = { ...CTX_COMPLETO, clinica: { nome: 'Clínica Bella' } };
    const text = buildLgpdConsentText(ctx);
    expect(text).toContain(PLACEHOLDER_AUSENTE);
  });

  it('substitui profissional.nome pelo placeholder quando ausente', () => {
    const ctx = { ...CTX_COMPLETO, profissional: {} };
    const text = buildLgpdConsentText(ctx);
    expect(text).toContain(PLACEHOLDER_AUSENTE);
  });
});

// ── buildLgpdConsentText — contexto completamente vazio/nulo ──────────────────

describe('buildLgpdConsentText com contexto vazio ou nulo', () => {
  it('não lança erro com contexto undefined', () => {
    expect(() => buildLgpdConsentText(undefined)).not.toThrow();
  });

  it('não lança erro com contexto null', () => {
    expect(() => buildLgpdConsentText(null)).not.toThrow();
  });

  it('não lança erro com objeto vazio {}', () => {
    expect(() => buildLgpdConsentText({})).not.toThrow();
  });

  it('retorna string com 5 placeholders quando contexto é {}', () => {
    const text = buildLgpdConsentText({});
    const count = (text.split(PLACEHOLDER_AUSENTE).length - 1);
    // Nome da clínica aparece 2x no template, mais 3 campos únicos = mínimo 5 ocorrências
    expect(count).toBeGreaterThanOrEqual(5);
  });

  it('retorna string válida mesmo com todos os campos como strings vazias', () => {
    const ctx = {
      paciente:     { nome: '',  cpf: '' },
      clinica:      { nome: '',  cnpj: '' },
      profissional: { nome: '' },
    };
    const text = buildLgpdConsentText(ctx);
    expect(typeof text).toBe('string');
    expect(text.length).toBeGreaterThan(100);
  });
});

// ── validateLgpdContext ───────────────────────────────────────────────────────

describe('validateLgpdContext', () => {
  it('retorna isComplete=true e missingFields=[] com contexto completo', () => {
    const { isComplete, missingFields } = validateLgpdContext(CTX_COMPLETO);
    expect(isComplete).toBe(true);
    expect(missingFields).toHaveLength(0);
  });

  it('detecta paciente.nome ausente', () => {
    const ctx = { ...CTX_COMPLETO, paciente: { cpf: '111.111.111-11' } };
    const { isComplete, missingFields } = validateLgpdContext(ctx);
    expect(isComplete).toBe(false);
    expect(missingFields).toContain('paciente.nome');
  });

  it('detecta paciente.cpf ausente', () => {
    const ctx = { ...CTX_COMPLETO, paciente: { nome: 'Ana' } };
    const { missingFields } = validateLgpdContext(ctx);
    expect(missingFields).toContain('paciente.cpf');
  });

  it('detecta clinica.nome ausente', () => {
    const ctx = { ...CTX_COMPLETO, clinica: { cnpj: '00.000.000/0001-00' } };
    const { missingFields } = validateLgpdContext(ctx);
    expect(missingFields).toContain('clinica.nome');
  });

  it('detecta clinica.cnpj ausente', () => {
    const ctx = { ...CTX_COMPLETO, clinica: { nome: 'Clínica X' } };
    const { missingFields } = validateLgpdContext(ctx);
    expect(missingFields).toContain('clinica.cnpj');
  });

  it('detecta profissional.nome ausente', () => {
    const ctx = { ...CTX_COMPLETO, profissional: {} };
    const { missingFields } = validateLgpdContext(ctx);
    expect(missingFields).toContain('profissional.nome');
  });

  it('detecta todos os 5 campos ausentes com contexto vazio', () => {
    const { isComplete, missingFields } = validateLgpdContext({});
    expect(isComplete).toBe(false);
    expect(missingFields).toHaveLength(5);
  });

  it('não lança erro com contexto undefined', () => {
    expect(() => validateLgpdContext(undefined)).not.toThrow();
    const { isComplete } = validateLgpdContext(undefined);
    expect(isComplete).toBe(false);
  });
});
