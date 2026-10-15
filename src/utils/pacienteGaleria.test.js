import { describe, expect, it, vi } from 'vitest';

vi.mock('../lib/supabaseClient', () => ({
  supabase: { auth: { getSession: vi.fn(), refreshSession: vi.fn() } },
}));

import { MENSAGEM_SESSAO_EXPIRADA } from '../services/api';
import { formatPacienteGaleriaError } from './pacienteGaleria';

/**
 * Item 4 — galeria com sessão expirada: volta a mostrar a mensagem do backend (`base ||`) e nunca
 * o antigo "Não autorizado (401). Faça login de novo; ...".
 */
const erro401 = (message, extras = {}) => {
  const e = new Error(message);
  e.status = 401;
  return Object.assign(e, extras);
};

describe('formatPacienteGaleriaError · 401', () => {
  it('sessaoExpirada + mensagem do backend → mostra só a mensagem do backend (sem "[HTTP 401]")', () => {
    const texto = formatPacienteGaleriaError(erro401('[HTTP 401] Token expirado.', { sessaoExpirada: true }));
    expect(texto).toBe('Token expirado.');
    expect(texto).not.toContain('Não autorizado (401)');
  });

  it('sessaoExpirada sem mensagem nenhuma → texto de sessão expirada do api.js', () => {
    expect(formatPacienteGaleriaError(erro401('', { sessaoExpirada: true }))).toBe(MENSAGEM_SESSAO_EXPIRADA);
    expect(formatPacienteGaleriaError(erro401('   ', { sessaoExpirada: true }))).toBe(MENSAGEM_SESSAO_EXPIRADA);
    expect(formatPacienteGaleriaError({ status: 401, sessaoExpirada: true })).toBe(MENSAGEM_SESSAO_EXPIRADA);
  });

  it('401 comum (sem sessaoExpirada) → continua: mensagem do backend ou texto genérico da galeria', () => {
    expect(formatPacienteGaleriaError(erro401('[HTTP 401] Senha incorreta.'))).toBe('Senha incorreta.');
    expect(formatPacienteGaleriaError(erro401(''))).toBe('Erro ao usar a galeria.');
  });

  it('nenhum 401 mostra "Não autorizado (401)"', () => {
    const casos = [
      erro401('[HTTP 401] x', { sessaoExpirada: true }),
      erro401('', { sessaoExpirada: true }),
      erro401('[HTTP 401] x'),
      erro401(''),
    ];
    for (const e of casos) expect(formatPacienteGaleriaError(e)).not.toContain('Não autorizado (401)');
  });
});

/** Item 5 (rodada 3) — a galeria nunca mostra o prefixo "[HTTP n]". */
const erroHttp = (status, message, extras = {}) => {
  const e = new Error(message);
  e.status = status;
  return Object.assign(e, extras);
};

