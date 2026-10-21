import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

vi.mock('../lib/supabaseClient', () => ({
  supabase: { auth: { getSession: vi.fn(), refreshSession: vi.fn() } },
}));

import { MENSAGEM_SESSAO_EXPIRADA } from '../services/api';
import { formatPacienteGaleriaError } from './pacienteGaleria';

/** Testador T5 (rodada 3, item 5) — casos que os testes do implementador não cobriam. */
const erro = (status, message, extras = {}) => Object.assign(new Error(message), { status }, extras);

describe('galeria · "só código" de 3 dígitos vira texto de reserva', () => {
  it('message "[HTTP 502] 502" (statusText/corpo só com o número) → reserva, sem o número cru', () => {
    expect(formatPacienteGaleriaError(erro(502, '[HTTP 502] 502'))).toBe('Erro ao usar a galeria.');
  });

  it('corpo { message: "401" } com sessaoExpirada → texto de sessão expirada', () => {
    const e = erro(401, '[HTTP 401] 401', { body: { message: '401' }, sessaoExpirada: true });
    expect(formatPacienteGaleriaError(e)).toBe(MENSAGEM_SESSAO_EXPIRADA);
  });
});

describe('galeria · prefixo com espaço antes e status estranho', () => {
  it('"  [HTTP 403]  " → reserva do 403', () => {
    expect(formatPacienteGaleriaError(erro(403, '  [HTTP 403]  '))).toBe(
      'Sem permissão nesta organização para esta operação na galeria.',
    );
  });
});

describe('galeria · frase padrão vinda do backend (efeito colateral aceito)', () => {
  it('corpo { message: "Forbidden" } → reserva do 403 (em português), não "Forbidden"', () => {
    const e = erro(403, '[HTTP 403] Forbidden', { body: { message: 'Forbidden' } });
    expect(formatPacienteGaleriaError(e)).toBe('Sem permissão nesta organização para esta operação na galeria.');
  });

  it('frase padrão em caixa diferente ("NOT FOUND") também é filtrada', () => {
    expect(formatPacienteGaleriaError(erro(404, '[HTTP 404] NOT FOUND'))).toBe('Foto ou paciente não encontrado.');
  });

  it('mensagem real que só contém a frase ("Forbidden: sem acesso à clínica") passa limpa', () => {
    const e = erro(403, '[HTTP 403] x', { body: { message: 'Forbidden: sem acesso à clínica' } });
    expect(formatPacienteGaleriaError(e)).toBe('Forbidden: sem acesso à clínica');
  });
});

describe('galeria · import de api.js não cria ciclo', () => {
  it('api.js não importa pacienteGaleria (nem estática nem dinamicamente)', () => {
    const aqui = dirname(fileURLToPath(import.meta.url));
    const src = readFileSync(resolve(aqui, '../services/api.js'), 'utf8');
    const imports = [...src.matchAll(/(?:import|export)\s[^'"]*?from\s*['"]([^'"]+)['"]|import\(\s*['"]([^'"]+)['"]\s*\)/g)].map(
      (m) => m[1] || m[2],
    );
    expect(imports.length).toBeGreaterThan(0);
    expect(imports.filter((i) => /pacienteGaleria/.test(i))).toEqual([]);
  });
});
