import { act, renderHook } from '@testing-library/react';
import { useState } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  categoriaDaFotoDoServidor,
  ehFotoDaVistaDoMapa,
  legendaDaFoto,
  tipoDaFotoDoProcedimento,
  useEnvioFotosConsulta,
} from './useEnvioFotosConsulta.js';
import { legendaDaFotoDaVista } from './useMapaRascunhoAutosave.js';

vi.mock('../../services/api', () => ({
  atendimentosApi: { removerFoto: vi.fn(), anotarFoto: vi.fn() },
  pacientesGaleriaApi: { upload: vi.fn(), list: vi.fn() },
}));
vi.mock('../../utils/imageUtils.js', () => ({ convertToWebP: vi.fn(async (b) => b) }));

const { atendimentosApi, pacientesGaleriaApi } = await import('../../services/api');

const CONSULTA = { id: 'c-1', pacienteId: 'p-1', tipoProcedimentoCodigo: null };
const ESPERAS = [1, 1, 1];

function foto(nome, meta = {}) {
  return { url: `blob:${nome}`, blob: new Blob([nome]), meta };
}

function erro(status) {
  return Object.assign(new Error(`HTTP ${status ?? 'rede'}`), status ? { status } : {});
}

function adiado() {
  let resolver;
  const promessa = new Promise((r) => {
    resolver = r;
  });
  return { promessa, resolver };
}

async function assentar(n = 8) {
  await act(async () => {
    for (let i = 0; i < n; i += 1) await new Promise((r) => setTimeout(r, 2));
  });
}

function montar({ consulta = CONSULTA, item = 'item-1' } = {}) {
  const avisarErro = vi.fn();
  const r = renderHook(
    ({ consultaAtual }) => {
      const [avaliacao, setAvaliacao] = useState([]);
      const [procedimento, setProcedimento] = useState([]);
      const envio = useEnvioFotosConsulta({
        consulta: consultaAtual,
        roleUserId: 'ru-1',
        fotosAvaliacao: avaliacao,
        fotosProcedimento: procedimento,
        itemDoProcedimentoAtivo: item,
        aparelho: { setEvaluationCapturedPhotos: setAvaliacao, setProcedureCapturedPhotos: setProcedimento },
        avisarErro,
        esperasMs: ESPERAS,
      });
      return { envio, avaliacao, setAvaliacao, procedimento, setProcedimento };
    },
    { initialProps: { consultaAtual: consulta } },
  );
  return { ...r, avisarErro };
}

