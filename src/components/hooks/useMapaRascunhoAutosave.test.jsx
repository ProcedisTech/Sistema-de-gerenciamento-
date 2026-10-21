import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useMapaAplicacaoState } from './useMapaAplicacaoState.js';
import { useMapaRascunhoAutosave } from './useMapaRascunhoAutosave.js';

vi.mock('../../services/api', () => ({
  atendimentosApi: { salvarMapa: vi.fn(), buscarMapa: vi.fn() },
  pacientesGaleriaApi: { upload: vi.fn(), list: vi.fn(), fetchArquivoBlob: vi.fn() },
}));

const { atendimentosApi, pacientesGaleriaApi } = await import('../../services/api');

const CONSULTA = { id: 'c-1', pacienteId: 'p-1', tipoProcedimentoCodigo: null };
const ESPERAS = [1, 1, 1];
const DEBOUNCE = 20;

function erro(status) {
  return Object.assign(new Error(`HTTP ${status ?? 'rede'}`), status ? { status } : {});
}

async function assentar(ms = 80) {
  await act(async () => {
    await new Promise((r) => setTimeout(r, ms));
  });
}

function montar({ consulta = CONSULTA, item = 'item-1' } = {}) {
  const avisarErro = vi.fn();
  const r = renderHook(
    ({ consultaAtual, itemAtual }) => {
      const mapa = useMapaAplicacaoState();
      const autosave = useMapaRascunhoAutosave({
        consulta: consultaAtual,
        itemId: itemAtual,
        mapaState: mapa,
        roleUserId: 'ru-1',
        avisarErro,
        debounceMs: DEBOUNCE,
        esperasMs: ESPERAS,
      });
      return { mapa, autosave };
    },
    { initialProps: { consultaAtual: consulta, itemAtual: item } },
  );
  return { ...r, avisarErro };
}

const ponto = (posX, quantidade = 2) => ({ posX, posY: 0.5, quantidade });

