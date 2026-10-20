import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAgendaPage } from './useAgendaPage';
import { criarAvisosFalsos } from '../../test/avisosFalsos.jsx';
import { AVISO } from '../../services/avisos/tiposAviso.js';
import { mapAgendaDtoToDashboardRow } from '../../utils/agendaDashboardMapping';

const state = vi.hoisted(() => ({
  org: { orgId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', roleUserId: '', roleNome: '', apareceNaAgenda: false, fusoHorario: 'America/Sao_Paulo' },
  apiResult: vi.fn().mockResolvedValue([]),
  byRange: vi.fn(),
  buscarFaixa: vi.fn(),
  buscarFaixaReal: null,
}));

vi.mock('../../contexts/OrgContext', () => ({ useOrg: () => state.org }));
vi.mock('../../contexts/useDisponibilidadeRevision.js', () => ({ useDisponibilidadeRevision: () => ({ bumpRevision: vi.fn() }) }));
vi.mock('../../contexts/useToast.js', () => ({ useToast: () => ({ success: vi.fn(), error: vi.fn() }) }));
vi.mock('../../hooks/usePapel', () => ({ usePapel: () => ({ isNivel1: false, canSeeAgendaMulti: true, canSeeAgendaPropria: true, canEncaixarForaDisp: false, canDeleteAgenda: false, canAparecerNaAgenda: false }) }));
vi.mock('../../hooks/useProcedimentosOptions', () => ({ useProcedimentosOptions: () => ({ options: [] }) }));
vi.mock('./ConfirmacaoForaDispModal', () => ({ useConfirmacaoForaDisp: () => ({ modal: null, abrirConfirmacao: vi.fn() }) }));
vi.mock('../../services/api', () => {
  const service = new Proxy({}, { get: () => state.apiResult });
  const agendas = new Proxy({}, { get: (_, prop) => (prop === 'byRange' ? state.byRange : state.apiResult) });
  return ({
    agendasApi: agendas, anamneseApi: service, catalogosApi: service, confirmacaoApi: service,
    disponibilidadeApi: service, equipeApi: { list: vi.fn().mockResolvedValue([]) },
    getApiErrorToastMessage: () => 'Erro', isAbortError: () => false,
    organizacoesHorariosApi: service, pacientesApi: service, planejamentosApi: service, procedimentosApi: service,
  });
});
vi.mock('../../utils/agendaDashboardMapping', async (importOriginal) => {
  const real = await importOriginal();
  state.buscarFaixaReal = real.fetchDashboardAppointmentsForRange;
  return { ...real, fetchDashboardAppointmentsForRange: (...args) => state.buscarFaixa(...args) };
});

const passar = (ms) => act(async () => { await vi.advanceTimersByTimeAsync(ms); });

function adiada() {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

const linha = (id) => mapAgendaDtoToDashboardRow({ id, dataAgendamento: '2026-10-20', horaInicio: '09:00:00', horaFim: '10:00:00' });

/** Nenhum `loading` / `*Loading` do hook ligado. */
function flagsDeCarregamentoLigadas(hook) {
  return Object.entries(hook).filter(([k, v]) => /(^l|L)oading$/.test(k) && v === true).map(([k]) => k);
}

async function montarEstavel() {
  const canal = criarAvisosFalsos();
  const utils = renderHook(() => useAgendaPage({ authEnabled: true }), { wrapper: canal.Wrapper });
  await passar(2000);
  state.apiResult.mockClear();
  return { ...utils, canal };
}

describe('agenda ao vivo pelo canal de avisos', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: false });
    state.apiResult.mockReset();
    state.apiResult.mockResolvedValue([]);
    state.byRange.mockReset();
    state.byRange.mockImplementation((...args) => state.apiResult(...args));
    state.buscarFaixa.mockReset();
    state.buscarFaixa.mockImplementation((...args) => state.buscarFaixaReal(...args));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('rajada de avisos AGENDA dentro de 400 ms recarrega o painel uma vez', async () => {
    const { canal } = await montarEstavel();
    canal.emitirAviso(AVISO.AGENDA.CRIADO, 'ag-1');
    await passar(399);
    expect(state.apiResult).not.toHaveBeenCalled();
    await passar(1);
    const porRecarga = state.apiResult.mock.calls.length;
    expect(porRecarga).toBeGreaterThan(0);

    state.apiResult.mockClear();
    for (let i = 0; i < 8; i += 1) {
      canal.emitirAviso(AVISO.AGENDA.STATUS_ALTERADO, `ag-${i}`);
      await passar(40);
    }
    expect(state.apiResult).not.toHaveBeenCalled();
    await passar(400);
    expect(state.apiResult).toHaveBeenCalledTimes(porRecarga);
  });

  it('aviso de outro módulo não recarrega a agenda; recarregar do canal recarrega', async () => {
    const { canal } = await montarEstavel();
    canal.emitirAviso(AVISO.ANAMNESE.ENVIO_ALTERADO, 'env-1');
    await passar(1000);
    expect(state.apiResult).not.toHaveBeenCalled();
    canal.emitirRecarregar();
    await passar(400);
    expect(state.apiResult).toHaveBeenCalled();
  });

  describe('recarga silenciosa', () => {
    /** Mês fora de hoje (contagem de hoje vem da busca própria) e grade semanal aberta, tudo com dados. */
    async function montarComDados() {
      state.buscarFaixa.mockResolvedValue([linha('a1')]);
      state.byRange.mockResolvedValue([{ id: 'h1' }, { id: 'h2' }]);
      const montado = await montarEstavel();
      const { result } = montado;
      act(() => result.current.goNextMonth());
      await passar(1000);
      act(() => result.current.setViewMode('semana'));
      await passar(1000);
      expect(result.current.appointments).toHaveLength(1);
      expect(result.current.weekGridAppointments).toHaveLength(1);
      expect(result.current.stats.hoje).toBe(2);
      expect(result.current.loading).toBe(false);
      state.buscarFaixa.mockClear();
      state.byRange.mockClear();
      return montado;
    }

    it('aviso de agenda não mostra carregamento e troca os dados quando chegam', async () => {
      const { result, canal } = await montarComDados();
      const busca = adiada();
      state.buscarFaixa.mockImplementation(() => busca.promise);
      const hoje = adiada();
      state.byRange.mockImplementation(() => hoje.promise);

      canal.emitirAviso(AVISO.AGENDA.CRIADO, 'ag-1');
      await passar(400);
      expect(state.buscarFaixa).toHaveBeenCalled();
      expect(flagsDeCarregamentoLigadas(result.current)).toEqual([]);
      expect(result.current.appointments).toHaveLength(1);
      expect(result.current.weekGridAppointments).toHaveLength(1);
      expect(result.current.stats.hoje).toBe(2);

      await act(async () => { busca.resolve([linha('a1'), linha('a2')]); });
      await passar(0);
      expect(flagsDeCarregamentoLigadas(result.current)).toEqual([]);
      expect(result.current.stats.hoje).toBe(2);

      await act(async () => { hoje.resolve([{ id: 'h1' }, { id: 'h2' }, { id: 'h3' }]); });
      await passar(0);
      expect(result.current.appointments).toHaveLength(2);
      expect(result.current.weekGridAppointments).toHaveLength(2);
      expect(result.current.stats.hoje).toBe(3);
      expect(result.current.loading).toBe(false);
    });

    it('recarregar do canal também é silencioso', async () => {
      const { result, canal } = await montarComDados();
      const busca = adiada();
      state.buscarFaixa.mockImplementation(() => busca.promise);

      canal.emitirRecarregar();
      await passar(400);
      expect(state.buscarFaixa).toHaveBeenCalled();
      expect(result.current.loading).toBe(false);
      expect(result.current.appointments).toHaveLength(1);

      await act(async () => { busca.resolve([linha('a1'), linha('a2')]); });
      await passar(0);
      expect(result.current.appointments).toHaveLength(2);
      expect(result.current.loading).toBe(false);
    });

    it('erro na recarga silenciosa mantém os dados da tela', async () => {
      const { result, canal } = await montarComDados();
      state.buscarFaixa.mockRejectedValue(new Error('rede'));
      state.byRange.mockRejectedValue(new Error('rede'));

      canal.emitirAviso(AVISO.AGENDA.ALTERADO, null);
      await passar(1000);

      expect(state.buscarFaixa).toHaveBeenCalled();
      expect(state.byRange).toHaveBeenCalled();
      expect(result.current.appointments).toHaveLength(1);
      expect(result.current.weekGridAppointments).toHaveLength(1);
      expect(result.current.stats.hoje).toBe(2);
      expect(result.current.error).toBe('');
      expect(result.current.loading).toBe(false);
    });

    it('navegação de mês continua mostrando o loading', async () => {
      const { result } = await montarEstavel();
      const busca = adiada();
      state.buscarFaixa.mockImplementation(() => busca.promise);

      act(() => result.current.goNextMonth());
      await passar(0);
      expect(result.current.loading).toBe(true);

      await act(async () => { busca.resolve([linha('a1')]); });
      await passar(0);
      expect(result.current.loading).toBe(false);
      expect(result.current.appointments).toHaveLength(1);
    });
  });
});