describe('useEnvioFotosConsulta (C3, B5, P5)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('foto da avaliação sobe na hora com a consulta e o tipo, e guarda o fotoId', async () => {
    pacientesGaleriaApi.upload.mockResolvedValue({ id: 'f-1' });
    const { result } = montar();

    act(() => result.current.setAvaliacao([foto('a')]));
    await assentar();

    expect(pacientesGaleriaApi.upload).toHaveBeenCalledTimes(1);
    expect(pacientesGaleriaApi.upload.mock.calls[0][0]).toBe('p-1');
    expect(pacientesGaleriaApi.upload.mock.calls[0][2]).toMatchObject({
      roleUserId: 'ru-1',
      tipoFotoCodigo: 'AVALIACAO',
      atendimentoId: 'c-1',
      atendimentoItemId: null,
    });
    expect(result.current.avaliacao[0].meta.fotoId).toBe('f-1');
  });

  it('foto do procedimento leva o item da aba ativa e o tipo da categoria', async () => {
    pacientesGaleriaApi.upload.mockResolvedValue({ id: 'f-2' });
    const { result } = montar({ item: 'item-7' });

    act(() => result.current.setProcedimento([foto('p', { categoria: 'antes' })]));
    await assentar();

    expect(pacientesGaleriaApi.upload.mock.calls[0][2]).toMatchObject({
      tipoFotoCodigo: 'ANTES',
      atendimentoItemId: 'item-7',
    });
    expect(result.current.procedimento[0].meta.fotoId).toBe('f-2');
  });

  it('P2: a foto da avaliação sobe com a legenda [avaliacao]', async () => {
    pacientesGaleriaApi.upload.mockResolvedValue({ id: 'f-l1' });
    const { result } = montar();

    act(() => result.current.setAvaliacao([foto('a')]));
    await assentar();

    expect(pacientesGaleriaApi.upload.mock.calls[0][2].legenda).toBe('[avaliacao]');
  });

  it.each([
    ['antes', '[antes]'],
    ['depois', '[depois]'],
    ['mapa', '[mapa]'],
    ['outro', '[outro]'],
    ['pos_imediato', '[antes]'],
    [undefined, '[depois]'],
  ])('P2: a foto do procedimento com categoria %s sobe só com o prefixo %s', async (categoria, legenda) => {
    pacientesGaleriaApi.upload.mockResolvedValue({ id: 'f-l2' });
    const { result } = montar();

    act(() => result.current.setProcedimento([foto('p', categoria ? { categoria } : {})]));
    await assentar();

    expect(pacientesGaleriaApi.upload.mock.calls[0][2].legenda).toBe(legenda);
  });

  it('erro de rede e 5xx são tentados de novo (2/4/8 s); depois do último, o aviso com a contagem', async () => {
    pacientesGaleriaApi.upload
      .mockRejectedValueOnce(erro())
      .mockRejectedValueOnce(erro(503))
      .mockResolvedValueOnce({ id: 'f-3' });
    const { result, avisarErro } = montar();

    act(() => result.current.setAvaliacao([foto('r')]));
    await assentar(20);

    expect(pacientesGaleriaApi.upload).toHaveBeenCalledTimes(3);
    expect(avisarErro).not.toHaveBeenCalled();
    expect(result.current.avaliacao[0].meta.fotoId).toBe('f-3');

    pacientesGaleriaApi.upload.mockReset();
    pacientesGaleriaApi.upload.mockRejectedValue(erro(500));
    act(() => result.current.setAvaliacao((prev) => [...prev, foto('s')]));
    await assentar(20);

    expect(pacientesGaleriaApi.upload).toHaveBeenCalledTimes(4);
    expect(avisarErro).toHaveBeenCalledTimes(1);
    expect(avisarErro).toHaveBeenCalledWith(
      'Não foi possível enviar 1 foto de avaliação. Ela não fica guardada: envie de novo.',
    );
  });

  it('4xx nunca é tentado de novo', async () => {
    pacientesGaleriaApi.upload.mockRejectedValue(erro(422));
    const { result, avisarErro } = montar();

    act(() => result.current.setProcedimento([foto('x')]));
    await assentar(20);

    expect(pacientesGaleriaApi.upload).toHaveBeenCalledTimes(1);
    expect(avisarErro).toHaveBeenCalledWith(
      'Não foi possível enviar 1 foto do procedimento. Ela não fica guardada: envie de novo.',
    );
  });

  describe('item 3: um aviso por lote, com a contagem; a anotação tem aviso próprio', () => {
    it('1 foto de avaliação falha → 1 aviso no singular', async () => {
      pacientesGaleriaApi.upload.mockRejectedValue(erro(422));
      const { result, avisarErro } = montar();

      act(() => result.current.setAvaliacao([foto('a1')]));
      await assentar(20);

      expect(avisarErro).toHaveBeenCalledTimes(1);
      expect(avisarErro).toHaveBeenCalledWith(
        'Não foi possível enviar 1 foto de avaliação. Ela não fica guardada: envie de novo.',
      );
    });

    it('2 fotos de avaliação falham no mesmo lote → 1 aviso só, no plural', async () => {
      pacientesGaleriaApi.upload.mockRejectedValue(erro(422));
      const { result, avisarErro } = montar();

      act(() => result.current.setAvaliacao([foto('a1'), foto('a2')]));
      await assentar(20);

      expect(pacientesGaleriaApi.upload).toHaveBeenCalledTimes(2);
      expect(avisarErro).toHaveBeenCalledTimes(1);
      expect(avisarErro).toHaveBeenCalledWith(
        'Não foi possível enviar 2 fotos de avaliação. Elas não ficam guardadas: envie de novo.',
      );
    });

    it('lote espera o último envio: uma falha cedo e outra depois, ainda em andamento → 1 aviso com 2', async () => {
      const d = adiado();
      pacientesGaleriaApi.upload.mockRejectedValueOnce(erro(422)).mockReturnValueOnce(d.promessa);
      const { result, avisarErro } = montar();

      act(() => result.current.setAvaliacao([foto('cedo'), foto('tarde')]));
      await assentar(20);
      expect(avisarErro).not.toHaveBeenCalled();

      d.resolver(Promise.reject(erro(422)));
      await assentar(20);

      expect(avisarErro).toHaveBeenCalledTimes(1);
      expect(avisarErro).toHaveBeenCalledWith(
        'Não foi possível enviar 2 fotos de avaliação. Elas não ficam guardadas: envie de novo.',
      );
    });

    it('1 foto do procedimento falha → 1 aviso no singular', async () => {
      pacientesGaleriaApi.upload.mockRejectedValue(erro(422));
      const { result, avisarErro } = montar();

      act(() => result.current.setProcedimento([foto('p1')]));
      await assentar(20);

      expect(avisarErro).toHaveBeenCalledTimes(1);
      expect(avisarErro).toHaveBeenCalledWith(
        'Não foi possível enviar 1 foto do procedimento. Ela não fica guardada: envie de novo.',
      );
    });

    it('2 fotos do procedimento falham no mesmo lote → 1 aviso só, no plural', async () => {
      pacientesGaleriaApi.upload.mockRejectedValue(erro(422));
      const { result, avisarErro } = montar();

      act(() => result.current.setProcedimento([foto('p1'), foto('p2')]));
      await assentar(20);

      expect(pacientesGaleriaApi.upload).toHaveBeenCalledTimes(2);
      expect(avisarErro).toHaveBeenCalledTimes(1);
      expect(avisarErro).toHaveBeenCalledWith(
        'Não foi possível enviar 2 fotos do procedimento. Elas não ficam guardadas: envie de novo.',
      );
    });

    it('lote de um novo envio começa do zero depois do aviso', async () => {
      pacientesGaleriaApi.upload.mockRejectedValue(erro(422));
      const { result, avisarErro } = montar();

      act(() => result.current.setAvaliacao([foto('a1'), foto('a2')]));
      await assentar(20);
      act(() => result.current.setAvaliacao((prev) => [...prev, foto('a3')]));
      await assentar(20);

      expect(avisarErro.mock.calls).toEqual([
        ['Não foi possível enviar 2 fotos de avaliação. Elas não ficam guardadas: envie de novo.'],
        ['Não foi possível enviar 1 foto de avaliação. Ela não fica guardada: envie de novo.'],
      ]);
    });

    it.each([1, 2])('F1: só a anotação falha com %i foto(s) já enviada(s) → a Promise rejeita por foto (quem avisa é o editor), nunca o "não fica guardada"', async (n) => {
      const nomes = Array.from({ length: n }, (_, i) => `an${i}`);
      nomes.forEach((nome) => pacientesGaleriaApi.upload.mockResolvedValueOnce({ id: `f-${nome}` }));
      atendimentosApi.anotarFoto.mockRejectedValue(erro(422));
      const { result, avisarErro } = montar();
      act(() => result.current.setProcedimento(nomes.map((nome) => foto(nome))));
      await assentar(20);

      const originais = result.current.procedimento;
      const desenhadas = originais.map((_, i) => new Blob([`desenhada-${i}`]));
      const resultados = await Promise.allSettled(
        originais.map((o, i) => result.current.envio.fotoAnotada(o, desenhadas[i], 'procedimento')),
      );
      await assentar(20);

      expect(atendimentosApi.anotarFoto).toHaveBeenCalledTimes(n);
      expect(resultados.map((r) => r.status)).toEqual(Array(n).fill('rejected'));
      expect(resultados.map((r) => r.reason?.status)).toEqual(Array(n).fill(422));
      expect(avisarErro).not.toHaveBeenCalled();
      // A lista não foi trocada: a foto original continua (o AppRefactored só troca depois de a Promise resolver).
      expect(result.current.procedimento).toBe(originais);
    });

    it('anotação feita durante o envio que falha só na anotação → aviso da anotação, não o do lote', async () => {
      const d = adiado();
      pacientesGaleriaApi.upload.mockReturnValueOnce(d.promessa);
      atendimentosApi.anotarFoto.mockRejectedValue(erro(422));
      const { result, avisarErro } = montar();
      const voando = foto('voando');
      act(() => result.current.setAvaliacao([voando]));
      await assentar();

      const desenhada = new Blob(['desenhada']);
      let resposta;
      await act(async () => {
        resposta = await result.current.envio.fotoAnotada(voando, desenhada, 'avaliacao');
        result.current.setAvaliacao([{ url: 'blob:d', blob: desenhada, meta: { annotated: true } }]);
      });
      // F1: a foto ainda está subindo → 'pendente' na hora; o aviso da anotação sai do hook quando o PUT falhar.
      expect(resposta).toEqual({ estado: 'pendente' });
      d.resolver({ id: 'f-voando' });
      await assentar(20);

      expect(avisarErro.mock.calls).toEqual([['A foto foi enviada, mas a anotação não. Escreva a anotação de novo.']]);
    });
  });

  it('aguardarPendentes espera o envio terminar', async () => {
    const d = adiado();
    pacientesGaleriaApi.upload.mockReturnValue(d.promessa);
    const { result } = montar();
    act(() => result.current.setAvaliacao([foto('w')]));
    await assentar();

    let terminou = false;
    let espera;
    act(() => {
      espera = result.current.envio.aguardarPendentes().then(() => {
        terminou = true;
      });
    });
    await assentar();
    expect(terminou).toBe(false);

    d.resolver({ id: 'f-w' });
    await act(async () => {
      await espera;
    });
    expect(terminou).toBe(true);
  });

  it('aguardarPendentes devolve quantas fotos na tela não subiram (falha); a que subiu ou foi removida não conta', async () => {
    pacientesGaleriaApi.upload.mockRejectedValueOnce(erro(422)).mockResolvedValueOnce({ id: 'f-ok' });
    const { result } = montar();
    act(() => result.current.setAvaliacao([foto('falhou')]));
    await assentar(20);
    act(() => result.current.setProcedimento([foto('subiu')]));
    await assentar(20);

    let naoEnviadas;
    await act(async () => {
      naoEnviadas = await result.current.envio.aguardarPendentes();
    });
    expect(naoEnviadas).toBe(1);
    // A foto que falhou continua na tela, sem fotoId (como hoje).
    expect(result.current.avaliacao).toHaveLength(1);
    expect(result.current.avaliacao[0].meta.fotoId).toBeUndefined();

    act(() => result.current.setAvaliacao([]));
    await assentar();
    await act(async () => {
      naoEnviadas = await result.current.envio.aguardarPendentes();
    });
    expect(naoEnviadas).toBe(0);
  });

  it('remover foto já enviada chama o servidor; removida durante o envio é apagada quando o envio volta', async () => {
    pacientesGaleriaApi.upload.mockResolvedValueOnce({ id: 'f-ok' });
    atendimentosApi.removerFoto.mockResolvedValue(null);
    const { result } = montar();
    act(() => result.current.setAvaliacao([foto('ok')]));
    await assentar();

    act(() => result.current.envio.fotoRemovida(result.current.avaliacao[0]));
    await assentar();
    expect(atendimentosApi.removerFoto).toHaveBeenCalledWith('c-1', 'f-ok');

    const d = adiado();
    pacientesGaleriaApi.upload.mockReturnValueOnce(d.promessa);
    const voando = foto('voando');
    act(() => result.current.setAvaliacao([voando]));
    await assentar();
    act(() => {
      result.current.envio.fotoRemovida(voando);
      result.current.setAvaliacao([]);
    });
    d.resolver({ id: 'f-voando' });
    await assentar();

    expect(atendimentosApi.removerFoto).toHaveBeenLastCalledWith('c-1', 'f-voando');
  });

  it('foto sem fotoId e sem envio em andamento: remover não chama o servidor (P4)', async () => {
    const { result } = montar();
    act(() => result.current.envio.fotoRemovida(foto('local')));
    await assentar();
    expect(atendimentosApi.removerFoto).not.toHaveBeenCalled();
  });

  it('anotar foto já enviada troca o arquivo no servidor e não sobe foto nova; resolve "salva" com a versão e a grava na foto', async () => {
    const VERSAO = '2026-10-15T12:30:00.123Z';
    pacientesGaleriaApi.upload.mockResolvedValueOnce({ id: 'f-an' });
    atendimentosApi.anotarFoto.mockResolvedValue({ id: 'f-an', arquivoAtualizadoEm: VERSAO });
    const { result } = montar();
    act(() => result.current.setProcedimento([foto('orig')]));
    await assentar();

    const original = result.current.procedimento[0];
    const desenhada = new Blob(['desenhada']);
    let resposta;
    await act(async () => {
      resposta = await result.current.envio.fotoAnotada(original, desenhada, 'procedimento');
    });
    expect(resposta).toEqual({ estado: 'salva', arquivoAtualizadoEm: VERSAO });
    // A versão já está na foto original (antes de a tela trocá-la) e segue na trocada (pelo blob que a subiu).
    expect(result.current.procedimento[0].meta).toMatchObject({ fotoId: 'f-an', arquivoAtualizadoEm: VERSAO });
    act(() => {
      result.current.setProcedimento([{ url: 'blob:d', blob: desenhada, meta: { ...original.meta, annotated: true, arquivoAtualizadoEm: VERSAO } }]);
    });
    await assentar();

    expect(atendimentosApi.anotarFoto).toHaveBeenCalledWith('c-1', 'f-an', desenhada);
    expect(atendimentosApi.anotarFoto).toHaveBeenCalledTimes(1);
    expect(pacientesGaleriaApi.upload).toHaveBeenCalledTimes(1);
  });

  it('F1: anotar foto cujo envio falhou → "pendente" e a foto anotada sobe como foto nova quando entra na lista', async () => {
    pacientesGaleriaApi.upload.mockRejectedValueOnce(erro(422)).mockResolvedValueOnce({ id: 'f-nova' });
    const { result } = montar();
    act(() => result.current.setAvaliacao([foto('falhou')]));
    await assentar(20);
    const original = result.current.avaliacao[0];
    expect(original.meta.fotoId).toBeUndefined();

    const desenhada = new Blob(['desenhada']);
    let resposta;
    await act(async () => {
      resposta = await result.current.envio.fotoAnotada(original, desenhada, 'avaliacao');
      result.current.setAvaliacao([{ url: 'blob:d', blob: desenhada, meta: { ...original.meta, annotated: true } }]);
    });
    await assentar(20);

    expect(resposta).toEqual({ estado: 'pendente' });
    expect(pacientesGaleriaApi.upload).toHaveBeenCalledTimes(2);
    expect(pacientesGaleriaApi.upload.mock.calls[1][1]).toBe(desenhada);
    expect(atendimentosApi.anotarFoto).not.toHaveBeenCalled();
    expect(result.current.avaliacao[0].meta.fotoId).toBe('f-nova');
    let naoEnviadas;
    await act(async () => {
      naoEnviadas = await result.current.envio.aguardarPendentes();
    });
    expect(naoEnviadas).toBe(0);
  });

  it('F1: fora da consulta, fotoAnotada resolve "pendente" sem chamar o servidor', async () => {
    const { result } = montar({ consulta: null });
    await expect(result.current.envio.fotoAnotada(foto('x'), new Blob(['d']), 'avaliacao')).resolves.toEqual({ estado: 'pendente' });
    expect(atendimentosApi.anotarFoto).not.toHaveBeenCalled();
  });

  it('F1: foto conhecida cuja versão mudou no detalhe é trocada pela URL de reserva (?v=) e a galeria é relida', async () => {
    const V1 = '2026-10-15T12:30:01.001Z';
    const V2 = '2026-10-15T12:30:02.002Z';
    pacientesGaleriaApi.list.mockResolvedValue({ fotos: [{ id: 'f-srv', url: '/galeria/f-srv?v=1' }] });
    const fotoSrv = (v) => ({ id: 'f-srv', atendimentoItemId: null, tipoFotoCodigo: 'AVALIACAO', arquivoAtualizadoEm: v });
    const { result, rerender } = montar({ consulta: { ...CONSULTA, fotos: [fotoSrv(V1)] } });
    await assentar();
    expect(result.current.avaliacao[0]).toMatchObject({ url: '/galeria/f-srv?v=1', meta: { fotoId: 'f-srv', arquivoAtualizadoEm: V1 } });
    expect(pacientesGaleriaApi.list).toHaveBeenCalledTimes(1);

    rerender({ consultaAtual: { ...CONSULTA, fotos: [fotoSrv(V1)] } });
    await assentar();
    expect(pacientesGaleriaApi.list).toHaveBeenCalledTimes(1);

    rerender({ consultaAtual: { ...CONSULTA, fotos: [fotoSrv(V2)] } });
    await assentar();
    expect(result.current.avaliacao).toHaveLength(1);
    expect(result.current.avaliacao[0]).toEqual({
      url: `/api/v1/pacientes/p-1/galeria/f-srv/arquivo?v=${Date.parse(V2)}`,
      blob: null,
      meta: expect.objectContaining({ fotoId: 'f-srv', arquivoAtualizadoEm: V2 }),
    });
    expect(pacientesGaleriaApi.list).toHaveBeenCalledTimes(2);
  });

  it('P5: o envio continua depois de sair da consulta, com a consulta de quando a foto foi tirada', async () => {
    const d = adiado();
    pacientesGaleriaApi.upload.mockReturnValue(d.promessa);
    const { result, rerender } = montar();
    act(() => result.current.setAvaliacao([foto('p5')]));
    await assentar();

    rerender({ consultaAtual: null });
    d.resolver({ id: 'f-p5' });
    await act(async () => {
      await result.current.envio.aguardarPendentes();
    });

    expect(pacientesGaleriaApi.upload).toHaveBeenCalledTimes(1);
    expect(pacientesGaleriaApi.upload.mock.calls[0][2].atendimentoId).toBe('c-1');
  });

  it('consulta de retorno fica de fora (o fluxo do Retorno envia como hoje)', async () => {
    const { result } = montar({ consulta: { ...CONSULTA, tipoProcedimentoCodigo: 'RETORNO' } });
    act(() => result.current.setAvaliacao([foto('ret')]));
    await assentar();
    expect(pacientesGaleriaApi.upload).not.toHaveBeenCalled();
  });

  it('Y11: foto do servidor (F5 ou outro aparelho) entra no aparelho pela URL da galeria, sem subir de novo', async () => {
    pacientesGaleriaApi.list.mockResolvedValue({ fotos: [{ id: 'f-srv', url: '/galeria/f-srv' }] });
    const { result } = montar({
      consulta: { ...CONSULTA, fotos: [{ id: 'f-srv', atendimentoItemId: null, tipoFotoCodigo: 'AVALIACAO' }] },
    });
    await assentar();

    expect(result.current.avaliacao).toEqual([
      expect.objectContaining({ url: '/galeria/f-srv', blob: null, meta: expect.objectContaining({ fotoId: 'f-srv' }) }),
    ]);
    expect(result.current.procedimento).toEqual([]);
    expect(pacientesGaleriaApi.upload).not.toHaveBeenCalled();
  });

  it('fora da consulta nada sobe', async () => {
    const { result } = montar({ consulta: null });
    act(() => result.current.setAvaliacao([foto('fora')]));
    await assentar();
    expect(pacientesGaleriaApi.upload).not.toHaveBeenCalled();
  });
});

