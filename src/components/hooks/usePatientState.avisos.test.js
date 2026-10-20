/**
 * Lista de pacientes ao vivo pelo canal de avisos (B-42, FB-front): aviso PACIENTE (criado/editado) → uma rebusca
 * silenciosa da página atual (mesmos filtros, ordenação e busca de texto), sem ligar o loading, sem limpar a tela e,
 * em erro, mantendo o que já estava. Não usa `bumpPatientList` (que liga o loading da lista, do KPI e do perfil).
 */
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { usePatientState } from './usePatientState.js';
import { criarAvisosFalsos } from '../../test/avisosFalsos.jsx';
import { AVISO } from '../../services/avisos/tiposAviso.js';

const state = vi.hoisted(() => ({
  list: vi.fn(),
  search: vi.fn(),
}));

vi.mock('../../contexts/OrgContext', () => ({
  useOrg: () => ({ fusoHorario: 'America/Sao_Paulo', recarregarContextoOrg: () => {} }),
}));
vi.mock('../../services/api', () => ({
  pacientesApi: {
    list: (...a) => state.list(...a),
    search: (...a) => state.search(...a),
  },
  patientListSortToApiParam: () => 'nome_asc',
}));

const passar = (ms) => act(async () => { await vi.advanceTimersByTimeAsync(ms); });

const pac = (id, nome) => ({ id, nomeCompleto: nome, cpf: `000000000${id.slice(-2)}`.slice(-11) });

const pagina = (itens, number = 0, totalElements = itens.length) => ({
  content: itens,
  first: number === 0,
  last: false,
  totalPages: 3,
  number,
  totalElements,
});

/** Monta o hook com o canal falso; registra todo `loading` e todo tamanho da lista vistos em cada render. */
async function montar() {
  const canal = criarAvisosFalsos();
  const loadings = [];
  const tamanhos = [];
  const utils = renderHook(
    () => {
      const r = usePatientState({ authEnabled: true });
      loadings.push(r.patientListLoading);
      tamanhos.push(r.patientListItems.length);
      return r;
    },
    { wrapper: canal.Wrapper },
  );
  await passar(1000);
  expect(utils.result.current.patientListLoading).toBe(false);
  return { ...utils, canal, loadings, tamanhos };
}

function limpar(m) {
  state.list.mockClear();
  state.search.mockClear();
  m.loadings.length = 0;
  m.tamanhos.length = 0;
}

