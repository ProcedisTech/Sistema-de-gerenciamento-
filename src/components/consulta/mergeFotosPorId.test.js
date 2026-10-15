import { describe, expect, it, vi } from 'vitest';
import { mergeFotosPorId, urlDeReservaDaFoto } from './mergeFotosPorId.js';

const urlDe = (id) => `/api/v1/pacientes/p-1/galeria/${id}/arquivo`;

describe('mergeFotosPorId (Y11)', () => {
  it('mantém a foto local ainda sem fotoId', () => {
    const pendente = { url: 'blob:1', blob: new Blob(['1']), meta: {} };
    expect(mergeFotosPorId([pendente], [], { urlDe })).toEqual([pendente]);
  });

  it('acrescenta a foto do servidor que o aparelho não tem, sem blob e com a URL da galeria', () => {
    const out = mergeFotosPorId([], [{ id: 'f-1', atendimentoItemId: 'i-1', tipoFotoCodigo: 'ANTES' }], { urlDe });
    expect(out).toEqual([
      {
        url: urlDe('f-1'),
        blob: null,
        meta: { fotoId: 'f-1', atendimentoItemId: 'i-1', tipoFotoCodigo: 'ANTES', source: 'servidor' },
      },
    ]);
  });

  it('não duplica a foto que o aparelho já tem com o mesmo fotoId', () => {
    const local = { url: 'blob:a', blob: new Blob(['a']), meta: { fotoId: 'f-1' } };
    const locais = [local];
    expect(mergeFotosPorId(locais, [{ id: 'f-1' }], { urlDe })).toBe(locais);
  });

  it('tira a foto que o servidor conhecia e não tem mais (removida em outro aparelho)', () => {
    const local = { url: 'blob:a', blob: null, meta: { fotoId: 'f-1' } };
    const out = mergeFotosPorId([local], [], { urlDe, idsAnteriores: new Set(['f-1']) });
    expect(out).toEqual([]);
  });

  it('lista velha não apaga foto que acabou de subir', () => {
    const recem = { url: 'blob:n', blob: new Blob(['n']), meta: { fotoId: 'f-nova' } };
    const locais = [recem];
    expect(mergeFotosPorId(locais, [], { urlDe, idsAnteriores: new Set(['f-velha']) })).toBe(locais);
  });

  it('`entra` escolhe o que a lista recebe, mas uma foto de outra lista não tira a local', () => {
    const local = { url: 'blob:a', blob: null, meta: { fotoId: 'f-av' } };
    const out = mergeFotosPorId([local], [{ id: 'f-av', tipoFotoCodigo: 'AVALIACAO' }, { id: 'f-pr', tipoFotoCodigo: 'ANTES' }], {
      urlDe,
      idsAnteriores: new Set(['f-av']),
      entra: (f) => f.tipoFotoCodigo === 'AVALIACAO',
    });
    expect(out).toEqual([local]);
  });

  it('com `categoriaDe`, a foto do servidor entra com a categoria (a faixa do Step 4)', () => {
    const doServidor = [
      { id: 'f-1', atendimentoItemId: 'i-1', tipoFotoCodigo: 'ANTES' },
      { id: 'f-2', atendimentoItemId: 'i-1', tipoFotoCodigo: 'POS_IMEDIATO' },
    ];
    const categoriaDe = (f) => (f.tipoFotoCodigo === 'ANTES' ? 'antes' : 'outro');
    const out = mergeFotosPorId([], doServidor, { urlDe, categoriaDe });
    expect(out.map((f) => f.meta)).toEqual([
      { fotoId: 'f-1', atendimentoItemId: 'i-1', tipoFotoCodigo: 'ANTES', categoria: 'antes', source: 'servidor' },
      { fotoId: 'f-2', atendimentoItemId: 'i-1', tipoFotoCodigo: 'POS_IMEDIATO', categoria: 'outro', source: 'servidor' },
    ]);
  });

  it('`categoriaDe` não mexe na foto que o aparelho já tem', () => {
    const local = { url: 'blob:a', blob: new Blob(['a']), meta: { fotoId: 'f-1', categoria: 'depois' } };
    const locais = [local];
    const out = mergeFotosPorId(locais, [{ id: 'f-1', tipoFotoCodigo: 'POS_IMEDIATO' }], {
      urlDe,
      categoriaDe: () => 'outro',
    });
    expect(out).toBe(locais);
    expect(out[0].meta.categoria).toBe('depois');
  });

  it('sem URL na galeria, a foto do servidor espera a próxima rebusca', () => {
    const locais = [];
    expect(mergeFotosPorId(locais, [{ id: 'f-x' }], { urlDe: () => null })).toBe(locais);
  });
});

