/**
 * Prova do molde de duas abas (onda 0): duas instâncias de `useAtendimentoServidor`, cada uma com o seu storage,
 * sobre UM servidor falso com estado compartilhado e o canal de avisos falso. A aba A altera a observação de um
 * item (PATCH) → o estado do servidor muda → o teste emite o aviso ATENDIMENTO que o servidor real mandaria → a
 * aba B relê e vê o valor novo em até 3 s. Isto já passa hoje (a mescla por aviso existe): é a prova do molde,
 * não de uma correção.
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

/** AtendimentoDTO como o servidor devolve (sem puxar o `appConsulta.jsx`, que monta o app inteiro). */
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
const ITEM = {
  id: 'i0000000-0000-4000-8000-000000000001',
  ordem: 0,
  agendaId: null,
  nomeLivre: 'Botox',
  catalogoProcedimentoSaudeId: null,
  observacaoExecucao: 'aplicado 20U',
};

async function assentar() {
  await act(async () => {
    for (let i = 0; i < 5; i += 1) await new Promise((r) => setTimeout(r, 0));
  });
}

/**
 * Uma "aba": hook com storage, id da aba e raiz de foco próprios, sobre o mesmo canal e o mesmo servidor.
 * O `aparelho` falso faz o que o estado real faria: a sessão nova vira a prop `procedimentosSessao` da aba
 * (sem isso o espelho da aba enfileiraria um PATCH devolvendo o valor velho).
 */
function montarAba(nome, procedimentosSessao) {
  const base = {
    habilitado: true,
    orgId: ORG_ID,
    userId: USUARIO,
    emConsulta: true,
    pacienteId: IDS.PACIENTE,
    procedimentosSessao,
    aparelho: null,
    storage: storageFalso(),
    idDaAba: () => `aba-${nome}`,
    raizDeFoco: document.createElement('div'),
  };
  const aba = { base };
  const aparelho = {
    // Como um setState do React: a prop nova chega depois que o `hidratar` termina (base dos itens já atualizada).
    setProcedimentosSessao: vi.fn((sessao) => {
      base.procedimentosSessao = sessao;
      queueMicrotask(() => aba.rerender({ ...base }));
    }),
  };
  base.aparelho = aparelho;
  const r = renderHook((p) => useAtendimentoServidor(p), { initialProps: base, wrapper: avisos.Wrapper });
  Object.assign(aba, r, { aparelho });
  return aba;
}

describe('molde de duas abas', () => {
  let srv;
  let estado;

  beforeEach(() => {
    sessionStorage.clear();
    estado = { dto: consultaDto({ itens: [ITEM] }) };
    srv = criarServidorEncerrarFalso({ permissoes: Object.values(PERMISSOES), estado });
    vi.stubGlobal('fetch', srv.fetchFalso);
    setOrgId(ORG_ID);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    setOrgId(null);
  });

  it('a aba A grava um item; o aviso faz a aba B reler e ver o valor em até 3 s', async () => {
    const sessaoInicial = () => [{ nomeProcedimento: 'Botox', observacoesExecucao: ITEM.observacaoExecucao }];
    const abaA = montarAba('A', sessaoInicial());
    const abaB = montarAba('B', sessaoInicial());
    await assentar();
    act(() => {
      abaA.result.current.adotar(estado.dto);
      abaB.result.current.adotar(estado.dto);
    });
    await assentar();
    expect(abaA.result.current.atual?.id).toBe(ATENDIMENTO_ID);
    expect(abaB.result.current.atual?.id).toBe(ATENDIMENTO_ID);

    // A pessoa digita na aba A: o espelho enfileira o PATCH do item (debounce de 700 ms).
    abaA.base.procedimentosSessao = [{ nomeProcedimento: 'Botox', observacoesExecucao: 'aplicado 30U' }];
    abaA.rerender({ ...abaA.base });
    await waitFor(() => {
      const patches = srv.escritasConsulta.filter((e) => e.method === 'PATCH' && e.path.endsWith(`/itens/${ITEM.id}`));
      expect(patches).toHaveLength(1);
      expect(patches[0].body).toEqual({ observacaoExecucao: 'aplicado 30U' });
    }, { timeout: 3000 });
    // "A outra aba gravou": o estado compartilhado do servidor já tem o valor novo.
    expect(estado.dto.itens[0].observacaoExecucao).toBe('aplicado 30U');
    // A aba B ainda não viu nada: a única escrita na sessão dela foi a da hidratação (a linha ganhou o `itemId`, F5b).
    const antesDoAviso = abaB.aparelho.setProcedimentosSessao.mock.calls.length;
    expect(abaB.base.procedimentosSessao[0]).toMatchObject({ itemId: ITEM.id, observacoesExecucao: ITEM.observacaoExecucao });

    // O servidor real mandaria o aviso pelo SSE; aqui o teste emite pelo canal falso.
    avisos.emitirAviso('ATENDIMENTO.SESSAO_ALTERADA', ATENDIMENTO_ID, { atendimentoId: ATENDIMENTO_ID });

    await waitFor(() => {
      const chamadas = abaB.aparelho.setProcedimentosSessao.mock.calls;
      expect(chamadas.length).toBeGreaterThan(antesDoAviso);
      const [sessao] = chamadas[chamadas.length - 1];
      expect(sessao[0].observacoesExecucao).toBe('aplicado 30U');
    }, { timeout: 3000 });

    // A aba B releu pelo GET do detalhe e não devolveu o valor velho ao servidor; cada aba tem o seu storage
    // (o sessionStorage da página ficou intocado) e nenhuma fila ficou guardada.
    expect(srv.leituras.filter((l) => l.path === `/api/v1/atendimentos/${ATENDIMENTO_ID}`).length).toBeGreaterThanOrEqual(1);
    await assentar();
    expect(srv.escritasConsulta.filter((e) => e.method === 'PATCH')).toHaveLength(1);
    expect(estado.dto.itens[0].observacaoExecucao).toBe('aplicado 30U');
    expect(abaB.base.storage.length).toBe(0);
    expect(abaA.base.storage.length).toBe(0);
    expect(sessionStorage.length).toBe(0);
  });
});
