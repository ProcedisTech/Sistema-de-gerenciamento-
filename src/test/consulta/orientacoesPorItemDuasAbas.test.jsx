/**
 * F5b (orientações por item) no molde de duas abas (nível hook, `moldeDuasAbas.test.jsx`): duas instâncias de
 * `useAtendimentoServidor`, cada uma com o seu storage, sobre UM servidor falso com estado compartilhado e o canal
 * de avisos falso.
 * (a) marcar orientação no item 2 na aba A → PATCH /itens/{id2} com `checado: true` sem debounce;
 * (b) o servidor muda `itens[0].orientacoes` + aviso → a aba B tem `orient` novo em até 3 s;
 * (c) o servidor tira o item 2 + aviso → a linha 2 some na B; a linha local sem itemId fica;
 * (d) o servidor manda `observacaoExecucao: ''` + aviso → observação vazia na B e NENHUM PATCH-eco com o texto antigo;
 * (e) F5 (nova instância com o mesmo storage, molde de `filaDepoisDoF5.test.jsx`) → a orientação marcada continua;
 * (f) o corpo do encerrar não leva `orientacoes`.
 */
import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAtendimentoServidor } from '../../components/hooks/useAtendimentoServidor.js';
import { PERMISSOES } from '../../constants/permissoes.js';
import { setOrgId } from '../../services/api';
import { avisos } from './canalAvisosTeste.jsx';
import { IDS } from '../encerrar/cenariosEncerrar.js';
import { criarServidorEncerrarFalso, ORG_ID, ROLE_USER_ID, storageFalso } from '../encerrar/servidorEncerrarFalso.js';

vi.mock('../../lib/supabaseClient.js', async () => (await import('../encerrar/servidorEncerrarFalso.js')).supabaseFalso());

const USUARIO = 'usr-1';
const ATENDIMENTO_ID = 'c0000000-0000-4000-8000-0000000000aa';
const ITEM_1 = 'i0000000-0000-4000-8000-000000000001';
const ITEM_2 = 'i0000000-0000-4000-8000-000000000002';
const PATCH_ITEM_2 = `/api/v1/atendimentos/${ATENDIMENTO_ID}/itens/${ITEM_2}`;
const ENCERRAR = `/api/v1/atendimentos/${ATENDIMENTO_ID}/encerrar`;

const EVITAR_SOL = { descricao: 'Evitar sol', checado: false, ordem: 0 };
const NAO_DEITAR = { descricao: 'Não deitar', checado: false, ordem: 1 };

function consultaDto(extras = {}) {
  return {
    id: ATENDIMENTO_ID,
    pacienteId: IDS.PACIENTE,
    pacienteNome: 'Maria Souza',
    anfitriaoRoleUserId: ROLE_USER_ID,
    status: 'aberto',
    modulo: 'hub',
    tipoProcedimentoCodigo: 'CONSULTA',
    iniciadoEm: '2026-10-06T12:30:00Z',
    itens: [],
    fotos: [],
    consultaAnteriorFechada: null,
    fechadaPor: null,
    ...extras,
  };
}
const itemDto = (id, ordem, extras = {}) => ({
  id,
  ordem,
  agendaId: null,
  nomeLivre: null,
  catalogoProcedimentoSaudeId: null,
  observacaoExecucao: '',
  orientacoes: null,
  ...extras,
});
const itensIniciais = () => [
  itemDto(ITEM_1, 0, { nomeLivre: 'Botox', observacaoExecucao: 'aplicado 20U', orientacoes: [EVITAR_SOL, NAO_DEITAR] }),
  itemDto(ITEM_2, 1, { catalogoProcedimentoSaudeId: IDS.CATALOGO_2, procedimentoNome: 'Preenchimento', orientacoes: [EVITAR_SOL] }),
];
const resumoDto = (dto) => ({
  id: dto.id,
  pacienteId: dto.pacienteId,
  pacienteNome: dto.pacienteNome,
  status: dto.status,
  modulo: dto.modulo,
  tipoProcedimentoCodigo: dto.tipoProcedimentoCodigo,
  iniciadoEm: dto.iniciadoEm,
});

async function assentar() {
  await act(async () => {
    for (let i = 0; i < 5; i += 1) await new Promise((r) => setTimeout(r, 0));
  });
}