describe('mergeFotosPorId (F1: versão do arquivo)', () => {
  const V1 = '2026-10-15T12:30:01.001Z';
  const V2 = '2026-10-15T12:30:02.002Z';
  const reserva = (id, v) => `/api/v1/pacientes/p-1/galeria/${id}/arquivo?v=${Date.parse(v)}`;

  it('a foto do servidor entra com a versão na meta', () => {
    const out = mergeFotosPorId([], [{ id: 'f-1', tipoFotoCodigo: 'ANTES', arquivoAtualizadoEm: V1 }], { urlDe });
    expect(out[0].meta).toEqual({
      fotoId: 'f-1', atendimentoItemId: null, tipoFotoCodigo: 'ANTES', arquivoAtualizadoEm: V1, source: 'servidor',
    });
  });

  it('versão diferente: troca no lugar pela URL de reserva, sem blob, meta mantida e versão nova; sem reler a galeria', () => {
    const urlDeGaleria = vi.fn(() => null);
    const local = { url: 'blob:a', blob: new Blob(['a']), meta: { fotoId: 'f-1', categoria: 'antes', arquivoAtualizadoEm: V1 } };
    const outra = { url: 'blob:b', blob: new Blob(['b']), meta: { fotoId: 'f-2', arquivoAtualizadoEm: V1 } };
    const out = mergeFotosPorId([local, outra], [
      { id: 'f-1', arquivoAtualizadoEm: V2 },
      { id: 'f-2', arquivoAtualizadoEm: V1 },
    ], { urlDe: urlDeGaleria, pacienteId: 'p-1' });
    expect(out).toEqual([
      { url: reserva('f-1', V2), blob: null, meta: { fotoId: 'f-1', categoria: 'antes', arquivoAtualizadoEm: V2 } },
      outra,
    ]);
    expect(out[1]).toBe(outra);
    expect(urlDeGaleria).not.toHaveBeenCalled();
  });

  it('versão igual ou ausente no servidor: nada muda (a mesma lista)', () => {
    const local = { url: 'blob:a', blob: new Blob(['a']), meta: { fotoId: 'f-1', arquivoAtualizadoEm: V1 } };
    const locais = [local];
    expect(mergeFotosPorId(locais, [{ id: 'f-1', arquivoAtualizadoEm: V1 }], { urlDe, pacienteId: 'p-1' })).toBe(locais);
    expect(mergeFotosPorId(locais, [{ id: 'f-1' }], { urlDe, pacienteId: 'p-1' })).toBe(locais);
  });

  it('foto local sem versão só adota a do servidor na meta (url e blob ficam)', () => {
    const blob = new Blob(['a']);
    const local = { url: 'blob:a', blob, meta: { fotoId: 'f-1' } };
    const out = mergeFotosPorId([local], [{ id: 'f-1', arquivoAtualizadoEm: V1 }], { urlDe, pacienteId: 'p-1' });
    expect(out).toEqual([{ url: 'blob:a', blob, meta: { fotoId: 'f-1', arquivoAtualizadoEm: V1 } }]);
  });

  it('versão do servidor mais velha que a local (releitura atrasada): não desfaz a anotação local', () => {
    const local = { url: 'blob:anotada', blob: new Blob(['a']), meta: { fotoId: 'f-1', arquivoAtualizadoEm: V2 } };
    const locais = [local];
    expect(mergeFotosPorId(locais, [{ id: 'f-1', arquivoAtualizadoEm: V1 }], { urlDe, pacienteId: 'p-1' })).toBe(locais);
  });

  it('sem pacienteId não há URL de reserva: a foto fica como está', () => {
    const local = { url: 'blob:a', blob: null, meta: { fotoId: 'f-1', arquivoAtualizadoEm: V1 } };
    const locais = [local];
    expect(mergeFotosPorId(locais, [{ id: 'f-1', arquivoAtualizadoEm: V2 }], { urlDe })).toBe(locais);
  });

  it('`versaoDe` troca de onde a versão local sai', () => {
    const local = { url: 'blob:a', blob: null, meta: { fotoId: 'f-1' }, versao: V1 };
    const out = mergeFotosPorId([local], [{ id: 'f-1', arquivoAtualizadoEm: V2 }], {
      urlDe, pacienteId: 'p-1', versaoDe: (f) => f.versao,
    });
    expect(out[0].url).toBe(reserva('f-1', V2));
  });
});

describe('urlDeReservaDaFoto', () => {
  it('monta /api/v1/pacientes/{p}/galeria/{fotoId}/arquivo?v=<epochMs>', () => {
    expect(urlDeReservaDaFoto('p-1', 'f-1', '2026-10-15T12:30:00.123Z'))
      .toBe('/api/v1/pacientes/p-1/galeria/f-1/arquivo?v=1792067400123');
  });
  it('sem versão vai sem ?v=; sem paciente ou sem fotoId devolve null', () => {
    expect(urlDeReservaDaFoto('p-1', 'f-1', null)).toBe('/api/v1/pacientes/p-1/galeria/f-1/arquivo');
    expect(urlDeReservaDaFoto(null, 'f-1', null)).toBeNull();
    expect(urlDeReservaDaFoto('p-1', null, null)).toBeNull();
  });
});