describe('categoriaDaFotoDoServidor (inverso da P2)', () => {
  it.each([
    ['ANTES', '[antes]', 'antes'],
    ['ANTES', null, 'antes'],
    ['MAPA', '[mapa]', 'mapa'],
    ['MAPA', '[mapa] Vista frontal', 'mapa'],
    ['MAPA', null, 'mapa'],
    ['POS_IMEDIATO', '[depois]', 'depois'],
    ['POS_IMEDIATO', '[depois] Toxina botulínica', 'depois'],
    ['POS_IMEDIATO', '[pos_imediato]', 'pos_imediato'],
    ['POS_IMEDIATO', '[outro]', 'outro'],
    ['POS_IMEDIATO', '[outro] Foto do procedimento', 'outro'],
    ['POS_IMEDIATO', '[antes]', 'pos_imediato'],
    ['POS_IMEDIATO', '[antes] Toxina botulínica', 'pos_imediato'],
    ['pos_imediato', '[DEPOIS]', 'depois'],
    ['POS_IMEDIATO', null, 'depois'],
    ['POS_IMEDIATO', '', 'depois'],
    ['POS_IMEDIATO', 'Sem prefixo', 'depois'],
    ['POS_IMEDIATO', '[avaliacao]', 'depois'],
    [null, null, 'depois'],
  ])('tipo %s com legenda %s volta como %s', (tipo, legenda, categoria) => {
    expect(categoriaDaFotoDoServidor(tipo, legenda)).toBe(categoria);
  });

  it.each(['antes', 'depois', 'pos_imediato', 'outro', 'mapa', undefined])(
    'ida e volta: a categoria %s sai pelo envio da P2 e volta igual (também com o nome que o encerrar põe)',
    (categoria) => {
      const meta = categoria ? { categoria } : {};
      const tipo = tipoDaFotoDoProcedimento(meta);
      const legenda = legendaDaFoto('procedimento', meta);
      const esperada = categoria ?? 'depois';
      expect(categoriaDaFotoDoServidor(tipo, legenda)).toBe(esperada);
      expect(categoriaDaFotoDoServidor(tipo, `${legenda} Toxina botulínica`)).toBe(esperada);
    },
  );
});