/** Uma "aba": hook com storage próprio; o `aparelho` falso faz a sessão nova virar a prop `procedimentosSessao`. */
function montarAba(nome, procedimentosSessao, { storage = storageFalso(), emConsulta = true } = {}) {
  const base = {
    habilitado: true,
    orgId: ORG_ID,
    userId: USUARIO,
    emConsulta,
    pacienteId: IDS.PACIENTE,
    procedimentosSessao,
    aparelho: null,
    storage,
    idDaAba: () => `aba-${nome}`,
    raizDeFoco: document.createElement('div'),
  };
  const aba = { base };
  const aparelho = {
    setProcedimentosSessao: vi.fn((sessao) => {
      base.procedimentosSessao = sessao;
      queueMicrotask(() => aba.rerender({ ...base }));
    }),
  };
  base.aparelho = aparelho;
  const r = renderHook((p) => useAtendimentoServidor(p), { initialProps: base, wrapper: avisos.Wrapper });
  Object.assign(aba, r, { aparelho });
  /** A pessoa mexeu na linha `indice` desta aba (como o `updateProcedureByIndex` do estado faria). */
  aba.mudarLinha = (indice, patch) => {
    base.procedimentosSessao = base.procedimentosSessao.map((l, i) => (i === indice ? { ...l, ...patch } : l));
    aba.rerender({ ...base });
  };
  aba.sessao = () => aba.base.procedimentosSessao;
  return aba;
}

const patchesDe = (srv, path) => srv.escritasConsulta.filter((e) => e.method === 'PATCH' && e.path === path);

