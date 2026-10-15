/**
 * Testador T3 (rodada 3, item 3): o lote por origem nunca engole uma falha (o contador volta a zero em todos os
 * caminhos) e a anotação tem aviso próprio. Também caracteriza o lote compartilhado entre consultas.
 */
import { act, renderHook } from '@testing-library/react';
import { useState } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useEnvioFotosConsulta } from './useEnvioFotosConsulta.js';

vi.mock('../../services/api', () => ({
  atendimentosApi: { removerFoto: vi.fn(), anotarFoto: vi.fn() },
  pacientesGaleriaApi: { upload: vi.fn(), list: vi.fn() },
}));
vi.mock('../../utils/imageUtils.js', () => ({ convertToWebP: vi.fn(async (b) => b) }));

const { atendimentosApi, pacientesGaleriaApi } = await import('../../services/api');
const { convertToWebP } = await import('../../utils/imageUtils.js');

const UMA_AV = 'Não foi possível enviar 1 foto de avaliação. Ela não fica guardada: envie de novo.';
const DUAS_AV = 'Não foi possível enviar 2 fotos de avaliação. Elas não ficam guardadas: envie de novo.';
const UMA_PROC = 'Não foi possível enviar 1 foto do procedimento. Ela não fica guardada: envie de novo.';
const ANOTACAO = 'A foto foi enviada, mas a anotação não. Escreva a anotação de novo.';

const foto = (nome, meta = {}) => ({ url: `blob:${nome}`, blob: new Blob([nome]), meta });
const erro = (status) => Object.assign(new Error(`HTTP ${status}`), { status });
function adiado() {
  let resolver;
  const promessa = new Promise((r) => { resolver = r; });
  return { promessa, resolver };
}
async function assentar(n = 20) {
  await act(async () => {
    for (let i = 0; i < n; i += 1) await new Promise((r) => setTimeout(r, 2));
  });
}

function montar(consulta = { id: 'c-1', pacienteId: 'p-1' }) {
  const avisarErro = vi.fn();
  const r = renderHook(({ consultaAtual }) => {
    const [avaliacao, setAvaliacao] = useState([]);
    const [procedimento, setProcedimento] = useState([]);
    const envio = useEnvioFotosConsulta({
      consulta: consultaAtual,
      roleUserId: 'ru-1',
      fotosAvaliacao: avaliacao,
      fotosProcedimento: procedimento,
      itemDoProcedimentoAtivo: 'item-1',
      aparelho: { setEvaluationCapturedPhotos: setAvaliacao, setProcedureCapturedPhotos: setProcedimento },
      avisarErro,
      esperasMs: [1, 1, 1],
    });
    return { envio, avaliacao, setAvaliacao, procedimento, setProcedimento };
  }, { initialProps: { consultaAtual: consulta } });
  return { ...r, avisarErro };
}

