/**
 * B-42 F3 (testador T3): a marca `nomeSoDeTela` só segura o rótulo da agenda. Quando a pessoa escolhe do catálogo
 * (setProcedimentoDoCatalogo, caminho do Step4LGPD/ConsultaProcedimentoFlow) ou troca o "Retorno: <nome>", o PATCH
 * volta a sair; apagar o nome não tira a marca nem manda nada.
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
    encerrar: vi.fn(),
  },
}));

vi.mock('./useFusoClinica', () => ({
  useFusoClinica: () => ({ fuso: 'America/Sao_Paulo', pronto: true, recarregarFuso: () => {} }),
}));

const { atendimentosApi } = await import('../../services/api');

const PACIENTE = 'p-maria';
const AGENDA = 'ag-1';
const CATALOGO = 'cat-toxina';

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

/** Mesma entrada do `entrarNaConsulta` (AppRefactored.jsx:1669-1755). */
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
  await passar(3000);
  expect(atendimentosApi.alterarItem).toHaveBeenCalledTimes(0);
  return r;
}

describe('marca nome só de tela: a escolha da pessoa volta a gravar (B-42 F3, T3)', () => {
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

  it('Consulta sem catálogo → escolhe do catálogo: a marca sai e o PATCH leva o catálogo', async () => {
    const { result } = await entrarPelaAgenda('CONSULTA', 'Consulta');

    act(() => {
      result.current.journey.setProcedimentoDoCatalogo('Toxina botulínica', CATALOGO);
    });
    await passar(3000);

    expect(result.current.journey.procedimentosSessao[0].nomeSoDeTela).toBe(false);
    expect(atendimentosApi.alterarItem).toHaveBeenCalledTimes(1);
    expect(atendimentosApi.alterarItem).toHaveBeenCalledWith('c-1', 'item-1', {
      catalogoProcedimentoSaudeId: CATALOGO,
      nomeLivre: null,
    });
    expect(atendimentosApi.novoItem).toHaveBeenCalledTimes(0);
  });

  it('"Retorno: <nome>" → a pessoa digita outro nome: a marca sai e o PATCH leva o nome', async () => {
    const { result } = await entrarPelaAgenda('retorno', 'Retorno: Toxina botulínica', 'Toxina botulínica');

    act(() => {
      result.current.journey.setNomeProcedimento('Retorno de toxina - retoque');
    });
    await passar(3000);

    expect(result.current.journey.procedimentosSessao[0].nomeSoDeTela).toBe(false);
    expect(atendimentosApi.alterarItem).toHaveBeenCalledWith('c-1', 'item-1', {
      catalogoProcedimentoSaudeId: null,
      nomeLivre: 'Retorno de toxina - retoque',
    });
  });

  it('apagar o nome não tira a marca e não manda nada (o servidor já está sem nome)', async () => {
    const { result } = await entrarPelaAgenda('avaliacao', 'Avaliação');

    act(() => {
      result.current.journey.setNomeProcedimento('');
    });
    await passar(3000);

    expect(result.current.journey.procedimentosSessao[0].nomeSoDeTela).toBe(true);
    expect(atendimentosApi.alterarItem).toHaveBeenCalledTimes(0);
    expect(atendimentosApi.novoItem).toHaveBeenCalledTimes(0);
  });
});
