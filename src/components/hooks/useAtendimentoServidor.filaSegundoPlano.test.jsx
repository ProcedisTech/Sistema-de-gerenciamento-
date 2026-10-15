/**
 * Fila da consulta em segundo plano (decisão de 11/10): depois do F5 (ou de sair e entrar de novo com a mesma pessoa),
 * o que ficou guardado desta pessoa sai sozinho quando `minhas` carrega, sem entrar na consulta, sem buscar o detalhe
 * e sem abrir. Em segundo plano só saem `modulo` e `item`; `itemNovo` espera a pessoa entrar. Uma fila por consulta:
 * ao entrar, a tela usa a mesma (nada sai duas vezes). A fila de outra pessoa na mesma aba nunca é lida nem enviada.
 */
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
    substituirPeloPlano: vi.fn(),
    encerrar: vi.fn(),
  },
}));

const { atendimentosApi } = await import('../../services/api');

const PACIENTE = 'p-maria';
const USUARIO = 'u-1';
const OUTRA_PESSOA = 'u-2';
const fila = (userId) => `procedi_consulta_fila_${userId}_c-1`;

const ITEM_SERVIDOR = {
  id: 'item-1',
  ordem: 0,
  agendaId: null,
  nomeLivre: 'Botox',
  catalogoProcedimentoSaudeId: null,
  observacaoExecucao: 'a',
};
const ENVIO_ITEM = {
  chave: 'item:item-1:obs',
  grupo: 'item:item-1',
  tipo: 'item',
  dados: { itemId: 'item-1', campos: { observacaoExecucao: 'ab' } },
};
const ENVIO_ITEM_NOVO = {
  chave: 'item:novo:0',
  grupo: 'item:novo',
  tipo: 'itemNovo',
  dados: { indice: 0, corpo: { catalogoProcedimentoSaudeId: null, nomeLivre: 'Botox' } },
};

function dto(extras) {
  return { id: 'c-1', pacienteId: PACIENTE, status: 'aberto', modulo: 'hub', itens: [], ...extras };
}

const resumo = (extras) => ({ id: 'c-1', pacienteId: PACIENTE, status: 'aberto', ...extras });

async function assentar() {
  await act(async () => {
    for (let i = 0; i < 5; i += 1) await new Promise((r) => setTimeout(r, 0));
  });
}

async function esperar(ms) {
  await act(async () => {
    await new Promise((r) => setTimeout(r, ms));
  });
}

function montar(props) {
  const avisos = criarAvisosFalsos();
  const base = {
    habilitado: true,
    orgId: 'org-1',
    userId: USUARIO,
    emConsulta: false,
    pacienteId: null,
    procedimentosSessao: [],
    aparelho: { setProcedimentosSessao: vi.fn() },
    ...props,
  };
  const r = renderHook((p) => useAtendimentoServidor(p), { initialProps: base, wrapper: avisos.Wrapper });
  return { ...r, base };
}

