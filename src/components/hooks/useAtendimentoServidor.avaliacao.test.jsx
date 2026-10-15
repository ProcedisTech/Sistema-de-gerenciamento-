/**
 * F4: textos da avaliação no servidor pelo useAtendimentoServidor (opção `avaliacao`).
 * - sair do campo com valor diferente da base põe 1 PATCH na fila, sem espera, só com aquele campo;
 * - sair sem mudança e digitar sem sair não enviam nada;
 * - a resposta (detalhe) traz o `preenchimentoAnamneseId` e vira a nova base;
 * - a hidratação/releitura aplica o campo que não está pendente e mantém o pendente.
 */
import { useState } from 'react';
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { criarAvisosFalsos } from '../../test/avisosFalsos.jsx';
import { useAtendimentoServidor } from './useAtendimentoServidor.js';

vi.mock('../../services/api', () => ({
  atendimentosApi: {
    abrir: vi.fn(),
    minhas: vi.fn(),
    detalhe: vi.fn(),
    trocarModulo: vi.fn(),
    novoItem: vi.fn(),
    alterarItem: vi.fn(),
    alterarAvaliacaoTexto: vi.fn(),
    substituirPeloPlano: vi.fn(),
    encerrar: vi.fn(),
  },
}));

const { atendimentosApi } = await import('../../services/api');

const PACIENTE = 'p-maria';
const VAZIOS = { queixa: '', expectativas: '', observacoesAvaliacao: '' };

function dto(extras) {
  return {
    id: 'c-1',
    pacienteId: PACIENTE,
    status: 'aberto',
    modulo: 'hub',
    itens: [],
    queixa: null,
    expectativas: null,
    observacoesAvaliacao: null,
    preenchimentoAnamneseId: null,
    ...extras,
  };
}

async function esperar(ms) {
  await act(async () => {
    await new Promise((r) => setTimeout(r, ms));
  });
}

async function assentar() {
  await act(async () => {
    for (let i = 0; i < 5; i += 1) await new Promise((r) => setTimeout(r, 0));
  });
}

/** O App: os 3 textos no estado da tela (journeyState) e o setter que aplica os 3. */
function useTelaComAvaliacao({ comAvaliacao = true, ...props }) {
  const [valores, setValores] = useState(VAZIOS);
  const servidor = useAtendimentoServidor({
    ...props,
    avaliacao: comAvaliacao ? { valores, aplicar: setValores } : undefined,
  });
  return { servidor, valores, setValores };
}

async function montar({ inicial = dto(), comAvaliacao = true } = {}) {
  vi.mocked(atendimentosApi.abrir).mockResolvedValue(inicial);
  const avisos = criarAvisosFalsos();
  const props = {
    habilitado: true,
    orgId: 'org-1',
    userId: 'u-1',
    emConsulta: true,
    pacienteId: PACIENTE,
    procedimentosSessao: [],
    aparelho: { setProcedimentosSessao: vi.fn() },
    comAvaliacao,
  };
  const r = renderHook((p) => useTelaComAvaliacao(p), { initialProps: props, wrapper: avisos.Wrapper });
  await assentar();
  await act(async () => {
    await r.result.current.servidor.abrir({ pacienteId: PACIENTE });
  });
  await assentar();
  return { ...r, avisos };
}

function digitar(result, campo, valor) {
  act(() => result.current.setValores((v) => ({ ...v, [campo]: valor })));
}

function sair(result, campo) {
  let enfileirou;
  act(() => {
    enfileirou = result.current.servidor.onCampoAvaliacaoBlur(campo);
  });
  return enfileirou;
}

async function releitura(avisos) {
  act(() => avisos.emitirAviso('ATENDIMENTO.SESSAO_ALTERADA', 'c-1', { atendimentoId: 'c-1' }));
  await esperar(400);
  await assentar();
}