describe('T3 item 3: o lote nunca engole falha', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    convertToWebP.mockImplementation(async (b) => b);
  });

  it('removida durante o envio (sucesso) não trava o lote: a falha seguinte avisa sozinha', async () => {
    const d = adiado();
    pacientesGaleriaApi.upload.mockReturnValueOnce(d.promessa).mockRejectedValueOnce(erro(422));
    atendimentosApi.removerFoto.mockResolvedValue(null);
    const { result, avisarErro } = montar();
    const voando = foto('voando');
    act(() => result.current.setAvaliacao([voando]));
    await assentar();
    act(() => {
      result.current.envio.fotoRemovida(voando);
      result.current.setAvaliacao([]);
    });
    d.resolver({ id: 'f-voando' });
    await assentar();
    expect(atendimentosApi.removerFoto).toHaveBeenCalledWith('c-1', 'f-voando');
    expect(avisarErro).not.toHaveBeenCalled();

    act(() => result.current.setAvaliacao([foto('depois')]));
    await assentar();
    expect(avisarErro.mock.calls).toEqual([[UMA_AV]]);
  });

  it('removida durante o envio e a remoção no servidor falha: sem aviso de lote, e o lote segue zerado', async () => {
    const d = adiado();
    pacientesGaleriaApi.upload.mockReturnValueOnce(d.promessa).mockRejectedValueOnce(erro(422));
    atendimentosApi.removerFoto.mockRejectedValue(erro(422));
    const { result, avisarErro } = montar();
    const voando = foto('voando');
    act(() => result.current.setAvaliacao([voando]));
    await assentar();
    act(() => {
      result.current.envio.fotoRemovida(voando);
      result.current.setAvaliacao([]);
    });
    d.resolver({ id: 'f-voando' });
    await assentar();
    expect(avisarErro).not.toHaveBeenCalled();

    act(() => result.current.setAvaliacao([foto('depois')]));
    await assentar();
    expect(avisarErro.mock.calls).toEqual([[UMA_AV]]);
  });

  it('envio sem fotoId na resposta não trava o lote', async () => {
    pacientesGaleriaApi.upload.mockResolvedValueOnce({}).mockRejectedValueOnce(erro(422));
    const { result, avisarErro } = montar();
    act(() => result.current.setAvaliacao([foto('semid')]));
    await assentar();
    expect(avisarErro).not.toHaveBeenCalled();

    act(() => result.current.setAvaliacao((prev) => [...prev, foto('falha')]));
    await assentar();
    expect(avisarErro.mock.calls).toEqual([[UMA_AV]]);
  });

  it('exceção no convertToWebP conta como falha do lote (e libera o lote)', async () => {
    convertToWebP.mockRejectedValueOnce(new Error('canvas'));
    pacientesGaleriaApi.upload.mockRejectedValue(erro(422));
    const { result, avisarErro } = montar();
    act(() => result.current.setAvaliacao([foto('webp'), foto('upload')]));
    await assentar();
    expect(pacientesGaleriaApi.upload).toHaveBeenCalledTimes(1);
    expect(avisarErro.mock.calls).toEqual([[DUAS_AV]]);

    act(() => result.current.setAvaliacao((prev) => [...prev, foto('mais')]));
    await assentar();
    expect(avisarErro.mock.calls).toEqual([[DUAS_AV], [UMA_AV]]);
  });

  it('origens são lotes separados: avaliação pendente não segura o aviso do procedimento', async () => {
    const d = adiado();
    pacientesGaleriaApi.upload.mockReturnValueOnce(d.promessa).mockRejectedValueOnce(erro(422));
    const { result, avisarErro } = montar();
    act(() => result.current.setAvaliacao([foto('av-voando')]));
    await assentar();
    act(() => result.current.setProcedimento([foto('proc')]));
    await assentar();
    expect(avisarErro.mock.calls).toEqual([[UMA_PROC]]);
    d.resolver({ id: 'f-av' });
    await assentar();
    expect(avisarErro.mock.calls).toEqual([[UMA_PROC]]);
  });

  it('upload falha com anotação feita durante o envio → conta no lote (foto não subiu), sem texto da anotação', async () => {
    const d = adiado();
    pacientesGaleriaApi.upload.mockReturnValueOnce(d.promessa);
    const { result, avisarErro } = montar();
    const voando = foto('voando');
    act(() => result.current.setAvaliacao([voando]));
    await assentar();
    const desenhada = new Blob(['d']);
    let resposta;
    await act(async () => {
      resposta = await result.current.envio.fotoAnotada(voando, desenhada, 'avaliacao');
      result.current.setAvaliacao([{ url: 'blob:d', blob: desenhada, meta: { annotated: true } }]);
    });
    expect(resposta).toEqual({ estado: 'pendente' });
    d.resolver(Promise.reject(erro(422)));
    await assentar();
    expect(avisarErro.mock.calls).toEqual([[UMA_AV]]);
    expect(atendimentosApi.anotarFoto).not.toHaveBeenCalled();
    let n;
    await act(async () => { n = await result.current.envio.aguardarPendentes(); });
    expect(n).toBe(1);
  });

  it('F1: anotação de foto já enviada falhando (2 fotos, avaliação) → 2 Promises rejeitadas depois das tentativas, nenhum aviso do hook (nem o do lote)', async () => {
    pacientesGaleriaApi.upload.mockResolvedValueOnce({ id: 'f-1' }).mockResolvedValueOnce({ id: 'f-2' });
    atendimentosApi.anotarFoto.mockRejectedValue(erro(500));
    const { result, avisarErro } = montar();
    act(() => result.current.setAvaliacao([foto('a'), foto('b')]));
    await assentar();
    const orig = result.current.avaliacao;
    const novas = orig.map((_, i) => new Blob([`n${i}`]));
    const resultados = await Promise.allSettled(orig.map((o, i) => result.current.envio.fotoAnotada(o, novas[i], 'avaliacao')));
    await assentar(40);
    expect(atendimentosApi.anotarFoto).toHaveBeenCalledTimes(8); // 2 fotos × (1 + 3 tentativas)
    expect(resultados.map((r) => r.status)).toEqual(['rejected', 'rejected']);
    expect(avisarErro).not.toHaveBeenCalled();
    // A lista fica com as fotos originais (a tela só troca depois de a Promise resolver).
    expect(result.current.avaliacao).toBe(orig);
    let n;
    await act(async () => { n = await result.current.envio.aguardarPendentes(); });
    expect(n).toBe(0);
  });

  it('CARACTERIZA: o lote é por origem, não por consulta — falha da consulta A espera o envio da consulta B', async () => {
    const dA = adiado();
    const dB = adiado();
    pacientesGaleriaApi.upload.mockReturnValueOnce(dA.promessa).mockReturnValueOnce(dB.promessa);
    const { result, rerender, avisarErro } = montar({ id: 'c-A', pacienteId: 'p-A' });
    act(() => result.current.setAvaliacao([foto('fotoA')]));
    await assentar();

    rerender({ consultaAtual: { id: 'c-B', pacienteId: 'p-B' } });
    act(() => result.current.setAvaliacao((prev) => [...prev, foto('fotoB')]));
    await assentar();
    expect(pacientesGaleriaApi.upload.mock.calls.map((c) => c[2].atendimentoId)).toEqual(['c-A', 'c-B']);

    dA.resolver(Promise.reject(erro(422)));
    await assentar();
    // A falha da consulta A não avisa enquanto o envio da consulta B estiver em andamento.
    expect(avisarErro).not.toHaveBeenCalled();

    dB.resolver(Promise.reject(erro(422)));
    await assentar();
    // Um aviso só, somando as duas consultas.
    expect(avisarErro.mock.calls).toEqual([[DUAS_AV]]);
  });
});
