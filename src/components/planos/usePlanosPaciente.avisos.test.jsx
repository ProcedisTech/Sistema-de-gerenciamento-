import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { criarAvisosFalsos } from '../../test/avisosFalsos.jsx';
import { AVISO } from '../../services/avisos/tiposAviso.js';
import { usePlanosPaciente } from './usePlanosPaciente.js';

vi.mock('../../services/api', () => ({
  planejamentosApi: { listarPorPaciente: vi.fn() },
  getApiErrorDetail: () => '',
}));

const { planejamentosApi } = await import('../../services/api');
const listar = planejamentosApi.listarPorPaciente;

const plano = (id, titulo) => ({ id, titulo, statusCodigo: 'ATIVO', itens: [] });
const A = [plano('plano-a', 'Plano A')];
const B = [plano('plano-b', 'Plano B')];

function adiado() {
  let resolver;
  let rejeitar;
  const promessa = new Promise((res, rej) => {
    resolver = res;
    rejeitar = rej;
  });
  return { promessa, resolver, rejeitar };
}

/** Espera o debounce (300 ms) do `useAviso` vencer e as promessas assentarem. */
async function esperar(ms = 400) {
  await act(async () => {
    await new Promise((r) => setTimeout(r, ms));
  });
}

function montar(props = {}, avisos = criarAvisosFalsos()) {
  const r = renderHook((p) => usePlanosPaciente(p), {
    initialProps: { pacienteId: 'p-1', ...props },
    wrapper: avisos.Wrapper,
  });
  return { avisos, ...r };
}

describe('usePlanosPaciente — releitura por aviso', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    listar.mockReset();
  });

  // F-e
  it('AGENDA.* relê 1x com o hook montado e nada depois do unmount', async () => {
    listar.mockResolvedValue(A);
    const { avisos, unmount } = montar();
    await esperar(20);
    expect(listar).toHaveBeenCalledTimes(1);

    avisos.emitirAviso(AVISO.AGENDA.REAGENDADO, 'agenda-9');
    await esperar();
    expect(listar).toHaveBeenCalledTimes(2);

    unmount();
    expect(avisos.inscritos.size).toBe(0);
    avisos.emitirAviso(AVISO.AGENDA.REAGENDADO, 'agenda-9');
    await esperar();
    expect(listar).toHaveBeenCalledTimes(2);
  });

  // F-e
  it('PLANEJAMENTO.ALTERADO relê só para o paciente certo', async () => {
    listar.mockResolvedValue(A);
    const { avisos } = montar();
    await esperar(20);
    expect(listar).toHaveBeenCalledTimes(1);

    avisos.emitirAviso(AVISO.PLANEJAMENTO.ALTERADO, 'p-outro');
    await esperar();
    expect(listar).toHaveBeenCalledTimes(1);

    avisos.emitirAviso(AVISO.PLANEJAMENTO.ALTERADO, 'p-1');
    await esperar();
    expect(listar).toHaveBeenCalledTimes(2);
  });

  // F-e
  it('recarregar sem chaveRebusca relê 1x', async () => {
    listar.mockResolvedValue(A);
    const { avisos } = montar();
    await esperar(20);
    expect(listar).toHaveBeenCalledTimes(1);

    avisos.emitirRecarregar();
    await esperar();
    expect(listar).toHaveBeenCalledTimes(2);
  });

  // F-e
  it('recarregar com chaveRebusca: o hook não relê sozinho; a troca da chave relê 1x', async () => {
    listar.mockResolvedValue(A);
    const { avisos, rerender } = montar({ chaveRebusca: 0 });
    await esperar(20);
    expect(listar).toHaveBeenCalledTimes(1);

    avisos.emitirRecarregar();
    await esperar();
    expect(listar).toHaveBeenCalledTimes(1);

    rerender({ pacienteId: 'p-1', chaveRebusca: 1 });
    await esperar(20);
    expect(listar).toHaveBeenCalledTimes(2);
  });

  // F-i
  it('releitura silenciosa que falha mantém a lista, sem erro', async () => {
    listar.mockResolvedValueOnce(A);
    const { avisos, result } = montar();
    await esperar(20);
    expect(result.current.planos).toHaveLength(1);
    expect(result.current.hasLoaded).toBe(true);

    listar.mockRejectedValueOnce(new Error('500'));
    avisos.emitirAviso(AVISO.PLANEJAMENTO.ALTERADO, 'p-1');
    await esperar();
    expect(listar).toHaveBeenCalledTimes(2);
    expect(result.current.planos.map((p) => p.id)).toEqual(['plano-a']);
    expect(result.current.error).toBe('');
    expect(result.current.loading).toBe(false);
  });

  // F-j
  it('a 1a releitura que responde depois da 2a não sobrescreve', async () => {
    listar.mockResolvedValueOnce([]);
    const { avisos, result } = montar();
    await esperar(20);

    const d1 = adiado();
    const d2 = adiado();
    listar.mockReturnValueOnce(d1.promessa).mockReturnValueOnce(d2.promessa);
    avisos.emitirAviso(AVISO.PLANEJAMENTO.ALTERADO, 'p-1');
    await esperar();
    avisos.emitirAviso(AVISO.PLANEJAMENTO.ALTERADO, 'p-1');
    await esperar();
    expect(listar).toHaveBeenCalledTimes(3);

    await act(async () => d2.resolver(B));
    await act(async () => d1.resolver(A));
    expect(result.current.planos.map((p) => p.id)).toEqual(['plano-b']);
  });

  // F-j
  it('troca de pacienteId no meio do pedido descarta a resposta do paciente antigo', async () => {
    const velho = adiado();
    listar.mockReturnValueOnce(velho.promessa).mockResolvedValueOnce(B);
    const { result, rerender } = montar();
    await esperar(20);

    rerender({ pacienteId: 'p-2' });
    await esperar(20);
    expect(result.current.planos.map((p) => p.id)).toEqual(['plano-b']);

    await act(async () => velho.resolver(A));
    expect(result.current.planos.map((p) => p.id)).toEqual(['plano-b']);
  });

  // F-j3
  it('carga inicial superada por releitura silenciosa: loading termina false e vale a releitura', async () => {
    const inicial = adiado();
    const releitura = adiado();
    listar.mockReturnValueOnce(inicial.promessa).mockReturnValueOnce(releitura.promessa);
    const { avisos, result } = montar();
    await esperar(20);
    expect(result.current.loading).toBe(true);

    avisos.emitirAviso(AVISO.PLANEJAMENTO.ALTERADO, 'p-1');
    await esperar();
    expect(listar).toHaveBeenCalledTimes(2);

    await act(async () => releitura.resolver(B));
    await act(async () => inicial.resolver(A));
    expect(result.current.loading).toBe(false);
    expect(result.current.hasLoaded).toBe(true);
    expect(result.current.planos.map((p) => p.id)).toEqual(['plano-b']);
  });
});