describe('useAtendimentoServidor: textos da avaliação (F4)', () => {
  beforeEach(() => {
    sessionStorage.clear();
    vi.mocked(atendimentosApi.minhas).mockResolvedValue([]);
  });
  afterEach(() => {
    vi.resetAllMocks();
  });

  it('a hidratação traz os textos do servidor para a tela e o preenchimentoAnamneseId', async () => {
    const { result } = await montar({
      inicial: dto({ queixa: 'Manchas', expectativas: null, observacoesAvaliacao: 'Pele fina', preenchimentoAnamneseId: 'pa-0' }),
    });
    expect(result.current.valores).toEqual({ queixa: 'Manchas', expectativas: '', observacoesAvaliacao: 'Pele fina' });
    expect(result.current.servidor.preenchimentoAnamneseId).toBe('pa-0');
  });

  it('sair do campo mudado enfileira 1 PATCH, sem espera, só com aquele campo (aparado)', async () => {
    vi.mocked(atendimentosApi.alterarAvaliacaoTexto).mockResolvedValue(dto({ queixa: 'Manchas no rosto' }));
    const { result } = await montar();

    digitar(result, 'queixa', '  Manchas no rosto ');
    digitar(result, 'expectativas', 'Clarear');
    expect(sair(result, 'queixa')).toBe(true);
    await esperar(20);
    await assentar();

    expect(atendimentosApi.alterarAvaliacaoTexto).toHaveBeenCalledTimes(1);
    expect(atendimentosApi.alterarAvaliacaoTexto).toHaveBeenCalledWith('c-1', { queixa: 'Manchas no rosto' });
  });

  it('sair do campo sem mudança não enfileira', async () => {
    const { result } = await montar({ inicial: dto({ expectativas: 'Clarear' }) });

    expect(sair(result, 'expectativas')).toBe(false);
    digitar(result, 'queixa', '   ');
    expect(sair(result, 'queixa')).toBe(false);
    await esperar(800);

    expect(atendimentosApi.alterarAvaliacaoTexto).not.toHaveBeenCalled();
  });

  it('digitar sem sair do campo não envia nada (nem depois do debounce dos textos)', async () => {
    const { result } = await montar();

    digitar(result, 'queixa', 'M');
    digitar(result, 'queixa', 'Ma');
    digitar(result, 'observacoesAvaliacao', 'Obs');
    await esperar(1000);

    expect(atendimentosApi.alterarAvaliacaoTexto).not.toHaveBeenCalled();
  });

  it('a resposta do PATCH atualiza o preenchimentoAnamneseId e vira a base (sair de novo sem mudar não reenvia)', async () => {
    vi.mocked(atendimentosApi.alterarAvaliacaoTexto).mockResolvedValue(
      dto({ queixa: 'Manchas', preenchimentoAnamneseId: '00000000-0000-0000-0000-0000000000a1' }),
    );
    const { result } = await montar();
    expect(result.current.servidor.preenchimentoAnamneseId).toBeNull();

    digitar(result, 'queixa', 'Manchas');
    sair(result, 'queixa');
    await esperar(20);
    await assentar();

    expect(result.current.servidor.preenchimentoAnamneseId).toBe('00000000-0000-0000-0000-0000000000a1');
    expect(result.current.servidor.atual?.queixa).toBe('Manchas');
    expect(sair(result, 'queixa')).toBe(false);
    expect(atendimentosApi.alterarAvaliacaoTexto).toHaveBeenCalledTimes(1);
  });

  it('a releitura aplica o campo não pendente e mantém o pendente', async () => {
    let liberar;
    vi.mocked(atendimentosApi.alterarAvaliacaoTexto).mockImplementation(
      () => new Promise((r) => {
        liberar = r;
      }),
    );
    const { result, avisos } = await montar({ inicial: dto({ queixa: 'A', expectativas: 'E0' }) });
    expect(result.current.valores.queixa).toBe('A');

    // A queixa sai, mas o PATCH fica no ar (pendente).
    digitar(result, 'queixa', 'Minha queixa');
    sair(result, 'queixa');
    await esperar(20);
    expect(atendimentosApi.alterarAvaliacaoTexto).toHaveBeenCalledTimes(1);

    // Outra aba mudou queixa e expectativas no servidor.
    vi.mocked(atendimentosApi.detalhe).mockResolvedValue(dto({ queixa: 'Da outra aba', expectativas: 'Nova expectativa' }));
    await releitura(avisos);

    expect(result.current.valores.queixa).toBe('Minha queixa');
    expect(result.current.valores.expectativas).toBe('Nova expectativa');

    await act(async () => {
      liberar(dto({ queixa: 'Minha queixa', expectativas: 'Nova expectativa' }));
    });
    await assentar();
  });

  it('a releitura não apaga o que a pessoa digita sem ter saído do campo quando o servidor não mudou esse campo', async () => {
    const { result, avisos } = await montar({ inicial: dto({ queixa: 'A' }) });

    digitar(result, 'queixa', 'A digitando');
    vi.mocked(atendimentosApi.detalhe).mockResolvedValue(dto({ queixa: 'A', observacoesAvaliacao: 'Obs de outra aba' }));
    await releitura(avisos);

    expect(result.current.valores).toEqual({ queixa: 'A digitando', expectativas: '', observacoesAvaliacao: 'Obs de outra aba' });
  });

  it('sem consulta acompanhada ou sem a opção avaliacao: onCampoAvaliacaoBlur devolve false e nada sai', async () => {
    const avisos = criarAvisosFalsos();
    const { result } = renderHook(
      () => useAtendimentoServidor({
        habilitado: true,
        orgId: 'org-1',
        userId: 'u-1',
        emConsulta: false,
        pacienteId: null,
        procedimentosSessao: [],
        aparelho: { setProcedimentosSessao: vi.fn() },
        avaliacao: { valores: { ...VAZIOS, queixa: 'x' }, aplicar: vi.fn() },
      }),
      { wrapper: avisos.Wrapper },
    );
    await assentar();
    expect(result.current.onCampoAvaliacaoBlur('queixa')).toBe(false);
    expect(result.current.preenchimentoAnamneseId).toBeNull();

    const sem = await montar({ comAvaliacao: false });
    expect(sair(sem.result, 'queixa')).toBe(false);
    await esperar(20);
    expect(atendimentosApi.alterarAvaliacaoTexto).not.toHaveBeenCalled();
  });

  it('o encerrar esvazia a fila com o PATCH da avaliação antes de chamar o servidor', async () => {
    const ordem = [];
    vi.mocked(atendimentosApi.alterarAvaliacaoTexto).mockImplementation(async (_id, campos) => {
      ordem.push(['avaliacao', campos]);
      return dto(campos);
    });
    vi.mocked(atendimentosApi.encerrar).mockImplementation(async () => {
      ordem.push(['encerrar']);
      return { atendimentoId: 'c-1', status: 'encerrado', procedimentos: [] };
    });
    const { result } = await montar();

    digitar(result, 'observacoesAvaliacao', 'Obs final');
    act(() => {
      result.current.servidor.onCampoAvaliacaoBlur('observacoesAvaliacao');
      result.current.servidor.encerrar({ modo: 'COMPLETO' });
    });
    await esperar(20);
    await assentar();

    expect(ordem).toEqual([['avaliacao', { observacoesAvaliacao: 'Obs final' }], ['encerrar']]);
  });
});