describe('ehFotoDaVistaDoMapa (a vista do mapa fica fora das faixas)', () => {
  it.each([
    ['MAPA', legendaDaFotoDaVista('frontal'), true],
    ['MAPA', legendaDaFotoDaVista('perfil_dir'), true],
    ['MAPA', '[mapa] Frontal', true],
    ['mapa', '[MAPA] Frontal', true],
    ['MAPA', legendaDaFoto('procedimento', { categoria: 'mapa' }), false],
    ['MAPA', '[mapa]', false],
    ['MAPA', '[mapa]   ', false],
    ['MAPA', null, false],
    ['ANTES', '[mapa] Frontal', false],
    ['POS_IMEDIATO', '[depois] Toxina botulínica', false],
  ])('tipo %s com legenda %s → vista? %s', (tipo, legenda, vista) => {
    expect(ehFotoDaVistaDoMapa(tipo, legenda)).toBe(vista);
  });

  it('a vista sempre sobe com descrição depois de [mapa]; a câmera com categoria mapa, nunca', () => {
    expect(legendaDaFotoDaVista('frontal')).toMatch(/^\[mapa\] \S/);
    expect(legendaDaFoto('procedimento', { categoria: 'mapa' })).toBe('[mapa]');
    expect(tipoDaFotoDoProcedimento({ categoria: 'mapa' })).toBe('MAPA');
    expect(categoriaDaFotoDoServidor('MAPA', '[mapa]')).toBe('mapa');
  });
});

