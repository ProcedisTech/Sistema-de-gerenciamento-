import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useMapaAplicacaoState } from './useMapaAplicacaoState.js';
import { useMapaRascunhoAutosave } from './useMapaRascunhoAutosave.js';

vi.mock('../../services/api', () => ({
  atendimentosApi: { salvarMapa: vi.fn(), buscarMapa: vi.fn() },
  pacientesGaleriaApi: { upload: vi.fn(), list: vi.fn(), fetchArquivoBlob: vi.fn() },
}));

const aviso = vi.hoisted(() => ({ handler: null }));
vi.mock('../../contexts/useAviso.js', () => ({
  useAviso: (_prefixo, handler) => {
    aviso.handler = handler;
  },
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

  it('consulta de retorno tem rascunho ativo e neutraliza invalidCatIds', async () => {
    const invalidPid = '267cdd51-06d8-4852-8e10-ee3aa07a1d02';
    const avisarErro = vi.fn();
    const { result } = renderHook(() => {
      const mapa = useMapaAplicacaoState();
      const autosave = useMapaRascunhoAutosave({
        consulta: { ...CONSULTA, tipoProcedimentoCodigo: 'RETORNO' },
        itemId: 'item-1',
        mapaState: mapa,
        roleUserId: 'ru-1',
        avisarErro,
        debounceMs: DEBOUNCE,
        esperasMs: ESPERAS,
        invalidCatIds: [invalidPid],
      });
      return { mapa, autosave };
    });

    act(() => result.current.mapa.adicionarPonto('FRONTAL', {
      ...ponto(0.1),
      catalogoProcedimentoSaudeId: invalidPid,
      procedimentoIndex: 0,
    }));
    await assentar();

    expect(atendimentosApi.salvarMapa).toHaveBeenCalledTimes(1);
    const payload = atendimentosApi.salvarMapa.mock.calls[0][2];
    expect(payload.marcacoes[0].catalogoProcedimentoSaudeId).toBeNull();
    expect(payload.marcacoes[0].procedimentoIndex).toBe(0);
  });

  it('aguardarMapa salva o pendente sem esperar o debounce', async () => {
    const { result } = montar();
    await assentar();
    act(() => result.current.mapa.adicionarPonto('FRONTAL', ponto(0.1)));
    await act(async () => result.current.autosave.aguardarMapa());
    expect(atendimentosApi.salvarMapa).toHaveBeenCalledTimes(1);
  });
});

describe('useMapaRascunhoAutosave: releitura ao voltar', () => {
  const dtoDe = (vista, quantidade = 1) => ({
    mapaId: 'm-1',
    atendimentoItemId: 'item-1',
    fotoGaleriaIdPorVista: {},
    marcacoes: [{ anguloFotoCodigo: vista, quantidade, tipoGeometria: 'ponto', vertices: [{ ordem: 1, posX: 0.1, posY: 0.1 }] }],
  });
  const buscasDe = (iid) => atendimentosApi.buscarMapa.mock.calls.filter((c) => c[1] === iid).length;
  const SAIU = { consultaAtual: null, itemAtual: 'item-1' };
  const VOLTOU = { consultaAtual: CONSULTA, itemAtual: 'item-1' };
  const envioPendente = () => {
    const ctl = {};
    atendimentosApi.salvarMapa.mockImplementationOnce(() => new Promise((res, rej) => {
      ctl.soltar = res;
      ctl.falhar = rej;
    }));
    return ctl;
  };

  beforeEach(() => {
    vi.clearAllMocks();
    aviso.handler = null;
    atendimentosApi.buscarMapa.mockResolvedValue(null);
    atendimentosApi.salvarMapa.mockResolvedValue({});
  });

  it('1) sai e volta com o mapa na memória: nenhuma leitura nova e o mapa igual (D3\')', async () => {
    atendimentosApi.buscarMapa.mockResolvedValue(dtoDe('FRONTAL'));
    const { result, rerender } = montar();
    await assentar();
    expect(buscasDe('item-1')).toBe(1);
    const antes = result.current.mapa.pontosPorVista.FRONTAL;

    rerender(SAIU);
    rerender(VOLTOU);
    await assentar();

    expect(buscasDe('item-1')).toBe(1);
    expect(result.current.mapa.pontosPorVista.FRONTAL).toEqual(antes);
  });

  it('3) A -> B (marca e salva) -> A, com rascunho nos dois: nenhuma leitura nova do A e os pontos continuam (D6\')', async () => {
    atendimentosApi.buscarMapa.mockResolvedValue(dtoDe('FRONTAL'));
    const { result, rerender } = montar();
    await assentar();
    rerender({ consultaAtual: CONSULTA, itemAtual: 'item-2' });
    await assentar();
    act(() => result.current.mapa.adicionarPonto('PERFIL_D', ponto(0.4)));
    await assentar();
    expect(atendimentosApi.salvarMapa).toHaveBeenCalledTimes(1);
    expect(buscasDe('item-1')).toBe(1);
    expect(buscasDe('item-2')).toBe(1);

    rerender({ consultaAtual: CONSULTA, itemAtual: 'item-1' });
    await assentar();

    expect(buscasDe('item-1')).toBe(1);
    expect(buscasDe('item-2')).toBe(1);
    expect(result.current.mapa.pontosPorVista.FRONTAL).toHaveLength(1);
    expect(result.current.mapa.pontosPorVista.PERFIL_D).toHaveLength(1);
  });

  it('4) procedimento ainda não lido: lê uma vez só, mesmo com re-render', async () => {
    const { rerender } = montar();
    await assentar();
    expect(buscasDe('item-1')).toBe(1);
    rerender({ consultaAtual: CONSULTA, itemAtual: 'item-9' });
    rerender({ consultaAtual: { ...CONSULTA }, itemAtual: 'item-9' });
    await assentar();
    expect(buscasDe('item-9')).toBe(1);
  });

  it('6) aviso de procedimento relê, mesmo já lido e com o mapa preenchido', async () => {
    atendimentosApi.buscarMapa.mockResolvedValue(dtoDe('FRONTAL'));
    const { result } = montar();
    await assentar();
    expect(buscasDe('item-1')).toBe(1);
    expect(result.current.mapa.pontosPorVista.FRONTAL).toHaveLength(1);

    act(() => aviso.handler());
    await assentar();
    expect(buscasDe('item-1')).toBe(2);
  });

  it('a) 2) consulta some, o mapa é zerado e volta: busca de novo e repõe o mapa (D3\')', async () => {
    atendimentosApi.buscarMapa.mockResolvedValue(dtoDe('FRONTAL'));
    const { result, rerender } = montar();
    await assentar();
    expect(buscasDe('item-1')).toBe(1);
    expect(result.current.mapa.pontosPorVista.FRONTAL).toHaveLength(1);

    rerender(SAIU);
    act(() => result.current.mapa.resetMapa());
    expect(result.current.mapa.pontosPorVista.FRONTAL ?? []).toHaveLength(0);
    rerender(VOLTOU);
    await assentar();

    expect(buscasDe('item-1')).toBe(2);
    expect(result.current.mapa.pontosPorVista.FRONTAL).toHaveLength(1);
  });

  it('b) vista com mudança não salva continua igual depois da releitura (pelo aviso, D3\': voltar com mapa cheio não relê)', async () => {
    atendimentosApi.salvarMapa.mockRejectedValue(Object.assign(erro(422), { body: { message: 'x' } }));
    const { result } = montar();
    await assentar();
    act(() => result.current.mapa.adicionarPonto('FRONTAL', ponto(0.9, 7)));
    await assentar();
    expect(result.current.mapa.getDirtyVistas()).toEqual(['FRONTAL']);

    atendimentosApi.buscarMapa.mockResolvedValue({
      ...dtoDe('FRONTAL', 1),
      marcacoes: [...dtoDe('FRONTAL', 1).marcacoes, ...dtoDe('PERFIL_D', 3).marcacoes],
    });
    act(() => aviso.handler());
    await assentar();

    expect(buscasDe('item-1')).toBe(2);
    expect(result.current.mapa.pontosPorVista.FRONTAL[0].quantidade).toBe(7);
    expect(result.current.mapa.pontosPorVista.PERFIL_D).toHaveLength(1);
    expect(result.current.mapa.getDirtyVistas()).toEqual(['FRONTAL']);
  });

  it('c) envio em andamento: só busca depois que o envio termina (D7)', async () => {
    const envio = envioPendente();
    const { result } = montar();
    await assentar();
    act(() => result.current.mapa.adicionarPonto('FRONTAL', ponto(0.1)));
    await assentar();
    expect(atendimentosApi.salvarMapa).toHaveBeenCalledTimes(1);

    act(() => aviso.handler());
    await assentar();
    expect(buscasDe('item-1')).toBe(1);

    await act(async () => envio.soltar({}));
    await assentar();
    expect(buscasDe('item-1')).toBe(2);
  });

  it('c2) sai da consulta com mudança pendente (enfileira no cleanup), o mapa é zerado e volta: a releitura espera esse envio (D3\')', async () => {
    const envio = envioPendente();
    const { result, rerender } = montar();
    await assentar();
    act(() => result.current.mapa.adicionarPonto('FRONTAL', ponto(0.1)));
    rerender(SAIU);
    act(() => result.current.mapa.resetMapa());
    rerender(VOLTOU);
    await assentar();
    expect(atendimentosApi.salvarMapa).toHaveBeenCalledTimes(1);
    expect(buscasDe('item-1')).toBe(1);

    await act(async () => envio.soltar({}));
    await assentar();
    expect(buscasDe('item-1')).toBe(2);
  });

  it('d) envio que falha: a releitura acontece mesmo assim', async () => {
    const envio = envioPendente();
    const { result } = montar();
    await assentar();
    act(() => result.current.mapa.adicionarPonto('FRONTAL', ponto(0.1)));
    await assentar();
    act(() => aviso.handler());
    await assentar();
    expect(buscasDe('item-1')).toBe(1);

    await act(async () => envio.falhar(Object.assign(erro(422), { body: { message: 'x' } })));
    await assentar();
    expect(buscasDe('item-1')).toBe(2);
  });

  it('d2) fila que rejeita (o aviso de erro lança): a releitura acontece mesmo assim', async () => {
    const naoTratada = vi.fn();
    globalThis.process.on('unhandledRejection', naoTratada);
    const envio = envioPendente();
    const avisarErro = vi.fn(() => {
      throw new Error('aviso quebrou');
    });
    const r = renderHook(() => {
      const mapa = useMapaAplicacaoState();
      useMapaRascunhoAutosave({
        consulta: CONSULTA, itemId: 'item-1', mapaState: mapa, roleUserId: 'ru-1', avisarErro, debounceMs: DEBOUNCE, esperasMs: ESPERAS,
      });
      return mapa;
    });
    await assentar();
    act(() => r.result.current.adicionarPonto('FRONTAL', ponto(0.1)));
    await assentar();
    act(() => aviso.handler());
    await assentar();
    expect(buscasDe('item-1')).toBe(1);

    await act(async () => envio.falhar(Object.assign(erro(422), { body: { message: 'x' } })));
    await assentar();
    globalThis.process.off('unhandledRejection', naoTratada);
    expect(buscasDe('item-1')).toBe(2);
  });

  it('e) troca de item relê o item novo e descarta a resposta atrasada do antigo (D6)', async () => {
    let soltarAntigo;
    atendimentosApi.buscarMapa.mockImplementationOnce(() => new Promise((r) => {
      soltarAntigo = r;
    }));
    atendimentosApi.buscarMapa.mockImplementationOnce(async () => dtoDe('PERFIL_D'));
    const { result, rerender } = montar();
    rerender({ consultaAtual: CONSULTA, itemAtual: 'item-2' });
    await assentar();
    expect(buscasDe('item-2')).toBe(1);

    await act(async () => soltarAntigo(dtoDe('FRONTAL')));
    await assentar();
    expect(result.current.mapa.pontosPorVista.PERFIL_D).toHaveLength(1);
    expect(result.current.mapa.pontosPorVista.FRONTAL).toBeUndefined();
  });

  it('f) aviso + troca de item juntos: a releitura do item antigo (esperando envio) não dispara', async () => {
    const envio = envioPendente();
    const { result, rerender } = montar();
    await assentar();
    act(() => result.current.mapa.adicionarPonto('FRONTAL', ponto(0.1)));
    await assentar();
    act(() => aviso.handler());
    rerender({ consultaAtual: CONSULTA, itemAtual: 'item-2' });
    await assentar();
    expect(buscasDe('item-2')).toBe(1);

    await act(async () => envio.soltar({}));
    await assentar();
    expect(buscasDe('item-1')).toBe(1);
    expect(buscasDe('item-2')).toBe(1);
  });

  it('f2) dois avisos seguidos esperando o mesmo envio: só a mais recente aplica', async () => {
    const envio = envioPendente();
    const { result } = montar();
    await assentar();
    act(() => result.current.mapa.adicionarPonto('FRONTAL', ponto(0.1)));
    await assentar();
    act(() => aviso.handler());
    act(() => aviso.handler());

    await act(async () => envio.soltar({}));
    await assentar();
    expect(buscasDe('item-1')).toBe(2);
  });

  it('f3) aviso esperando envio e a consulta some: não busca ao liberar', async () => {
    const envio = envioPendente();
    const { result, rerender } = montar();
    await assentar();
    act(() => result.current.mapa.adicionarPonto('FRONTAL', ponto(0.1)));
    await assentar();
    act(() => aviso.handler());
    rerender(SAIU);
    await act(async () => envio.soltar({}));
    await assentar();
    expect(buscasDe('item-1')).toBe(1);
  });
});
