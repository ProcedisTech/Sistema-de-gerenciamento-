/**
 * B-42 F3: Consulta, Avaliação e Retorno sem catálogo não ganham "conteúdo" sozinhos. A entrada pela agenda faz o
 * mesmo que o `entrarNaConsulta` (AppRefactored.jsx) com o estado real do aparelho (useJourneyState) e o espelho real
 * (useAtendimentoServidor): em 3 s de relógio falso, nenhum PATCH do item. Quando a pessoa muda o nome, o PATCH sai.
 */
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { criarAvisosFalsos } from '../../test/avisosFalsos.jsx';
import { marcarNomesDeTela } from '../consulta/consultaServidor.js';
import { useAtendimentoServidor } from './useAtendimentoServidor.js';
import { useJourneyState } from './useJourneyState.js';

vi.mock('../../services/api', () => ({
  atendimentosApi: {
    abrir: vi.fn(),
    minhas: vi.fn(),
    detalhe: vi.fn(),
    trocarModulo: vi.fn(),
    novoItem: vi.fn(),
    alterarItem: vi.fn(),
    substituirPeloPlano: vi.fn(),
    novaOrientacao: vi.fn(),
    alterarOrientacao: vi.fn(),
    removerOrientacao: vi.fn(),
    encerrar: vi.fn(),
  },
}));

vi.mock('./useFusoClinica', () => ({
  useFusoClinica: () => ({ fuso: 'America/Sao_Paulo', pronto: true, recarregarFuso: () => {} }),
}));

const { atendimentosApi } = await import('../../services/api');

const PACIENTE = 'p-maria';
const AGENDA = 'ag-1';

/** AtendimentoDTO do abrir: o item da agenda sem catálogo nasce sem nome (AtendimentoService.novoItemDaAgenda). */
function consultaComItemDaAgenda(codigo, nomeNaAgenda = null) {
  return {
    id: 'c-1',
    pacienteId: PACIENTE,
    status: 'aberto',
    modulo: 'hub',
    tipoProcedimentoCodigo: codigo,
    agendaPrincipalId: AGENDA,
    itens: [{
      id: 'item-1',
      ordem: 1,
      agendaId: AGENDA,
      agendaTipoProcedimentoCodigo: codigo,
      agendaProcedimentoFeitoOrigemId: null,
      catalogoProcedimentoSaudeId: null,
      procedimentoNome: null,
      planejamentoItemId: null,
      nomeLivre: null,
      observacaoExecucao: null,
      agendaCatalogoProcedimentoNome: nomeNaAgenda,
    }],
    fotos: [],
  };
}

function useAparelhoEServidor({ emConsulta }) {
  const journey = useJourneyState();
  const servidor = useAtendimentoServidor({
    habilitado: true,
    orgId: 'org-1',
    emConsulta,
    pacienteId: PACIENTE,
    procedimentosSessao: journey.procedimentosSessao,
    aparelho: journey,
  });
  return { journey, servidor };
}

async function passar(ms) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

/** Abre no servidor e entra pela agenda como o `entrarNaConsulta` (linha do lote copiada campo a campo). */
async function entrarPelaAgenda(codigo, rotulo, nomeNaAgenda = null) {
  vi.mocked(atendimentosApi.abrir).mockResolvedValue(consultaComItemDaAgenda(codigo, nomeNaAgenda));
  const avisos = criarAvisosFalsos();
  const r = renderHook((p) => useAparelhoEServidor(p), {
    initialProps: { emConsulta: false },
    wrapper: avisos.Wrapper,
  });
  await passar(0);
  await act(async () => {
    await r.result.current.servidor.abrir({ pacienteId: PACIENTE, agendaIds: [AGENDA], agendaClicadaId: AGENDA });
  });
  const lote = [{ agendaId: AGENDA, procedimentoNome: rotulo, catalogoProcedimentoSaudeId: '', planejamentoItemId: null }];
  act(() => {
    const j = r.result.current.journey;
    j.setProcedimentosSessao(lote);
    j.setActiveProcedureIndex(0);
    j.setNomeProcedimento('');
    j.setNomeProcedimentoCatalogoId(null);
  });
  act(() => {
    const j = r.result.current.journey;
    j.setNomeProcedimentoCatalogoId(null);
    j.setProcedimentosSessao(marcarNomesDeTela);
    j.setNomeProcedimento(rotulo, { manterMarca: true });
  });
  r.rerender({ emConsulta: true });
  await passar(0);
  return r;
}

describe('Consulta sem catálogo não ganha conteúdo sozinha (B-42 F3)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    sessionStorage.clear();
    vi.mocked(atendimentosApi.minhas).mockResolvedValue([]);
    vi.mocked(atendimentosApi.alterarItem).mockResolvedValue({});
    vi.mocked(atendimentosApi.novoItem).mockResolvedValue({ id: 'item-novo' });
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
    sessionStorage.clear();
  });

  it.each([
    ['CONSULTA', 'Consulta', null],
    ['avaliacao', 'Avaliação', null],
    ['retorno', 'Retorno', null],
    ['retorno', 'Retorno: Toxina botulínica', 'Toxina botulínica'],
  ])('%s sem catálogo: o rótulo "%s" continua na tela e 3 s depois não saiu nenhum PATCH', async (codigo, rotulo, nomeNaAgenda) => {
    const { result } = await entrarPelaAgenda(codigo, rotulo, nomeNaAgenda);

    await passar(3000);

    expect(result.current.journey.nomeProcedimento).toBe(rotulo);
    expect(result.current.journey.procedimentosSessao[0].nomeSoDeTela).toBe(true);
    expect(atendimentosApi.alterarItem).toHaveBeenCalledTimes(0);
    expect(atendimentosApi.novoItem).toHaveBeenCalledTimes(0);
  });

  it('controle: a pessoa troca o nome → a marca sai e o PATCH do nome vai depois do debounce', async () => {
    const { result } = await entrarPelaAgenda('CONSULTA', 'Consulta');
    await passar(3000);
    expect(atendimentosApi.alterarItem).toHaveBeenCalledTimes(0);

    act(() => {
      result.current.journey.setNomeProcedimento('Consulta de rotina');
    });
    await passar(3000);

    expect(result.current.journey.procedimentosSessao[0].nomeSoDeTela).toBe(false);
    expect(atendimentosApi.alterarItem).toHaveBeenCalledTimes(1);
    expect(atendimentosApi.alterarItem).toHaveBeenCalledWith('c-1', 'item-1', {
      catalogoProcedimentoSaudeId: null,
      nomeLivre: 'Consulta de rotina',
    });
  });

  it.each([
    ['CONSULTA', null, 'Consulta'],
    ['retorno', 'Toxina botulínica', 'Retorno: Toxina botulínica'],
  ])('F5 (%s): a sessão vazia hidratada do servidor mostra o mesmo rótulo e não manda PATCH', async (codigo, nomeNaAgenda, rotulo) => {
    const avisos = criarAvisosFalsos();
    const r = renderHook((p) => useAparelhoEServidor(p), {
      initialProps: { emConsulta: true },
      wrapper: avisos.Wrapper,
    });
    await passar(0);
    act(() => {
      r.result.current.servidor.adotar(consultaComItemDaAgenda(codigo, nomeNaAgenda));
    });
    await passar(3000);

    expect(r.result.current.journey.nomeProcedimento).toBe(rotulo);
    expect(r.result.current.journey.procedimentosSessao[0].nomeSoDeTela).toBe(true);
    expect(atendimentosApi.alterarItem).toHaveBeenCalledTimes(0);
    expect(atendimentosApi.novoItem).toHaveBeenCalledTimes(0);
  });
});