describe('useEnvioFotosConsulta: cada aba recebe as fotos do seu item (Y11)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const itens = [
    { id: 'i-a', ordem: 0, agendaId: null },
    { id: 'i-b', ordem: 1, agendaId: null },
  ];
  const fotoSrv = (id, item, categoria) => ({
    id,
    atendimentoItemId: item,
    tipoFotoCodigo: tipoDaFotoDoProcedimento({ categoria }),
    legenda: legendaDaFoto('procedimento', { categoria }),
  });
  const FOTOS = [
    fotoSrv('f-a1', 'i-a', 'antes'),
    fotoSrv('f-a2', 'i-a', 'depois'),
    fotoSrv('f-b1', 'i-b', 'pos_imediato'),
    fotoSrv('f-b2', 'i-b', 'outro'),
  ];
  /** GET da galeria: URL e legenda. A consulta (AtendimentoFotoDTO) não traz legenda. */
  const galeria = (fotos) => ({
    fotos: fotos.map((f) => ({ id: f.id, url: `/galeria/${f.id}`, legenda: f.legenda, tipoFotoCodigo: f.tipoFotoCodigo })),
  });
  const consultaCom = (fotos) => ({
    ...CONSULTA,
    itens,
    fotos: fotos.map((f) => ({ id: f.id, atendimentoItemId: f.atendimentoItemId, tipoFotoCodigo: f.tipoFotoCodigo })),
  });
  const resumo = (lista) => (lista || []).map((f) => [f.meta?.fotoId, f.meta?.categoria]);

  function montarComAbas({ fotos = FOTOS, item = 'i-a' } = {}) {
    pacientesGaleriaApi.list.mockResolvedValue(galeria(fotos));
    return renderHook(
      ({ consultaAtual, itemAtivo }) => {
        const [avaliacao, setAvaliacao] = useState([]);
        const [procedimento, setProcedimento] = useState([]);
        const [sessao, setSessao] = useState([{ nomeProcedimento: 'A' }, { nomeProcedimento: 'B' }]);
        useEnvioFotosConsulta({
          consulta: consultaAtual,
          roleUserId: 'ru-1',
          fotosAvaliacao: avaliacao,
          fotosProcedimento: procedimento,
          procedimentosSessao: sessao,
          itemDoProcedimentoAtivo: itemAtivo,
          aparelho: {
            setEvaluationCapturedPhotos: setAvaliacao,
            setProcedureCapturedPhotos: setProcedimento,
            setProcedimentosSessao: setSessao,
          },
          avisarErro: vi.fn(),
          esperasMs: ESPERAS,
        });
        return { procedimento, setProcedimento, sessao, setSessao };
      },
      { initialProps: { consultaAtual: consultaCom(fotos), itemAtivo: item } },
    );
  }

  /** A troca de aba de hoje (ConsultaProcedimentoFlow): a lista ao vivo vai para o snapshot da aba antiga e a aba nova volta do snapshot dela. */
  function trocarDeAba(result, de, para) {
    const aoVivo = result.current.procedimento;
    const daNova = result.current.sessao[para].fotosSnapshot || [];
    act(() => {
      result.current.setSessao((prev) => prev.map((l, i) => (i === de ? { ...l, fotosSnapshot: aoVivo } : l)));
      result.current.setProcedimento(daNova);
    });
  }

  it('F5: a aba ativa recebe as fotos do item dela e a outra aba, no snapshot, as do item dela, com a categoria', async () => {
    const { result } = montarComAbas();
    await assentar();

    expect(resumo(result.current.procedimento)).toEqual([['f-a1', 'antes'], ['f-a2', 'depois']]);
    expect(resumo(result.current.sessao[1].fotosSnapshot)).toEqual([['f-b1', 'pos_imediato'], ['f-b2', 'outro']]);
    expect(result.current.sessao[0].fotosSnapshot).toBeUndefined();
    expect(result.current.sessao[1].fotosSnapshot[0]).toMatchObject({ url: '/galeria/f-b1', blob: null });
    expect(pacientesGaleriaApi.upload).not.toHaveBeenCalled();
  });

  it('trocar de aba: a aba nova mostra as fotos do seu item, sem duplicar nem misturar, e a volta também', async () => {
    const { result, rerender } = montarComAbas();
    await assentar();

    trocarDeAba(result, 0, 1);
    rerender({ consultaAtual: consultaCom(FOTOS), itemAtivo: 'i-b' });
    await assentar();
    expect(resumo(result.current.procedimento)).toEqual([['f-b1', 'pos_imediato'], ['f-b2', 'outro']]);
    expect(resumo(result.current.sessao[0].fotosSnapshot)).toEqual([['f-a1', 'antes'], ['f-a2', 'depois']]);

    trocarDeAba(result, 1, 0);
    rerender({ consultaAtual: consultaCom(FOTOS), itemAtivo: 'i-a' });
    await assentar();
    expect(resumo(result.current.procedimento)).toEqual([['f-a1', 'antes'], ['f-a2', 'depois']]);
    expect(resumo(result.current.sessao[1].fotosSnapshot)).toEqual([['f-b1', 'pos_imediato'], ['f-b2', 'outro']]);
  });

  it('trocar para uma aba cujo snapshot não tem as fotos: elas entram ao trocar', async () => {
    const { result, rerender } = montarComAbas();
    await assentar();

    act(() => result.current.setSessao((prev) => [prev[0], { ...prev[1], fotosSnapshot: [] }]));
    trocarDeAba(result, 0, 1);
    rerender({ consultaAtual: consultaCom(FOTOS), itemAtivo: 'i-b' });
    await assentar();

    expect(resumo(result.current.procedimento)).toEqual([['f-b1', 'pos_imediato'], ['f-b2', 'outro']]);
    expect(resumo(result.current.sessao[0].fotosSnapshot)).toEqual([['f-a1', 'antes'], ['f-a2', 'depois']]);
  });

  it('foto removida em outro aparelho sai também do snapshot da outra aba; a rebusca não a traz de volta', async () => {
    const { result, rerender } = montarComAbas();
    await assentar();

    const semB1 = FOTOS.filter((f) => f.id !== 'f-b1');
    pacientesGaleriaApi.list.mockResolvedValue(galeria(semB1));
    rerender({ consultaAtual: consultaCom(semB1), itemAtivo: 'i-a' });
    await assentar();
    expect(resumo(result.current.sessao[1].fotosSnapshot)).toEqual([['f-b2', 'outro']]);
    expect(resumo(result.current.procedimento)).toEqual([['f-a1', 'antes'], ['f-a2', 'depois']]);

    rerender({ consultaAtual: consultaCom(semB1), itemAtivo: 'i-a' });
    await assentar();
    expect(resumo(result.current.sessao[1].fotosSnapshot)).toEqual([['f-b2', 'outro']]);
  });

  it('foto da vista do mapa não entra em aba nenhuma; a da câmera com categoria mapa volta como mapa', async () => {
    const vista = (id, item, codigo) => ({
      id,
      atendimentoItemId: item,
      tipoFotoCodigo: 'MAPA',
      legenda: legendaDaFotoDaVista(codigo),
    });
    const fotos = [
      fotoSrv('f-a1', 'i-a', 'antes'),
      vista('f-a-vista', 'i-a', 'frontal'),
      fotoSrv('f-b-mapa', 'i-b', 'mapa'),
      vista('f-b-vista', 'i-b', 'perfil_dir'),
    ];
    const { result, rerender } = montarComAbas({ fotos });
    await assentar();

    expect(resumo(result.current.procedimento)).toEqual([['f-a1', 'antes']]);
    expect(resumo(result.current.sessao[1].fotosSnapshot)).toEqual([['f-b-mapa', 'mapa']]);
    expect(pacientesGaleriaApi.list).toHaveBeenCalledTimes(1);

    trocarDeAba(result, 0, 1);
    rerender({ consultaAtual: consultaCom(fotos), itemAtivo: 'i-b' });
    await assentar();

    expect(resumo(result.current.procedimento)).toEqual([['f-b-mapa', 'mapa']]);
    expect(resumo(result.current.sessao[0].fotosSnapshot)).toEqual([['f-a1', 'antes']]);
    // A vista já conhecida não faz buscar a galeria de novo a cada troca de aba.
    expect(pacientesGaleriaApi.list).toHaveBeenCalledTimes(1);
  });

  it('foto sem item entra na aba ativa, como hoje, e não entra de novo na aba nova depois da troca', async () => {
    const semItem = { id: 'f-x', atendimentoItemId: null, tipoFotoCodigo: 'ANTES', legenda: '[antes]' };
    const fotos = [...FOTOS, semItem];
    const { result, rerender } = montarComAbas({ fotos });
    await assentar();
    expect(resumo(result.current.procedimento)).toEqual([['f-a1', 'antes'], ['f-a2', 'depois'], ['f-x', 'antes']]);
    expect(result.current.sessao[1].fotosSnapshot.map((f) => f.meta.fotoId)).toEqual(['f-b1', 'f-b2']);

    trocarDeAba(result, 0, 1);
    rerender({ consultaAtual: consultaCom(fotos), itemAtivo: 'i-b' });
    await assentar();

    expect(result.current.procedimento.map((f) => f.meta.fotoId)).toEqual(['f-b1', 'f-b2']);
    expect(result.current.sessao[0].fotosSnapshot.map((f) => f.meta.fotoId)).toEqual(['f-a1', 'f-a2', 'f-x']);
  });
});
