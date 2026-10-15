import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { usePatientsKpi } from './usePatientsKpi.js';
import { criarAvisosFalsos } from '../../test/avisosFalsos.jsx';
import { AVISO } from '../../services/avisos/tiposAviso.js';

const state = vi.hoisted(() => ({
  byRange: vi.fn(),
  list: vi.fn(),
}));

vi.mock('../../contexts/OrgContext', () => ({
  useOrg: () => ({ fusoHorario: 'America/Sao_Paulo', recarregarContextoOrg: () => {} }),
}));
vi.mock('../../services/api', () => ({
  pacientesApi: { list: (...a) => state.list(...a) },
  agendasApi: { byRange: (...a) => state.byRange(...a) },
}));

const passar = (ms) => act(async () => { await vi.advanceTimersByTimeAsync(ms); });

const dto = (id, horaInicio, horaFim, extra = {}) => ({
  id,
  dataAgendamento: '2026-10-02',
  horaInicio: `${horaInicio}:00`,
  horaFim: `${horaFim}:00`,
  pacienteId: 'p1',
  pacienteNome: 'Maria Silva',
  profissionalRoleUserId: 'ru-a',
  catalogoProcedimentoNome: 'Botox',
  ...extra,
});

async function montarEstavel() {
  const canal = criarAvisosFalsos();
  /** todo valor de `loading` visto em cada render, a partir do momento em que limpamos. */
  const loadings = [];
  const utils = renderHook(
    () => {
      const r = usePatientsKpi({ authEnabled: true });
      loadings.push(r.loading);
      return r;
    },
    { wrapper: canal.Wrapper },
  );
  await passar(2000);
  expect(utils.result.current.loading).toBe(false);
  expect(state.byRange).toHaveBeenCalledTimes(1);
  state.byRange.mockClear();
  state.list.mockClear();
  loadings.length = 0;
  return { ...utils, canal, loadings };
}

