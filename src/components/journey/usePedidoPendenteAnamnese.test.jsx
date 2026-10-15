import { act, renderHook } from '@testing-library/react';
import { usePedidoPendenteAnamnese } from './usePedidoPendenteAnamnese.js';
import { criarAvisosFalsos } from '../../test/avisosFalsos.jsx';
import { AVISO } from '../../services/avisos/tiposAviso.js';

vi.mock('../../services/api', () => ({
  anamneseApi: { getDocumento: vi.fn() },
  anamneseEnvioApi: { status: vi.fn(), cancelar: vi.fn() },
}));

import { anamneseApi, anamneseEnvioApi } from '../../services/api';

const emBranco = {
  id: 'pre-branco',
  anamneseId: 'f1',
  status: 'aguardando_paciente',
  preenchidoPorPaciente: true,
  quantidadeRespostas: 0,
  dataHora: '2026-09-01T10:00:00Z',
};
const FUTURO = '2099-01-01T00:00:00Z';

const flush = () => act(async () => {});
const avancar = (ms = 300) => act(async () => { await vi.advanceTimersByTimeAsync(ms); });

function montar(props = {}) {
  const canal = criarAvisosFalsos();
  const onRespondido = vi.fn();
  const onEncerrado = vi.fn();
  const initialProps = {
    ativo: true,
    pacienteId: 'pac1',
    historicoPaciente: [emBranco],
    onRespondido,
    onEncerrado,
    ...props,
  };
  const utils = renderHook((p) => usePedidoPendenteAnamnese(p), { initialProps, wrapper: canal.Wrapper });
  return { ...utils, canal, onRespondido, onEncerrado, initialProps };
}

