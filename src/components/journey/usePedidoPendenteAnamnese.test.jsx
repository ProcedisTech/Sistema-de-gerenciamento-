import { act, renderHook } from '@testing-library/react';
import { usePedidoPendenteAnamnese } from './usePedidoPendenteAnamnese.js';

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
const avancar = (ms = 3000) => act(async () => { await vi.advanceTimersByTimeAsync(ms); });

function montar(props = {}) {
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
  const utils = renderHook((p) => usePedidoPendenteAnamnese(p), { initialProps });
  return { ...utils, onRespondido, onEncerrado, initialProps };
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

  it('documento sem envioAtivo → sem pedido e sem polling', async () => {
    anamneseApi.getDocumento.mockResolvedValue({ envioAtivo: null });
    const { result } = montar();
    await flush();
    expect(result.current.pedido).toBeNull();
    await avancar();
    expect(anamneseEnvioApi.status).not.toHaveBeenCalled();
  });

  it('CONCLUIDO → onRespondido e limpa', async () => {
    const { result, onRespondido, onEncerrado } = montar();
    await flush();
    anamneseEnvioApi.status.mockResolvedValue({ status: 'CONCLUIDO' });
    await avancar();
    expect(anamneseEnvioApi.status).toHaveBeenCalledWith('env1');
    expect(onRespondido).toHaveBeenCalledTimes(1);
    expect(onEncerrado).not.toHaveBeenCalled();
    expect(result.current.pedido).toBeNull();
    await avancar();
    expect(anamneseEnvioApi.status).toHaveBeenCalledTimes(1);
  });

  it.each(['CANCELADO', 'EXPIRADO'])('%s → onEncerrado e limpa', async (status) => {
    const { result, onRespondido, onEncerrado } = montar();
    await flush();
    anamneseEnvioApi.status.mockResolvedValue({ status });
    await avancar();
    expect(onEncerrado).toHaveBeenCalledTimes(1);
    expect(onRespondido).not.toHaveBeenCalled();
    expect(result.current.pedido).toBeNull();
  });

  it('PENDENTE continua consultando', async () => {
    montar();
    await flush();
    await avancar();
    await avancar();
    expect(anamneseEnvioApi.status).toHaveBeenCalledTimes(2);
  });

  it('vencido no cliente encerra sem chamar status', async () => {
    anamneseApi.getDocumento.mockResolvedValue({
      envioAtivo: { id: 'env1', status: 'PENDENTE', expiraEm: '2000-01-01T00:00:00Z' },
    });
    const { result, onEncerrado } = montar();
    await flush();
    await avancar();
    expect(anamneseEnvioApi.status).not.toHaveBeenCalled();
    expect(onEncerrado).toHaveBeenCalledTimes(1);
    expect(result.current.pedido).toBeNull();
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

  it('desmontar para o polling', async () => {
    const { unmount } = montar();
    await flush();
    unmount();
    await avancar(9000);
    expect(anamneseEnvioApi.status).not.toHaveBeenCalled();
  });

  it('trocar de paciente limpa o pedido e para o polling', async () => {
    const { result, rerender, initialProps } = montar();
    await flush();
    expect(result.current.pedido).not.toBeNull();
    rerender({ ...initialProps, pacienteId: 'pac2', historicoPaciente: [] });
    expect(result.current.pedido).toBeNull();
    await avancar(9000);
    expect(anamneseEnvioApi.status).not.toHaveBeenCalled();
  });

  it('ativo=false não chama nada', async () => {
    const { result } = montar({ ativo: false });
    await flush();
    await avancar(9000);
    expect(result.current.pedido).toBeNull();
    expect(anamneseApi.getDocumento).not.toHaveBeenCalled();
    expect(anamneseEnvioApi.status).not.toHaveBeenCalled();
  });
});