describe('usePatientsKpi · agenda de hoje ao vivo pelo canal de avisos', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: false });
    vi.setSystemTime(new Date('2026-10-02T12:00:00Z'));
    state.list.mockReset();
    state.list.mockResolvedValue({ content: [], totalElements: 0 });
    state.byRange.mockReset();
    state.byRange.mockResolvedValue([dto('a1', '10:00', '10:30')]);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('AGENDA.STATUS_ALTERADO → busca completa (agenda de hoje + contadores) uma vez após 400 ms, sem loading=true', async () => {
    const { canal, result, loadings } = await montarEstavel();
    expect(result.current.entradasHoje).toHaveLength(1);

    // a agenda de hoje mudou no servidor: agora são duas encadeadas (1 card)
    state.byRange.mockResolvedValue([
      dto('a1', '10:00', '10:30'),
      dto('a2', '10:30', '11:00', { catalogoProcedimentoNome: 'Preenchimento Labial' }),
    ]);
    canal.emitirAviso(AVISO.AGENDA.STATUS_ALTERADO, 'a1');
    await passar(399);
    expect(state.byRange).not.toHaveBeenCalled();
    await passar(1);
    expect(state.byRange).toHaveBeenCalledTimes(1);
    expect(state.byRange).toHaveBeenCalledWith('2026-10-02', '2026-10-02', { excluirCancelado: true });
    await passar(1000);
    expect(state.byRange).toHaveBeenCalledTimes(1);
    // os contadores e listas também são rebuscados (as 8 consultas de pacientes da carga normal), uma vez
    expect(state.list).toHaveBeenCalledTimes(8);
    expect(loadings).not.toContain(true);
    expect(result.current.loading).toBe(false);
    expect(result.current.agendamentosHoje).toHaveLength(2);
    expect(result.current.entradasHoje).toHaveLength(1);
    expect(result.current.entradasHoje[0].kind).toBe('group');
  });

  it('carga inicial continua ligando o loading (só a rebusca por aviso é silenciosa)', async () => {
    const canal = criarAvisosFalsos();
    const loadings = [];
    renderHook(
      () => {
        const r = usePatientsKpi({ authEnabled: true });
        loadings.push(r.loading);
        return r;
      },
      { wrapper: canal.Wrapper },
    );
    await passar(2000);
    expect(loadings).toContain(true);
    expect(loadings[loadings.length - 1]).toBe(false);
  });

  it('aviso AGENDA atualiza os contadores sem apagar o valor anterior no meio (nada de null piscando)', async () => {
    state.list.mockImplementation(async (params) => {
      if (params?.semAgendamentoFuturo) return { content: [], totalElements: 2 };
      return { content: [], totalElements: 5 };
    });
    const canal = criarAvisosFalsos();
    const emRisco = [];
    const { result } = renderHook(
      () => {
        const r = usePatientsKpi({ authEnabled: true });
        emRisco.push(r.totalEmRisco);
        return r;
      },
      { wrapper: canal.Wrapper },
    );
    await passar(2000);
    expect(result.current.totalEmRisco).toBe(2);
    emRisco.length = 0;

    // a agenda de hoje mudou: um paciente em risco ganhou agendamento futuro
    state.list.mockImplementation(async (params) => {
      if (params?.semAgendamentoFuturo) return { content: [], totalElements: 1 };
      return { content: [], totalElements: 5 };
    });
    canal.emitirAviso(AVISO.AGENDA.CRIADO, 'a9');
    await passar(1000);
    expect(result.current.totalEmRisco).toBe(1);
    expect(emRisco).not.toContain(null);
    expect(result.current.loading).toBe(false);
  });

  it('rebusca por aviso que falha mantém contadores e agenda de hoje na tela', async () => {
    state.list.mockResolvedValue({ content: [], totalElements: 7 });
    const { canal, result, loadings } = await montarEstavel();
    expect(result.current.totalAtivos).toBe(7);
    expect(result.current.entradasHoje).toHaveLength(1);

    state.list.mockRejectedValue(new Error('rede'));
    state.byRange.mockRejectedValue(new Error('rede'));
    canal.emitirAviso(AVISO.AGENDA.ALTERADO, 'a1');
    await passar(1000);
    expect(state.byRange).toHaveBeenCalledTimes(1);
    expect(result.current.totalAtivos).toBe(7);
    expect(result.current.agendamentosHoje).toHaveLength(1);
    expect(result.current.entradasHoje).toHaveLength(1);
    expect(loadings).not.toContain(true);
  });

  it('resposta velha de uma rebusca por aviso é descartada quando uma mais nova já chegou', async () => {
    const { canal, result } = await montarEstavel();

    // 1º aviso: a busca fica pendurada (resposta velha, com 0 agendas e 10 ativos)
    let soltarVelha;
    const velha = new Promise((resolve) => { soltarVelha = resolve; });
    state.byRange.mockImplementationOnce(() => velha.then(() => []));
    state.list.mockImplementation(async () => {
      await velha;
      return { content: [], totalElements: 10 };
    });
    canal.emitirAviso(AVISO.AGENDA.CANCELADO, 'a1');
    await passar(500);
    expect(state.byRange).toHaveBeenCalledTimes(1);

    // 2º aviso: responde na hora (nova, com 2 agendas e 3 ativos)
    state.byRange.mockResolvedValueOnce([dto('a1', '10:00', '10:30'), dto('a3', '15:00', '15:30')]);
    state.list.mockResolvedValue({ content: [], totalElements: 3 });
    canal.emitirAviso(AVISO.AGENDA.CRIADO, 'a3');
    await passar(500);
    expect(state.byRange).toHaveBeenCalledTimes(2);
    expect(result.current.totalAtivos).toBe(3);
    expect(result.current.agendamentosHoje).toHaveLength(2);

    // a velha chega depois: não sobrescreve
    soltarVelha();
    await passar(100);
    expect(result.current.totalAtivos).toBe(3);
    expect(result.current.agendamentosHoje).toHaveLength(2);
  });

  it('PACIENTE.CRIADO → contadores e listas rebuscados 1 vez após 400 ms (não em 399), sem loading=true', async () => {
    state.list.mockResolvedValue({ content: [], totalElements: 10 });
    const { canal, result, loadings } = await montarEstavel();
    expect(result.current.totalAtivos).toBe(10);
    expect(result.current.totalNovos).toBe(10);

    // outra aba cadastrou um paciente: Todos ativos e Novos sobem 1. As respostas ficam em voo até soltarmos,
    // para a tela renderizar com a busca no meio (um loading ligado pela rebusca apareceria aqui).
    let soltar;
    const portao = new Promise((resolve) => { soltar = resolve; });
    state.list.mockImplementation(async () => {
      await portao;
      return { content: [], totalElements: 11 };
    });
    canal.emitirAviso(AVISO.PACIENTE.CRIADO, 'p-novo');
    canal.emitirAviso(AVISO.PACIENTE.EDITADO, 'p-novo');
    await passar(399);
    expect(state.list).not.toHaveBeenCalled();
    await passar(1);
    // as 8 consultas de pacientes da carga normal, uma vez só para os dois avisos juntos
    expect(state.list).toHaveBeenCalledTimes(8);
    await passar(100);
    expect(result.current.loading).toBe(false);
    expect(result.current.totalAtivos).toBe(10);
    soltar();
    await passar(1000);
    expect(state.list).toHaveBeenCalledTimes(8);
    expect(loadings).not.toContain(true);
    expect(result.current.loading).toBe(false);
    expect(result.current.totalAtivos).toBe(11);
    expect(result.current.totalNovos).toBe(11);
  });

  // T-FB-front: o teste de AGENDA acima não pega um loading que liga e desliga na mesma rebusca (as respostas
  // chegam na hora e o React junta as duas mudanças). Aqui as respostas ficam em voo até soltarmos.
  it('AGENDA com a busca em voo: o loading nunca liga (T-FB-front)', async () => {
    const { canal, result, loadings } = await montarEstavel();
    let soltar;
    const portao = new Promise((resolve) => { soltar = resolve; });
    state.byRange.mockImplementation(async () => {
      await portao;
      return [dto('a1', '10:00', '10:30')];
    });
    state.list.mockImplementation(async () => {
      await portao;
      return { content: [], totalElements: 0 };
    });
    canal.emitirAviso(AVISO.AGENDA.STATUS_ALTERADO, 'a1');
    await passar(500);
    expect(state.byRange).toHaveBeenCalledTimes(1);
    expect(result.current.loading).toBe(false);
    soltar();
    await passar(1000);
    expect(loadings).not.toContain(true);
    expect(result.current.loading).toBe(false);
  });

  // T-FB-front: aceite da decisão 2 — os cinco contadores e as duas listas da barra lateral, cada um com seu valor.
  it('PACIENTE.EDITADO atualiza Todos ativos, Sem agenda, Planos ativos, Novos, Aniversariantes e as listas da barra lateral (T-FB-front)', async () => {
    const respostas = (fase) => async (p) => {
      const n = fase === 'antes' ? 0 : 100;
      if (p?.semAgendamentoFuturo) return { content: [], totalElements: n + 2 };
      if (p?.statusPlano === 'plano_ativo') return { content: [], totalElements: n + 3 };
      if (p?.ehNovo) return { content: [], totalElements: n + 4 };
      if (p?.ehAniversarianteMes) return { content: [], totalElements: n + 5 };
      if (p?.order === 'birthday_asc') {
        return { content: [{ id: `ani-${fase}`, nomeCompleto: `Aniversariante ${fase}`, cpf: '11111111111' }], totalElements: 1 };
      }
      if (p?.statusPlano === 'sem_plano' && p?.size === 50) {
        return { content: [{ id: `sp-${fase}`, nomeCompleto: `Sem plano ${fase}`, cpf: '22222222222' }], totalElements: 1 };
      }
      if (p?.statusPlano === 'sem_plano') return { content: [], totalElements: n + 6 };
      return { content: [], totalElements: n + 1 };
    };
    state.list.mockImplementation(respostas('antes'));
    const { canal, result, loadings } = await montarEstavel();
    expect(result.current.totalAtivos).toBe(1);
    expect(result.current.aniversariantesList.map((p) => p.nome)).toEqual(['Aniversariante antes']);
    expect(result.current.semPlanoList.map((p) => p.nome)).toEqual(['Sem plano antes']);

    state.list.mockImplementation(respostas('depois'));
    canal.emitirAviso(AVISO.PACIENTE.EDITADO, 'p-x');
    await passar(1000);

    expect(result.current.totalAtivos).toBe(101);
    expect(result.current.totalEmRisco).toBe(102);
    expect(result.current.totalPlanosAtivos).toBe(103);
    expect(result.current.totalNovos).toBe(104);
    expect(result.current.totalAniversariantes).toBe(105);
    expect(result.current.totalSemPlano).toBe(106);
    expect(result.current.aniversariantesList.map((p) => p.nome)).toEqual(['Aniversariante depois']);
    expect(result.current.semPlanoList.map((p) => p.nome)).toEqual(['Sem plano depois']);
    expect(loadings).not.toContain(true);
  });

  // Item 5: AGENDA e PACIENTE escutam o mesmo `recarregar` do canal; só o de AGENDA rebusca (uma busca completa).
  it('recarregar do canal → 1 busca completa (8 list e 1 byRange), sem loading=true (item 5)', async () => {
    const { canal, loadings } = await montarEstavel();
    canal.emitirRecarregar();
    await passar(2000);
    expect(state.list).toHaveBeenCalledTimes(8);
    expect(state.byRange).toHaveBeenCalledTimes(1);
    expect(loadings).not.toContain(true);
  });

  it('depois de um recarregar, avisos PACIENTE e AGENDA continuam rebuscando 1 vez cada (item 5)', async () => {
    const { canal } = await montarEstavel();
    canal.emitirRecarregar();
    await passar(2000);
    state.list.mockClear();
    state.byRange.mockClear();

    canal.emitirAviso(AVISO.PACIENTE.CRIADO, 'p-1');
    await passar(1000);
    expect(state.list).toHaveBeenCalledTimes(8);
    expect(state.byRange).toHaveBeenCalledTimes(1);

    canal.emitirAviso(AVISO.AGENDA.CRIADO, 'a-1');
    await passar(1000);
    expect(state.list).toHaveBeenCalledTimes(16);
    expect(state.byRange).toHaveBeenCalledTimes(2);
  });

  // Testador item 5: bordas do debounce (cada useAviso tem seu próprio timer e guarda só a última mensagem).
  it('PACIENTE e depois recarregar (< 400 ms): 1 busca só, e ela traz o número novo do paciente (testador item 5)', async () => {
    state.list.mockResolvedValue({ content: [], totalElements: 10 });
    const { canal, result } = await montarEstavel();
    state.list.mockResolvedValue({ content: [], totalElements: 11 });
    canal.emitirAviso(AVISO.PACIENTE.CRIADO, 'p-novo');
    await passar(100);
    canal.emitirRecarregar();
    await passar(2000);
    expect(state.list).toHaveBeenCalledTimes(8);
    expect(state.byRange).toHaveBeenCalledTimes(1);
    // nada se perde: a busca do recarregar (via AGENDA) é a mesma busca completa que o PACIENTE faria
    expect(result.current.totalAtivos).toBe(11);
  });

  it('recarregar e depois PACIENTE (< 400 ms): 2 buscas completas (testador item 5)', async () => {
    const { canal } = await montarEstavel();
    canal.emitirRecarregar();
    await passar(100);
    canal.emitirAviso(AVISO.PACIENTE.CRIADO, 'p-novo');
    await passar(2000);
    expect(state.list).toHaveBeenCalledTimes(16);
    expect(state.byRange).toHaveBeenCalledTimes(2);
  });

  it('aviso AGENDA sozinho → exatamente 8 list + 1 byRange (testador item 5)', async () => {
    const { canal } = await montarEstavel();
    canal.emitirAviso(AVISO.AGENDA.CRIADO, 'a-1');
    await passar(2000);
    expect(state.list).toHaveBeenCalledTimes(8);
    expect(state.byRange).toHaveBeenCalledTimes(1);
  });

  it('aviso PACIENTE sozinho → exatamente 8 list + 1 byRange (testador item 5)', async () => {
    const { canal } = await montarEstavel();
    canal.emitirAviso(AVISO.PACIENTE.EDITADO, 'p-1');
    await passar(2000);
    expect(state.list).toHaveBeenCalledTimes(8);
    expect(state.byRange).toHaveBeenCalledTimes(1);
  });

  it('aviso de outro módulo (ANAMNESE) não recarrega a agenda de hoje', async () => {
    const { canal, loadings } = await montarEstavel();
    canal.emitirAviso(AVISO.ANAMNESE.ENVIO_ALTERADO, 'env-1');
    await passar(2000);
    expect(state.byRange).not.toHaveBeenCalled();
    expect(state.list).not.toHaveBeenCalled();
    expect(loadings).not.toContain(true);
  });
});