describe('useMapaRascunhoAutosave (C4)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    atendimentosApi.buscarMapa.mockResolvedValue(null);
    atendimentosApi.salvarMapa.mockResolvedValue({});
  });

  it('salva sozinho depois do debounce, uma vez, e limpa a vista suja', async () => {
    const { result } = montar();
    await assentar();

    act(() => {
      result.current.mapa.adicionarPonto('FRONTAL', ponto(0.1));
      result.current.mapa.adicionarPonto('FRONTAL', ponto(0.2));
    });
    expect(atendimentosApi.salvarMapa).not.toHaveBeenCalled();
    await assentar();

    expect(atendimentosApi.salvarMapa).toHaveBeenCalledTimes(1);
    const [cid, iid, corpo] = atendimentosApi.salvarMapa.mock.calls[0];
    expect(cid).toBe('c-1');
    expect(iid).toBe('item-1');
    expect(corpo.marcacoes).toHaveLength(2);
    expect(corpo.marcacoes[0]).toMatchObject({ anguloFotoCodigo: 'FRONTAL', quantidade: 2 });
    expect(result.current.mapa.getDirtyVistas()).toEqual([]);
  });

  it('mudança durante o envio continua suja e gera novo envio', async () => {
    let soltar;
    atendimentosApi.salvarMapa.mockImplementationOnce(() => new Promise((r) => {
      soltar = r;
    }));
    const { result } = montar();
    await assentar();

    act(() => result.current.mapa.adicionarPonto('FRONTAL', ponto(0.1)));
    await assentar();
    expect(atendimentosApi.salvarMapa).toHaveBeenCalledTimes(1);

    act(() => result.current.mapa.adicionarPonto('FRONTAL', ponto(0.3)));
    await act(async () => soltar({}));
    expect(result.current.mapa.getDirtyVistas()).toEqual(['FRONTAL']);

    await assentar();
    expect(atendimentosApi.salvarMapa).toHaveBeenCalledTimes(2);
    expect(atendimentosApi.salvarMapa.mock.calls[1][2].marcacoes).toHaveLength(2);
    expect(result.current.mapa.getDirtyVistas()).toEqual([]);
  });

  it('422 é chamado uma vez só e mostra a mensagem do servidor', async () => {
    atendimentosApi.salvarMapa.mockRejectedValue(Object.assign(erro(422), {
      body: { message: 'Quantidade fora da faixa.' },
    }));
    const { result, avisarErro } = montar();
    await assentar();

    act(() => result.current.mapa.adicionarPonto('FRONTAL', ponto(0.1)));
    await assentar();

    expect(atendimentosApi.salvarMapa).toHaveBeenCalledTimes(1);
    expect(avisarErro).toHaveBeenCalledWith('Quantidade fora da faixa.');
    expect(result.current.mapa.getDirtyVistas()).toEqual(['FRONTAL']);
  });

  it('erro de rede e 5xx são tentados de novo', async () => {
    atendimentosApi.salvarMapa
      .mockRejectedValueOnce(erro())
      .mockRejectedValueOnce(erro(503))
      .mockResolvedValueOnce({});
    const { result, avisarErro } = montar();
    await assentar();

    act(() => result.current.mapa.adicionarPonto('FRONTAL', ponto(0.1)));
    await assentar();

    expect(atendimentosApi.salvarMapa).toHaveBeenCalledTimes(3);
    expect(avisarErro).not.toHaveBeenCalled();
    expect(result.current.mapa.getDirtyVistas()).toEqual([]);
  });

  it('a rebusca nunca sobrescreve vista suja', async () => {
    let soltarBusca;
    atendimentosApi.buscarMapa.mockImplementationOnce(() => new Promise((r) => {
      soltarBusca = r;
    }));
    const { result } = montar();

    act(() => result.current.mapa.adicionarPonto('FRONTAL', ponto(0.9, 7)));
    await act(async () => soltarBusca({
      mapaId: 'm-1',
      atendimentoItemId: 'item-1',
      fotoGaleriaIdPorVista: {},
      marcacoes: [
        { anguloFotoCodigo: 'FRONTAL', quantidade: 1, tipoGeometria: 'ponto', vertices: [{ ordem: 1, posX: 0.1, posY: 0.1 }] },
        { anguloFotoCodigo: 'PERFIL_D', quantidade: 3, tipoGeometria: 'ponto', vertices: [{ ordem: 1, posX: 0.2, posY: 0.2 }] },
      ],
    }));

    const pontos = result.current.mapa.pontosPorVista;
    expect(pontos.FRONTAL).toHaveLength(1);
    expect(pontos.FRONTAL[0].quantidade).toBe(7);
    expect(pontos.PERFIL_D).toHaveLength(1);
    expect(result.current.mapa.getDirtyVistas()).toEqual(['FRONTAL']);
  });

  it('foto da vista sobe como MAPA da consulta e o id vai no rascunho', async () => {
    pacientesGaleriaApi.upload.mockResolvedValue({ id: 'f-9' });
    const { result } = montar();
    await assentar();

    act(() => result.current.mapa.setFotoVista('FRONTAL', {
      displayUrl: 'blob:x', blob: new Blob(['x']), source: 'capture',
    }));
    await assentar();

    expect(pacientesGaleriaApi.upload.mock.calls[0][2]).toMatchObject({
      tipoFotoCodigo: 'MAPA', atendimentoId: 'c-1', atendimentoItemId: 'item-1',
    });
    expect(atendimentosApi.salvarMapa.mock.calls[0][2].fotoGaleriaIdPorVista).toEqual({ FRONTAL: 'f-9' });
    expect(result.current.mapa.getFotoVista('FRONTAL').fotoGaleriaId).toBeUndefined();
  });

  it('P2: a foto da vista sobe com a legenda [mapa] e o rótulo da vista, como no encerrar de hoje', async () => {
    pacientesGaleriaApi.upload.mockResolvedValue({ id: 'f-10' });
    const { result } = montar();
    await assentar();

    act(() => result.current.mapa.setFotoVista('frontal', {
      displayUrl: 'blob:y', blob: new Blob(['y']), source: 'capture',
    }));
    await assentar();

    expect(pacientesGaleriaApi.upload.mock.calls[0][2]).toMatchObject({
      tipoFotoCodigo: 'MAPA', legenda: '[mapa] Frontal', atendimentoId: 'c-1', atendimentoItemId: 'item-1',
    });
  });

  it('troca de item salva na hora o que esperava, no item antigo', async () => {
    const { result, rerender } = montar();
    await assentar();

    act(() => result.current.mapa.adicionarPonto('FRONTAL', ponto(0.1)));
    rerender({ consultaAtual: CONSULTA, itemAtual: 'item-2' });
    await act(async () => {});

    expect(atendimentosApi.salvarMapa).toHaveBeenCalled();
    expect(atendimentosApi.salvarMapa.mock.calls[0][1]).toBe('item-1');
  });

  it('consulta de retorno não tem rascunho', async () => {
    const { result } = montar({ consulta: { ...CONSULTA, tipoProcedimentoCodigo: 'RETORNO' } });
    act(() => result.current.mapa.adicionarPonto('FRONTAL', ponto(0.1)));
    await assentar();
    expect(atendimentosApi.buscarMapa).not.toHaveBeenCalled();
    expect(atendimentosApi.salvarMapa).not.toHaveBeenCalled();
  });

  it('aguardarMapa salva o pendente sem esperar o debounce', async () => {
    const { result } = montar();
    await assentar();
    act(() => result.current.mapa.adicionarPonto('FRONTAL', ponto(0.1)));
    await act(async () => result.current.autosave.aguardarMapa());
    expect(atendimentosApi.salvarMapa).toHaveBeenCalledTimes(1);
  });
});