describe('usePatientState · aviso PACIENTE rebusca a página atual em silêncio', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: false });
    vi.setSystemTime(new Date('2026-10-11T12:00:00Z'));
    sessionStorage.clear();
    state.list.mockReset();
    state.search.mockReset();
    state.list.mockImplementation(async (params) =>
      pagina([pac('p01', 'Ana'), pac('p02', 'Bia')], params?.page ?? 0, 42),
    );
    state.search.mockResolvedValue({ content: [] });
  });

  afterEach(() => {
    vi.useRealTimers();
    sessionStorage.clear();
  });

  it('PACIENTE.CRIADO → 1 rebusca da página atual após 400 ms (não em 399), nunca loading, nunca lista vazia', async () => {
    const m = await montar();
    // a pessoa está na página 2 (índice 1)
    act(() => m.result.current.setPatientListPage(1));
    await passar(100);
    expect(state.list).toHaveBeenLastCalledWith(expect.objectContaining({ page: 1, size: 20 }));
    expect(m.result.current.patientListItems.map((p) => p.nome)).toEqual(['Ana', 'Bia']);
    const bumpAntes = m.result.current.patientListBump;
    limpar(m);

    // no servidor nasceu um paciente que cai nesta página
    state.list.mockImplementation(async (params) =>
      pagina([pac('p01', 'Ana'), pac('p03', 'Bruna'), pac('p02', 'Bia')], params?.page ?? 0, 43),
    );
    m.canal.emitirAviso(AVISO.PACIENTE.CRIADO, 'p03');
    m.canal.emitirAviso(AVISO.PACIENTE.EDITADO, 'p01');
    await passar(399);
    expect(state.list).not.toHaveBeenCalled();
    await passar(1);
    expect(state.list).toHaveBeenCalledTimes(1);
    expect(state.list).toHaveBeenCalledWith(expect.objectContaining({ page: 1, size: 20 }));
    await passar(1000);
    expect(state.list).toHaveBeenCalledTimes(1);
    expect(state.search).not.toHaveBeenCalled();

    expect(m.loadings).not.toContain(true);
    expect(m.tamanhos).not.toContain(0);
    expect(m.result.current.patientListItems.map((p) => p.nome)).toEqual(['Ana', 'Bruna', 'Bia']);
    expect(m.result.current.patientListMeta.totalElements).toBe(43);
    expect(m.result.current.patientListPage).toBe(1);
    // não passou pelo bumpPatientList (que ligaria o loading do KPI e do perfil)
    expect(m.result.current.patientListBump).toBe(bumpAntes);
  });

  it('rebusca por aviso que falha mantém a página na tela, sem loading', async () => {
    const m = await montar();
    expect(m.result.current.patientListItems).toHaveLength(2);
    limpar(m);
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    state.list.mockRejectedValue(Object.assign(new Error('rede'), { status: 0 }));
    m.canal.emitirAviso(AVISO.PACIENTE.EDITADO, 'p01');
    await passar(1000);

    expect(state.list).toHaveBeenCalledTimes(1);
    expect(m.result.current.patientListItems.map((p) => p.nome)).toEqual(['Ana', 'Bia']);
    expect(m.result.current.patientListMeta.totalElements).toBe(42);
    expect(m.loadings).not.toContain(true);
    expect(m.tamanhos).not.toContain(0);
    warn.mockRestore();
  });

  it('com busca de texto, a rebusca usa search (com o mesmo termo), em silêncio', async () => {
    state.search.mockResolvedValue({ content: [pac('p01', 'Ana')] });
    const m = await montar();
    act(() => m.result.current.setPatientSearchQuery('An'));
    await passar(100);
    expect(m.result.current.patientListItems.map((p) => p.nome)).toEqual(['Ana']);
    limpar(m);

    state.search.mockResolvedValue({ content: [pac('p01', 'Ana'), pac('p04', 'Anita')] });
    m.canal.emitirAviso(AVISO.PACIENTE.CRIADO, 'p04');
    await passar(1000);

    expect(state.search).toHaveBeenCalledTimes(1);
    expect(state.search).toHaveBeenCalledWith('An');
    expect(state.list).not.toHaveBeenCalled();
    expect(m.result.current.patientListItems.map((p) => p.nome)).toEqual(['Ana', 'Anita']);
    expect(m.loadings).not.toContain(true);
    expect(m.tamanhos).not.toContain(0);
  });

  // T-FB-front: com busca de texto na 2ª página, o aviso encolhe o resultado para 1 página; o ajuste de página
  // (segunda busca) também tem de ser silencioso.
  it('busca de texto na 2ª página que encolhe pelo aviso: volta para a 1ª página sem ligar o loading (T-FB-front)', async () => {
    const muitos = (n) => Array.from({ length: n }, (_, i) => pac(`p${String(i + 10).padStart(2, '0')}`, `An ${String(i).padStart(2, '0')}`));
    state.search.mockResolvedValue({ content: muitos(25) });
    const m = await montar();
    act(() => m.result.current.setPatientSearchQuery('An'));
    await passar(100);
    act(() => m.result.current.setPatientListPage(1));
    await passar(100);
    expect(m.result.current.patientListPage).toBe(1);
    expect(m.result.current.patientListItems).toHaveLength(5);
    limpar(m);

    // no servidor, 5 pacientes deixaram de casar com o termo: o resultado cabe em 1 página
    state.search.mockResolvedValue({ content: muitos(20) });
    m.canal.emitirAviso(AVISO.PACIENTE.EDITADO, 'p10');
    await passar(1000);

    expect(state.search).toHaveBeenCalledTimes(2);
    expect(m.result.current.patientListPage).toBe(0);
    expect(m.result.current.patientListItems).toHaveLength(20);
    expect(m.loadings).not.toContain(true);
    expect(m.tamanhos).not.toContain(0);
  });

  // T-FB-front: a rebusca por aviso repete os filtros do servidor que estão ligados.
  it('rebusca por aviso mantém os filtros ligados (plano ativo, novos) e a ordenação (T-FB-front)', async () => {
    const m = await montar();
    act(() => {
      m.result.current.setStatusPlanoFilter('plano_ativo');
      m.result.current.setEhNovoFilter(true);
    });
    await passar(100);
    limpar(m);
    m.canal.emitirAviso(AVISO.PACIENTE.CRIADO, 'p09');
    await passar(1000);
    expect(state.list).toHaveBeenCalledTimes(1);
    expect(state.list).toHaveBeenCalledWith(expect.objectContaining({
      page: 0, statusPlano: 'plano_ativo', ehNovo: true, sort: 'nome_asc',
    }));
    expect(m.loadings).not.toContain(true);
  });

  it('aviso de outro módulo (AGENDA, ATENDIMENTO) não rebusca a lista', async () => {
    const m = await montar();
    limpar(m);
    m.canal.emitirAviso(AVISO.AGENDA.CRIADO, 'a1');
    m.canal.emitirAviso(AVISO.ATENDIMENTO.ENCERRADO, 'c1');
    await passar(2000);
    expect(state.list).not.toHaveBeenCalled();
    expect(state.search).not.toHaveBeenCalled();
    expect(m.loadings).not.toContain(true);
  });

  it('carga normal (bumpPatientList) continua ligando o loading — só a rebusca por aviso é silenciosa', async () => {
    const m = await montar();
    limpar(m);
    act(() => m.result.current.bumpPatientList());
    await passar(1000);
    expect(state.list).toHaveBeenCalledTimes(1);
    expect(m.loadings).toContain(true);
    expect(m.result.current.patientListLoading).toBe(false);
  });

  it('depois de uma rebusca silenciosa, a próxima carga normal (troca de página) volta a ligar o loading', async () => {
    const m = await montar();
    m.canal.emitirAviso(AVISO.PACIENTE.EDITADO, 'p01');
    await passar(1000);
    limpar(m);
    act(() => m.result.current.setPatientListPage(2));
    await passar(1000);
    expect(state.list).toHaveBeenCalledWith(expect.objectContaining({ page: 2 }));
    expect(m.loadings).toContain(true);
  });
});