describe('usePedidoPendenteAnamnese', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    anamneseApi.getDocumento.mockResolvedValue({
      envioAtivo: { id: 'env1', status: 'PENDENTE', expiraEm: FUTURO },
    });
    anamneseEnvioApi.status.mockResolvedValue({ status: 'PENDENTE' });
    anamneseEnvioApi.cancelar.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('resolve o pedido pela lista + documento', async () => {
    const { result } = montar();
    await flush();
    expect(anamneseApi.getDocumento).toHaveBeenCalledWith('pac1', 'pre-branco');
    expect(result.current.pedido).toEqual({
      envioId: 'env1',
      preenchimentoId: 'pre-branco',
      enviadoEm: emBranco.dataHora,
      expiraEm: FUTURO,
    });
  });

  it('documento sem envioAtivo → sem pedido e sem consulta de status', async () => {
    anamneseApi.getDocumento.mockResolvedValue({ envioAtivo: null });
    const { result, canal } = montar();
    await flush();
    expect(result.current.pedido).toBeNull();
    canal.emitirAviso(AVISO.ANAMNESE.ENVIO_ALTERADO, null);
    await avancar();
    expect(anamneseEnvioApi.status).not.toHaveBeenCalled();
  });

  it('busca o status ao abrir o pedido e não volta a consultar sem aviso', async () => {
    montar();
    await flush();
    expect(anamneseEnvioApi.status).toHaveBeenCalledWith('env1');
    await avancar(60_000);
    expect(anamneseEnvioApi.status).toHaveBeenCalledTimes(1);
  });

  it('aviso do envio com CONCLUIDO → onRespondido e limpa', async () => {
    const { result, canal, onRespondido, onEncerrado } = montar();
    await flush();
    anamneseEnvioApi.status.mockResolvedValue({ status: 'CONCLUIDO' });
    canal.emitirAviso(AVISO.ANAMNESE.ENVIO_ALTERADO, 'env1');
    await avancar();
    expect(anamneseEnvioApi.status).toHaveBeenCalledTimes(2);
    expect(onRespondido).toHaveBeenCalledTimes(1);
    expect(onEncerrado).not.toHaveBeenCalled();
    expect(result.current.pedido).toBeNull();
    canal.emitirAviso(AVISO.ANAMNESE.ENVIO_ALTERADO, 'env1');
    await avancar();
    expect(anamneseEnvioApi.status).toHaveBeenCalledTimes(2);
  });

  it.each(['CANCELADO', 'EXPIRADO'])('%s → onEncerrado e limpa', async (status) => {
    const { result, canal, onRespondido, onEncerrado } = montar();
    await flush();
    anamneseEnvioApi.status.mockResolvedValue({ status });
    canal.emitirAviso(AVISO.ANAMNESE.ENVIO_ALTERADO, null);
    await avancar();
    expect(onEncerrado).toHaveBeenCalledTimes(1);
    expect(onRespondido).not.toHaveBeenCalled();
    expect(result.current.pedido).toBeNull();
  });

  it('aviso de outro envio não consulta; recarregar consulta', async () => {
    const { canal } = montar();
    await flush();
    canal.emitirAviso(AVISO.ANAMNESE.ENVIO_ALTERADO, 'env-outro');
    await avancar(1000);
    expect(anamneseEnvioApi.status).toHaveBeenCalledTimes(1);
    canal.emitirRecarregar();
    await avancar();
    expect(anamneseEnvioApi.status).toHaveBeenCalledTimes(2);
  });

  it('PENDENTE continua aguardando novos avisos', async () => {
    const { canal } = montar();
    await flush();
    canal.emitirAviso(AVISO.ANAMNESE.ENVIO_ALTERADO, 'env1');
    await avancar();
    canal.emitirAviso(AVISO.ANAMNESE.ENVIO_ALTERADO, 'env1');
    await avancar();
    expect(anamneseEnvioApi.status).toHaveBeenCalledTimes(3);
  });

  it('vencido no cliente encerra sem chamar status', async () => {
    anamneseApi.getDocumento.mockResolvedValue({
      envioAtivo: { id: 'env1', status: 'PENDENTE', expiraEm: '2000-01-01T00:00:00Z' },
    });
    const { result, onEncerrado } = montar();
    await flush();
    await avancar(0);
    expect(anamneseEnvioApi.status).not.toHaveBeenCalled();
    expect(onEncerrado).toHaveBeenCalledTimes(1);
    expect(result.current.pedido).toBeNull();
  });

  it('no vencimento encerra sem chamar status de novo', async () => {
    vi.setSystemTime(new Date('2026-10-04T12:00:00Z'));
    anamneseApi.getDocumento.mockResolvedValue({
      envioAtivo: { id: 'env1', status: 'PENDENTE', expiraEm: '2026-10-04T12:10:00Z' },
    });
    const { result, onEncerrado } = montar();
    await flush();
    expect(anamneseEnvioApi.status).toHaveBeenCalledTimes(1);
    await avancar(10 * 60_000);
    expect(onEncerrado).toHaveBeenCalledTimes(1);
    expect(result.current.pedido).toBeNull();
    expect(anamneseEnvioApi.status).toHaveBeenCalledTimes(1);
  });

  it('cancelar confirma, chama a API, limpa e recarrega', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const { result, onEncerrado } = montar();
    await flush();
    await act(async () => { await result.current.cancelar(); });
    expect(anamneseEnvioApi.cancelar).toHaveBeenCalledWith('env1');
    expect(onEncerrado).toHaveBeenCalledTimes(1);
    expect(result.current.pedido).toBeNull();
  });

  it('cancelar sem confirmação não chama a API', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    const { result } = montar();
    await flush();
    await act(async () => { await result.current.cancelar(); });
    expect(anamneseEnvioApi.cancelar).not.toHaveBeenCalled();
    expect(result.current.pedido).not.toBeNull();
  });

  it('registrar mostra pedido otimista e null limpa', async () => {
    anamneseApi.getDocumento.mockResolvedValue({ envioAtivo: null });
    const { result, onEncerrado } = montar({ historicoPaciente: [] });
    await flush();
    act(() => result.current.registrar({ envioId: 'env9', preenchimentoAnamneseId: 'pre9' }));
    expect(result.current.pedido).toMatchObject({ envioId: 'env9', preenchimentoId: 'pre9' });
    expect(onEncerrado).toHaveBeenCalledTimes(1);
    act(() => result.current.registrar(null));
    expect(result.current.pedido).toBeNull();
    expect(onEncerrado).toHaveBeenCalledTimes(2);
  });

  it('desmontar para de ouvir avisos', async () => {
    const { unmount, canal } = montar();
    await flush();
    unmount();
    expect(canal.inscritos.size).toBe(0);
    await avancar(9000);
    expect(anamneseEnvioApi.status).toHaveBeenCalledTimes(1);
  });

  it('trocar de paciente limpa o pedido e ignora avisos do envio anterior', async () => {
    const { result, rerender, initialProps, canal } = montar();
    await flush();
    expect(result.current.pedido).not.toBeNull();
    rerender({ ...initialProps, pacienteId: 'pac2', historicoPaciente: [] });
    expect(result.current.pedido).toBeNull();
    canal.emitirAviso(AVISO.ANAMNESE.ENVIO_ALTERADO, 'env1');
    await avancar(9000);
    expect(anamneseEnvioApi.status).toHaveBeenCalledTimes(1);
  });

  it('sem envio conhecido, um aviso ANAMNESE (de qualquer registro) relê o pedido uma vez', async () => {
    anamneseApi.getDocumento.mockResolvedValueOnce({ envioAtivo: null });
    const { result, canal } = montar();
    await flush();
    expect(result.current.pedido).toBeNull();
    expect(anamneseApi.getDocumento).toHaveBeenCalledTimes(1);
    // Pedido feito em outro aparelho: o aviso chega com o id do envio que esta tela ainda não conhece.
    canal.emitirAviso(AVISO.ANAMNESE.ENVIO_ALTERADO, 'env1');
    canal.emitirAviso(AVISO.ANAMNESE.ENVIO_ALTERADO, 'env1');
    await avancar();
    expect(anamneseApi.getDocumento).toHaveBeenCalledTimes(2);
    expect(anamneseApi.getDocumento).toHaveBeenLastCalledWith('pac1', 'pre-branco');
    expect(result.current.pedido).toMatchObject({ envioId: 'env1', preenchimentoId: 'pre-branco' });
    expect(anamneseEnvioApi.status).toHaveBeenCalledWith('env1');
  });

  it('com envio conhecido, o aviso consulta o status e não relê o documento', async () => {
    const { canal } = montar();
    await flush();
    expect(anamneseApi.getDocumento).toHaveBeenCalledTimes(1);
    canal.emitirAviso(AVISO.ANAMNESE.ENVIO_ALTERADO, 'env1');
    await avancar();
    expect(anamneseEnvioApi.status).toHaveBeenCalledTimes(2);
    expect(anamneseApi.getDocumento).toHaveBeenCalledTimes(1);
  });

  it('ativo=false não chama nada', async () => {
    const { result, canal } = montar({ ativo: false });
    await flush();
    canal.emitirAviso(AVISO.ANAMNESE.ENVIO_ALTERADO, null);
    await avancar(9000);
    expect(result.current.pedido).toBeNull();
    expect(anamneseApi.getDocumento).not.toHaveBeenCalled();
    expect(anamneseEnvioApi.status).not.toHaveBeenCalled();
  });
});