describe('useAtendimentoServidor: fila em segundo plano', () => {
  beforeEach(() => {
    sessionStorage.clear();
    vi.mocked(atendimentosApi.minhas).mockResolvedValue([resumo()]);
    vi.mocked(atendimentosApi.alterarItem).mockResolvedValue({});
    vi.mocked(atendimentosApi.novoItem).mockResolvedValue({ ...ITEM_SERVIDOR, id: 'item-novo' });
  });
  afterEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
  });

  it('F5: o envio de texto guardado sai em segundo plano, sem entrar na consulta, sem detalhe e sem abrir', async () => {
    sessionStorage.setItem(fila(USUARIO), JSON.stringify([ENVIO_ITEM]));
    const { result } = montar();
    await assentar();
    await esperar(50);

    expect(atendimentosApi.alterarItem).toHaveBeenCalledTimes(1);
    expect(atendimentosApi.alterarItem).toHaveBeenCalledWith('c-1', 'item-1', { observacaoExecucao: 'ab' });
    expect(atendimentosApi.detalhe).not.toHaveBeenCalled();
    expect(atendimentosApi.abrir).not.toHaveBeenCalled();
    expect(result.current.atual).toBeNull();
    expect(sessionStorage.getItem(fila(USUARIO))).toBeNull();
  });

  it('consulta que não está aberta em "minhas" não ganha fila em segundo plano', async () => {
    vi.mocked(atendimentosApi.minhas).mockResolvedValue([resumo({ status: 'abandonado' })]);
    sessionStorage.setItem(fila(USUARIO), JSON.stringify([ENVIO_ITEM]));
    montar();
    await assentar();
    await esperar(50);

    expect(atendimentosApi.alterarItem).not.toHaveBeenCalled();
    expect(sessionStorage.getItem(fila(USUARIO))).not.toBeNull();
  });

  it('itemNovo guardado não sai em segundo plano; sai uma vez quando a pessoa entra na consulta', async () => {
    sessionStorage.setItem(fila(USUARIO), JSON.stringify([ENVIO_ITEM_NOVO]));
    const { result, rerender, base } = montar();
    await assentar();
    await esperar(900);

    expect(atendimentosApi.novoItem).not.toHaveBeenCalled();
    expect(sessionStorage.getItem(fila(USUARIO))).not.toBeNull();

    // Entra pela barra: adota o detalhe e a tela vai para a consulta (sessão hidratada).
    rerender({ ...base, emConsulta: true, pacienteId: PACIENTE, procedimentosSessao: [{ nomeProcedimento: 'Botox' }] });
    act(() => {
      result.current.adotar(dto());
    });
    await assentar();
    await esperar(900);
    await assentar();

    expect(atendimentosApi.novoItem).toHaveBeenCalledTimes(1);
    expect(atendimentosApi.novoItem).toHaveBeenCalledWith('c-1', { catalogoProcedimentoSaudeId: null, nomeLivre: 'Botox' });
    expect(sessionStorage.getItem(fila(USUARIO))).toBeNull();
  });

  it('entrar na consulta depois do F5 usa a mesma fila: o envio em andamento não sai de novo', async () => {
    let responder;
    vi.mocked(atendimentosApi.alterarItem).mockReturnValue(new Promise((r) => {
      responder = r;
    }));
    sessionStorage.setItem(fila(USUARIO), JSON.stringify([ENVIO_ITEM]));
    const { result, rerender, base } = montar();
    await assentar();
    await esperar(50);
    expect(atendimentosApi.alterarItem).toHaveBeenCalledTimes(1);

    rerender({ ...base, emConsulta: true, pacienteId: PACIENTE });
    act(() => {
      result.current.adotar(dto({ itens: [ITEM_SERVIDOR] }));
    });
    await assentar();
    await esperar(50);
    expect(atendimentosApi.alterarItem).toHaveBeenCalledTimes(1);

    await act(async () => {
      responder({});
    });
    await esperar(50);
    expect(atendimentosApi.alterarItem).toHaveBeenCalledTimes(1);
    expect(sessionStorage.getItem(fila(USUARIO))).toBeNull();
  });

  it('saída e login: a fila de quem saiu não é lida por outra pessoa na mesma aba; a mesma pessoa, ao voltar, envia', async () => {
    vi.mocked(atendimentosApi.minhas).mockResolvedValue([]);
    const sessao = [{ nomeProcedimento: 'Botox', observacoesExecucao: 'a' }];
    const { result, rerender, base } = montar({ emConsulta: true, pacienteId: PACIENTE, procedimentosSessao: sessao });
    await assentar();
    act(() => {
      result.current.adotar(dto({ itens: [ITEM_SERVIDOR] }));
    });
    await assentar();

    // Digita e sai antes de o envio sair (debounce de 700 ms).
    const digitado = [{ nomeProcedimento: 'Botox', observacoesExecucao: 'ab' }];
    rerender({ ...base, emConsulta: true, pacienteId: PACIENTE, procedimentosSessao: digitado });
    await assentar();
    rerender({ ...base, habilitado: false, orgId: null, userId: null, procedimentosSessao: [] });
    await esperar(900);
    expect(atendimentosApi.alterarItem).not.toHaveBeenCalled();
    expect(sessionStorage.getItem(fila(USUARIO))).not.toBeNull();

    // Outra pessoa entra na mesma aba.
    vi.mocked(atendimentosApi.minhas).mockResolvedValue([resumo()]);
    rerender({ ...base, userId: OUTRA_PESSOA });
    await assentar();
    await esperar(900);
    expect(atendimentosApi.alterarItem).not.toHaveBeenCalled();
    expect(sessionStorage.getItem(fila(USUARIO))).not.toBeNull();

    // A mesma pessoa volta: o envio sobe em segundo plano.
    rerender({ ...base, habilitado: false, orgId: null, userId: null });
    await assentar();
    rerender({ ...base, userId: USUARIO });
    await assentar();
    await esperar(50);
    expect(atendimentosApi.alterarItem).toHaveBeenCalledTimes(1);
    expect(atendimentosApi.alterarItem).toHaveBeenCalledWith('c-1', 'item-1', { observacaoExecucao: 'ab' });
    expect(atendimentosApi.detalhe).not.toHaveBeenCalled();
    expect(atendimentosApi.abrir).not.toHaveBeenCalled();
    expect(result.current.atual).toBeNull();
  });
});