describe('formatPacienteGaleriaError · sem prefixo [HTTP n]', () => {
  it('corpo vazio + statusText vazio ("[HTTP 401]"), com sessaoExpirada → texto de sessão expirada', () => {
    expect(formatPacienteGaleriaError(erroHttp(401, '[HTTP 401]', { body: {}, sessaoExpirada: true }))).toBe(
      MENSAGEM_SESSAO_EXPIRADA,
    );
  });

  it('corpo vazio + statusText vazio ("[HTTP 401]"), sem sessaoExpirada → "Erro ao usar a galeria."', () => {
    expect(formatPacienteGaleriaError(erroHttp(401, '[HTTP 401]', { body: {} }))).toBe('Erro ao usar a galeria.');
  });

  it('statusText "Unauthorized" vira texto de reserva (com e sem sessaoExpirada)', () => {
    expect(
      formatPacienteGaleriaError(erroHttp(401, '[HTTP 401] Unauthorized', { body: {}, sessaoExpirada: true })),
    ).toBe(MENSAGEM_SESSAO_EXPIRADA);
    expect(formatPacienteGaleriaError(erroHttp(401, '[HTTP 401] Unauthorized', { body: {} }))).toBe(
      'Erro ao usar a galeria.',
    );
  });

  it('corpo padrão do Spring ({ error: "Unauthorized" }) também vira texto de reserva', () => {
    const e = erroHttp(401, '[HTTP 401] Unauthorized', { body: { status: 401, error: 'Unauthorized' } });
    expect(formatPacienteGaleriaError(e)).toBe('Erro ao usar a galeria.');
  });

  it('mensagem do backend no corpo → só a mensagem', () => {
    const e = erroHttp(404, '[HTTP 404] Foto 9 não existe.', { body: { message: 'Foto 9 não existe.' } });
    expect(formatPacienteGaleriaError(e)).toBe('Foto 9 não existe.');
  });

  it('400 de validação (errors[]) → mensagens legíveis juntas, sem prefixo', () => {
    const body = {
      message: 'Validation failed',
      errors: [
        { field: 'legenda', defaultMessage: 'Legenda muito longa.' },
        { field: 'dataReferencia', defaultMessage: 'Data inválida.' },
      ],
    };
    const e = erroHttp(400, '[HTTP 400] Legenda muito longa.; Data inválida.', { body });
    expect(formatPacienteGaleriaError(e)).toBe('Legenda muito longa.; Data inválida.');
  });

  it('download presigned (new Error("[HTTP n]"), sem corpo) → texto de reserva por status', () => {
    expect(formatPacienteGaleriaError(erroHttp(403, '[HTTP 403]'))).toBe(
      'Sem permissão nesta organização para esta operação na galeria.',
    );
    expect(formatPacienteGaleriaError(erroHttp(404, '[HTTP 404]'))).toBe('Foto ou paciente não encontrado.');
    expect(formatPacienteGaleriaError(erroHttp(400, '[HTTP 400]'))).toBe(
      'Arquivo ou dados inválidos (tipo, tamanho, legenda ou vínculos).',
    );
    expect(formatPacienteGaleriaError(erroHttp(500, '[HTTP 500]'))).toBe('Erro ao usar a galeria.');
  });

  it('erro sem status e sem prefixo (ex.: "URL da imagem vazia.") → a própria mensagem', () => {
    expect(formatPacienteGaleriaError(new Error('URL da imagem vazia.'))).toBe('URL da imagem vazia.');
  });

  it('nenhuma saída contém "[HTTP" (varredura de status × corpo × statusText × sessaoExpirada)', () => {
    const statuses = [400, 401, 403, 404, 409, 413, 422, 500, 502, 503, undefined];
    const corpos = [
      undefined,
      null,
      {},
      { message: '' },
      { message: 'Mensagem do backend.' },
      { detail: 'Detalhe do ProblemDetail.' },
      { error: 'Unauthorized' },
      { errors: [{ defaultMessage: 'Campo obrigatório.' }] },
    ];
    const reasons = ['', 'Unauthorized', 'Forbidden', 'Not Found', 'Bad Request', 'Internal Server Error'];
    let casos = 0;
    for (const status of statuses) {
      for (const body of corpos) {
        for (const reason of reasons) {
          for (const sessaoExpirada of [undefined, true]) {
            const detalhe =
              (body && (body.errors?.[0]?.defaultMessage || body.message || body.error || body.detail)) || reason;
            const msg = detalhe ? `[HTTP ${status}] ${detalhe}` : `[HTTP ${status}]`;
            const e = erroHttp(status, msg, { body, sessaoExpirada });
            const texto = formatPacienteGaleriaError(e);
            expect(texto, JSON.stringify({ status, body, reason, sessaoExpirada })).not.toContain('[HTTP');
            expect(texto.trim()).not.toBe('');
            casos += 1;
          }
        }
      }
    }
    expect(casos).toBe(statuses.length * corpos.length * reasons.length * 2);
  });
});
