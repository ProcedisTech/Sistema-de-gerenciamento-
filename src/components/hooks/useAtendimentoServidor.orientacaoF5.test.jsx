/**
 * F5b (orientações por item): a orientação vive em cada item da consulta no servidor (`itens[].orientacoes`) e volta
 * no F5 pela hidratação da linha (`orient`). Um `orientacoes` solto no topo do AtendimentoDTO (servidor de antes da
 * F6, lista única da consulta) é ignorado: não vira orientação de linha nenhuma e não chama rota.
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
const ITEM = {
  id: 'i-1',
  ordem: 0,
  agendaId: null,
  nomeLivre: 'Botox',
  catalogoProcedimentoSaudeId: null,
  observacaoExecucao: '',
  orientacoes: [{ descricao: 'Gelo por 10 min', checado: true, ordem: 0 }],
};

/** AtendimentoDTO de um servidor de antes da F6 (com `orientacoes` da consulta no topo) e um item com as suas. */
function dtoComOrientacoesAntigas() {
  return {
    id: 'c-1',
    pacienteId: PACIENTE,
    status: 'aberto',
    modulo: 'hub',
    itens: [ITEM],
    orientacoes: [
      { id: 'o-1', descricao: 'Evitar sol', checado: true, ordem: 0 },
      { id: 'o-2', descricao: 'Não deitar', checado: false, ordem: 1 },
    ],
  };
}

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

function montar() {
  const avisos = criarAvisosFalsos();
  const aparelho = { setProcedimentosSessao: vi.fn() };
  const base = {
    habilitado: true,
    orgId: 'org-1',
    userId: 'u-1',
    emConsulta: true,
    pacienteId: PACIENTE,
    procedimentosSessao: [],
    aparelho,
  };
  const r = renderHook((p) => useAtendimentoServidor(p), { initialProps: base, wrapper: avisos.Wrapper });
  return { ...r, base, aparelho };
}

describe('useAtendimentoServidor: orientação volta no F5 pela linha do item (F5b)', () => {
  beforeEach(() => {
    sessionStorage.clear();
    vi.mocked(atendimentosApi.minhas).mockResolvedValue([]);
    vi.mocked(atendimentosApi.detalhe).mockResolvedValue(dtoComOrientacoesAntigas());
  });
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('adotar a consulta (voltar pela barra depois do F5) hidrata `orient` da linha pelo item e ignora o `orientacoes` do topo', async () => {
    const { result, base, aparelho } = montar();
    await assentar();

    act(() => {
      result.current.adotar(dtoComOrientacoesAntigas());
    });
    await assentar();
    expect(result.current.atual?.id).toBe('c-1');

    const [sessao] = aparelho.setProcedimentosSessao.mock.calls.at(-1);
    expect(sessao).toHaveLength(1);
    expect(sessao[0]).toMatchObject({
      itemId: 'i-1',
      orient: [{ descricao: 'Gelo por 10 min', checado: true, ordem: 0 }],
    });
    // Nada da lista antiga do topo entrou na linha.
    expect(sessao[0].orient.some((o) => o.descricao === 'Evitar sol')).toBe(false);

    // Linha igual ao servidor: o espelho não tem o que enviar (nenhum PATCH, nada guardado para o próximo F5).
    base.procedimentosSessao = sessao;
    await esperar(800);
    await assentar();
    const outrasRotas = Object.entries(atendimentosApi)
      .filter(([nome]) => !['minhas', 'detalhe'].includes(nome))
      .filter(([, fn]) => fn.mock.calls.length > 0)
      .map(([nome]) => nome);
    expect(outrasRotas).toEqual([]);
    expect(sessionStorage.getItem('procedi_consulta_fila_u-1_c-1')).toBeNull();
  });
});