describe('orientações por item em duas abas (F5b)', () => {
  let srv;
  let estado;

  beforeEach(() => {
    sessionStorage.clear();
    estado = { dto: consultaDto({ itens: itensIniciais() }) };
    srv = criarServidorEncerrarFalso({
      permissoes: Object.values(PERMISSOES),
      estado,
      rotas: [
        ['GET', /^\/api\/v1\/atendimentos\/minhas$/, () => (estado.dto ? [resumoDto(estado.dto)] : [])],
        ['POST', new RegExp(`^${ENCERRAR}$`), () => ({
          atendimentoId: ATENDIMENTO_ID,
          status: 'encerrado',
          encerradoEm: '2026-10-06T13:10:00Z',
          procedimentos: [],
          orientacoes: [],
        })],
      ],
    });
    vi.stubGlobal('fetch', srv.fetchFalso);
    setOrgId(ORG_ID);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    setOrgId(null);
  });

  /** As duas abas entram na consulta com a sessão vazia: a hidratação monta as linhas pelos itens do servidor. */
  async function duasAbas() {
    const abaA = montarAba('A', []);
    const abaB = montarAba('B', []);
    await assentar();
    act(() => {
      abaA.result.current.adotar(estado.dto);
      abaB.result.current.adotar(estado.dto);
    });
    await assentar();
    expect(abaA.sessao().map((l) => l.itemId)).toEqual([ITEM_1, ITEM_2]);
    expect(abaB.sessao().map((l) => l.itemId)).toEqual([ITEM_1, ITEM_2]);
    return { abaA, abaB };
  }

  it('(a) marcar uma orientação do item 2 na aba A sai no PATCH do item 2 sem debounce, com a lista inteira', async () => {
    const { abaA } = await duasAbas();
    const inicio = Date.now();
    abaA.mudarLinha(1, { orient: [{ ...EVITAR_SOL, checado: true }] });
    await waitFor(() => {
      expect(patchesDe(srv, PATCH_ITEM_2)).toHaveLength(1);
    }, { timeout: 3000 });
    const [patch] = patchesDe(srv, PATCH_ITEM_2);
    expect(patch.body).toEqual({ orientacoes: [{ descricao: 'Evitar sol', checado: true, ordem: 0 }] });
    // Sem debounce (700 ms): a caixa marcada vai na hora.
    expect(Date.now() - inicio).toBeLessThan(600);
    expect(estado.dto.itens[1].orientacoes).toEqual([{ descricao: 'Evitar sol', checado: true, ordem: 0 }]);
    expect(abaA.base.storage.length).toBe(0);
  });

  it('(b) o servidor muda as orientações do item 1 e o aviso faz a aba B ver o orient novo em até 3 s', async () => {
    const { abaB } = await duasAbas();
    const nova = [{ ...EVITAR_SOL, checado: true }, NAO_DEITAR, { descricao: 'Gelo por 10 min', checado: false, ordem: 2 }];
    estado.dto = { ...estado.dto, itens: estado.dto.itens.map((i, k) => (k === 0 ? { ...i, orientacoes: nova } : i)) };
    avisos.emitirAviso('ATENDIMENTO.SESSAO_ALTERADA', ATENDIMENTO_ID, { atendimentoId: ATENDIMENTO_ID });

    await waitFor(() => {
      expect(abaB.sessao()[0].orient).toEqual(nova);
    }, { timeout: 3000 });
    await assentar();
    // A aba B só leu: nenhum PATCH devolvendo a lista.
    expect(srv.escritasConsulta.filter((e) => e.method === 'PATCH')).toHaveLength(0);
  });

  it('(c) o servidor tira o item 2 e o aviso faz a linha 2 sumir na B; a linha local sem itemId fica', async () => {
    const { abaB } = await duasAbas();
    // Linha local da B ainda sem item no servidor (sem nome: o espelho não cria nada).
    abaB.mudarLinha(1, {});
    abaB.base.procedimentosSessao = [...abaB.base.procedimentosSessao, { observacoesExecucao: '', orient: null }];
    abaB.rerender({ ...abaB.base });
    await assentar();
    expect(abaB.sessao()).toHaveLength(3);

    estado.dto = { ...estado.dto, itens: [estado.dto.itens[0]] };
    avisos.emitirAviso('ATENDIMENTO.SESSAO_ALTERADA', ATENDIMENTO_ID, { atendimentoId: ATENDIMENTO_ID });

    await waitFor(() => {
      expect(abaB.sessao().map((l) => l.itemId ?? null)).toEqual([ITEM_1, null]);
    }, { timeout: 3000 });
    await assentar();
    expect(srv.escritasConsulta.filter((e) => e.method !== 'GET')).toHaveLength(0);
  });

  it('(d) o servidor manda a observação vazia e o aviso a aplica na B, sem PATCH-eco com o texto antigo', async () => {
    const { abaB } = await duasAbas();
    expect(abaB.sessao()[0].observacoesExecucao).toBe('aplicado 20U');
    estado.dto = { ...estado.dto, itens: estado.dto.itens.map((i, k) => (k === 0 ? { ...i, observacaoExecucao: '' } : i)) };
    avisos.emitirAviso('ATENDIMENTO.SESSAO_ALTERADA', ATENDIMENTO_ID, { atendimentoId: ATENDIMENTO_ID });

    await waitFor(() => {
      expect(abaB.sessao()[0].observacoesExecucao).toBe('');
    }, { timeout: 3000 });
    await act(async () => {
      await new Promise((r) => setTimeout(r, 900));
    });
    await assentar();
    expect(srv.escritasConsulta.filter((e) => e.method === 'PATCH')).toHaveLength(0);
    expect(estado.dto.itens[0].observacaoExecucao).toBe('');
  });

  it('(e) F5 com o servidor fora: a orientação marcada fica guardada e sobe na nova instância com o mesmo storage', async () => {
    const storage = storageFalso();
    const abaA = montarAba('A', [], { storage });
    await assentar();
    act(() => abaA.result.current.adotar(estado.dto));
    await assentar();

    // Servidor fora: o PATCH da caixa marcada falha (503) e fica na fila (e no storage da aba).
    let fora = true;
    vi.stubGlobal('fetch', async (url, init = {}) => {
      const metodo = String(init.method || 'GET').toUpperCase();
      const caminho = new URL(String(url), 'http://localhost').pathname;
      if (fora && metodo === 'PATCH' && caminho === PATCH_ITEM_2) {
        return new Response(JSON.stringify({ message: 'Fora do ar' }), { status: 503, headers: { 'Content-Type': 'application/json' } });
      }
      return srv.fetchFalso(url, init);
    });
    abaA.mudarLinha(1, { orient: [{ ...EVITAR_SOL, checado: true }] });
    await waitFor(() => {
      expect(storage.getItem(`procedi_consulta_fila_${USUARIO}_${ATENDIMENTO_ID}`)).not.toBeNull();
    }, { timeout: 3000 });
    expect(estado.dto.itens[1].orientacoes).toEqual([EVITAR_SOL]);

    // F5: a instância morre; a nova nasce com o MESMO storage, fora da consulta, e o servidor voltou.
    abaA.unmount();
    fora = false;
    const abaA2 = montarAba('A2', [], { storage, emConsulta: false });
    await waitFor(() => {
      expect(patchesDe(srv, PATCH_ITEM_2).some((p) => p.status === 200)).toBe(true);
    }, { timeout: 3000 });
    await assentar();
    expect(estado.dto.itens[1].orientacoes).toEqual([{ descricao: 'Evitar sol', checado: true, ordem: 0 }]);
    expect(storage.getItem(`procedi_consulta_fila_${USUARIO}_${ATENDIMENTO_ID}`)).toBeNull();

    // Ao entrar de novo, a linha vem do servidor com a orientação marcada.
    act(() => abaA2.result.current.adotar(estado.dto));
    abaA2.rerender({ ...abaA2.base, emConsulta: true });
    await assentar();
    expect(abaA2.sessao()[1].orient).toEqual([{ descricao: 'Evitar sol', checado: true, ordem: 0 }]);
  });

  it('(f) o corpo do encerrar não leva orientacoes', async () => {
    const { abaA } = await duasAbas();
    abaA.mudarLinha(1, { orient: [{ ...EVITAR_SOL, checado: true }] });
    await act(async () => {
      await abaA.result.current.encerrar({ modo: 'COMPLETO', pularGateTermos: true, indiceItemAtivo: 1 });
    });
    const posts = srv.escritasConsulta.filter((e) => e.method === 'POST' && e.path === ENCERRAR);
    expect(posts).toHaveLength(1);
    expect(posts[0].body).toEqual({ modo: 'COMPLETO', pularGateTermos: true, itemAtivoId: ITEM_2 });
    expect('orientacoes' in posts[0].body).toBe(false);
    // A orientação marcada foi antes, pelo PATCH do item.
    expect(patchesDe(srv, PATCH_ITEM_2)).toHaveLength(1);
  });
});
