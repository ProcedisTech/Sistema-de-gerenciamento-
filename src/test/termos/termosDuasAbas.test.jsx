/**
 * Onda E em duas abas: termos da consulta (escolhido/lido), assinatura pela fila (idempotente por consulta+termo),
 * offline + F5 e clique em andamento. Molde: `test/consulta/queixaDuasAbas.test.jsx`.
 */
import { useState } from 'react';
import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAtendimentoServidor } from '../../components/hooks/useAtendimentoServidor.js';
import { useTermosConsulta } from '../../components/hooks/useTermosConsulta.js';
import { faltantesDoItem } from '../../utils/termoResolucao.js';
import { PERMISSOES } from '../../constants/permissoes.js';
import { setOrgId } from '../../services/api';
import { avisos } from '../consulta/canalAvisosTeste.jsx';
import { IDS } from '../encerrar/cenariosEncerrar.js';
import {
  criarServidorEncerrarFalso,
  ORG_ID,
  ROLE_USER_ID,
  storageFalso,
} from '../encerrar/servidorEncerrarFalso.js';

vi.mock('../../lib/supabaseClient.js', async () => (await import('../encerrar/servidorEncerrarFalso.js')).supabaseFalso());

const USUARIO = 'usr-1';
const ATENDIMENTO_ID = 'c0000000-0000-4000-8000-0000000000ad';
const T1 = 'd0000000-0000-4000-8000-000000000001';
const T2 = 'd0000000-0000-4000-8000-000000000002';
const ESPERA = { timeout: 3000 };

const linha = (termoId, extras = {}) => ({
  termoId, ordem: 0, lido: false, lidoEm: null, escolhido: false, termoAssinaturaId: null, statusAssinatura: null, ...extras,
});

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
    queixa: null,
    expectativas: null,
    observacoesAvaliacao: null,
    preenchimentoAnamneseId: null,
    termos: [linha(T1), linha(T2)],
    ...extras,
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

/** A tela de uma aba: journeyState de termos (3 useState), o hook do servidor e o useTermosConsulta. */
function useAba(props) {
  const [termoSelecionadoId, setTermoSelecionadoId] = useState(null);
  const [termoLido, setTermoLido] = useState(false);
  const [termosPendentesIds, setTermosPendentesIds] = useState([]);
  const journeyState = {
    termoSelecionadoId, setTermoSelecionadoId, termoLido, setTermoLido, termosPendentesIds, setTermosPendentesIds,
  };
  const servidor = useAtendimentoServidor(props);
  const termos = useTermosConsulta({
    termosDaConsulta: servidor.termosDaConsulta,
    salvarTermosConsulta: servidor.salvarTermosConsulta,
    journeyState,
  });
  return { servidor, journeyState, ...termos };
}

function montarAba(nome, storage = storageFalso()) {
  const props = {
    habilitado: true,
    orgId: ORG_ID,
    userId: USUARIO,
    emConsulta: true,
    pacienteId: IDS.PACIENTE,
    procedimentosSessao: [],
    aparelho: { setProcedimentosSessao: vi.fn() },
    storage,
    idDaAba: () => `aba-${nome}`,
    raizDeFoco: document.createElement('div'),
  };
  const r = renderHook((p) => useAba(p), { initialProps: props, wrapper: avisos.Wrapper });
  return { ...r, props, storage };
}

function emitirAviso() {
  act(() => {
    avisos.emitirAviso('ATENDIMENTO.SESSAO_ALTERADA', ATENDIMENTO_ID, { atendimentoId: ATENDIMENTO_ID });
  });
}

describe('termos em duas abas (Onda E)', () => {
  let srv;
  let estado;
  let offline;
  let portaoPut;
  let chamadas;

  const putsTermos = () => srv.escritasConsulta.filter(
    (e) => e.method === 'PUT' && e.path === `/api/v1/atendimentos/${ATENDIMENTO_ID}/termos`,
  );
  const postsAssinatura = () => chamadas.filter((c) => c.method === 'POST' && /\/termos\/assinaturas$/.test(c.path));
  const linhasAssinatura = () => Object.keys(estado.assinaturas || {});

  async function montarDuasAbas(dto = consultaDto()) {
    estado.dto = dto;
    const abaA = montarAba('A');
    const abaB = montarAba('B');
    await assentar();
    act(() => {
      abaA.result.current.servidor.adotar(estado.dto);
      abaB.result.current.servidor.adotar(estado.dto);
    });
    await assentar();
    expect(abaA.result.current.servidor.atual?.id).toBe(ATENDIMENTO_ID);
    expect(abaB.result.current.servidor.atual?.id).toBe(ATENDIMENTO_ID);
    return { abaA, abaB };
  }

  const corpoAssinatura = (termoId = T1) => ({
    termoId, pacienteId: IDS.PACIENTE, assinaturaPaciente: 'data:image/png;base64,AAAA', statusCodigo: 'ASSINADO',
    atendimentoId: ATENDIMENTO_ID,
  });

  beforeEach(() => {
    sessionStorage.clear();
    estado = { dto: null };
    offline = false;
    portaoPut = null;
    chamadas = [];
    srv = criarServidorEncerrarFalso({ permissoes: Object.values(PERMISSOES), estado });
    vi.stubGlobal('fetch', async (url, init = {}) => {
      const method = String(init.method || 'GET').toUpperCase();
      const path = new URL(String(url), 'http://localhost').pathname;
      chamadas.push({ method, path });
      if (offline && method === 'POST' && /\/termos\/assinaturas$/.test(path)) {
        throw new TypeError('Failed to fetch');
      }
      if (portaoPut && method === 'PUT' && /\/termos$/.test(path)) await portaoPut.promessa;
      return srv.fetchFalso(url, init);
    });
    setOrgId(ORG_ID);
  });
  afterEach(() => {
    portaoPut?.liberar();
    vi.unstubAllGlobals();
    setOrgId(null);
  });

  it('(a) A escolhe T1 e marca lido: 1 PUT; B restaura selecionado e lido, sem eco (zero PUT da B)', async () => {
    const { abaA, abaB } = await montarDuasAbas();

    // Dois cliques seguidos (T2 e depois T1): a fila guarda 1 PUT só, o último vence.
    act(() => {
      abaA.result.current.journeyState.setTermoSelecionadoId(T2);
      abaA.result.current.journeyState.setTermosPendentesIds([T2]);
    });
    act(() => {
      expect(abaA.result.current.gravarEstadoTermos()).toBe(true);
    });
    act(() => {
      abaA.result.current.journeyState.setTermoSelecionadoId(T1);
      abaA.result.current.journeyState.setTermoLido(true);
      abaA.result.current.journeyState.setTermosPendentesIds([T1]);
    });
    act(() => {
      abaA.result.current.gravarEstadoTermos();
    });
    await waitFor(() => expect(putsTermos()).toHaveLength(1), ESPERA);
    expect(putsTermos()[0].body).toMatchObject({ termoSelecionadoId: T1, termoLido: true });
    expect(estado.dto.termos.find((t) => t.termoId === T1)).toMatchObject({ escolhido: true, lido: true });

    emitirAviso();
    await waitFor(() => {
      expect(abaB.result.current.journeyState.termoSelecionadoId).toBe(T1);
      expect(abaB.result.current.journeyState.termoLido).toBe(true);
    }, ESPERA);
    await esperar(600);
    await assentar();
    expect(putsTermos()).toHaveLength(1);
    expect(abaB.result.current.journeyState.termoSelecionadoId).toBe(T1);
  });

  it('(b) A assina pelo tablet: 1 POST (201); B vê ASSINADO e o termoAssinaturaId', async () => {
    const { abaA, abaB } = await montarDuasAbas();

    let r;
    await act(async () => {
      r = await abaA.result.current.servidor.enviarAssinaturaPelaFila(corpoAssinatura(T1));
    });
    expect(r).toMatchObject({ ok: true, naFila: false });
    expect(postsAssinatura()).toHaveLength(1);
    expect(srv.escritas.find((e) => e.path === '/api/v1/termos/assinaturas')?.status).toBe(201);

    emitirAviso();
    await waitFor(() => {
      const l = abaB.result.current.servidor.termosDaConsulta.find((t) => t.termoId === T1);
      expect(l).toMatchObject({ statusAssinatura: 'ASSINADO', termoAssinaturaId: r.assinatura.id });
    }, ESPERA);
  });

  it('(c) as duas abas assinam o MESMO termo juntas: 1 linha no servidor, um 201 e um 200 com o mesmo id, sem erro', async () => {
    const { abaA, abaB } = await montarDuasAbas();

    let ra;
    let rb;
    await act(async () => {
      [ra, rb] = await Promise.all([
        abaA.result.current.servidor.enviarAssinaturaPelaFila(corpoAssinatura(T1)),
        abaB.result.current.servidor.enviarAssinaturaPelaFila(corpoAssinatura(T1)),
      ]);
    });
    expect(linhasAssinatura()).toHaveLength(1);
    const status = srv.escritas.filter((e) => e.path === '/api/v1/termos/assinaturas').map((e) => e.status).sort();
    expect(status).toEqual([200, 201]);
    expect(ra).toMatchObject({ ok: true, naFila: false });
    expect(rb).toMatchObject({ ok: true, naFila: false });
    expect(ra.assinatura.id).toBe(rb.assinatura.id);
    expect(abaA.result.current.servidor.termosDaConsulta.find((t) => t.termoId === T1).termoAssinaturaId).toBe(ra.assinatura.id);
    expect(abaB.result.current.servidor.termosDaConsulta.find((t) => t.termoId === T1).termoAssinaturaId).toBe(ra.assinatura.id);
  });

  it('(d) sem internet: fica na fila (sessionStorage), F5 recria o hook, a rede volta e 1 POST sobe; B vê', async () => {
    const { abaA, abaB } = await montarDuasAbas();
    offline = true;

    let r;
    await act(async () => {
      r = await abaA.result.current.servidor.enviarAssinaturaPelaFila(corpoAssinatura(T1));
    });
    expect(r).toMatchObject({ ok: false, naFila: true });
    expect(linhasAssinatura()).toHaveLength(0);
    let guardado = '';
    for (let i = 0; i < abaA.storage.length; i += 1) guardado += abaA.storage.getItem(abaA.storage.key(i));
    expect(guardado).toContain(`assinatura:${T1}`);
    expect(guardado).toContain('AAAA');

    // F5: o hook morre e nasce de novo com o MESMO storage; a rede volta.
    abaA.unmount();
    offline = false;
    const antes = chamadas.length;
    const abaA2 = montarAba('A', abaA.storage);
    await assentar();
    act(() => {
      abaA2.result.current.servidor.adotar(estado.dto);
    });
    await assentar();

    await waitFor(() => expect(linhasAssinatura()).toHaveLength(1), { timeout: 9000 });
    await esperar(300);
    expect(chamadas.slice(antes).filter((c) => c.method === 'POST' && /assinaturas$/.test(c.path))).toHaveLength(1);

    emitirAviso();
    await waitFor(() => {
      expect(abaB.result.current.servidor.termosDaConsulta.find((t) => t.termoId === T1))
        .toMatchObject({ statusAssinatura: 'ASSINADO' });
    }, ESPERA);
  }, 20000);

  it('(e) PUT preso na aba A + aviso de mudança da outra aba: A não volta ao valor velho (pendente termos)', async () => {
    const { abaA } = await montarDuasAbas();
    let liberar;
    portaoPut = { promessa: new Promise((r) => { liberar = r; }), liberar: () => liberar() };

    act(() => {
      abaA.result.current.journeyState.setTermoSelecionadoId(T2);
      abaA.result.current.journeyState.setTermosPendentesIds([T2]);
    });
    act(() => {
      abaA.result.current.gravarEstadoTermos();
    });
    await waitFor(() => expect(chamadas.filter((c) => c.method === 'PUT' && /\/termos$/.test(c.path))).toHaveLength(1), ESPERA);
    expect(putsTermos()).toHaveLength(0);

    // "Outra aba" mudou os termos no servidor (T1 escolhido); o aviso chega com o PUT da A ainda preso.
    estado.dto = { ...estado.dto, termos: [linha(T1, { escolhido: true, lido: true, lidoEm: 'x' }), linha(T2, { ordem: 1 })] };
    emitirAviso();
    await esperar(800);
    await assentar();
    const sel = abaA.result.current.servidor.termosDaConsulta.find((t) => t.escolhido);
    expect(sel?.termoId).toBe(T2);
    expect(abaA.result.current.journeyState.termoSelecionadoId).toBe(T2);

    await act(async () => {
      portaoPut.liberar();
    });
    portaoPut = null;
    await waitFor(() => expect(putsTermos()).toHaveLength(1), ESPERA);
    expect(putsTermos()[0].body).toMatchObject({ termoSelecionadoId: T2 });
    expect(estado.dto.termos.find((t) => t.escolhido)?.termoId).toBe(T2);
  });

  it('(f) abrir o termo na A (lido automatico): 1 PUT com termoLido; B restaura lido e lidoEm em ate 3 s, sem eco', async () => {
    const { abaA, abaB } = await montarDuasAbas();
    // Estado inicial: ninguem escolhido nem lido.
    expect(abaB.result.current.journeyState.termoLido).toBe(false);

    // "Abrir termo": o Step4 seleciona T1, chama setTermoLido(true) e, no commit seguinte, gravarEstadoTermos().
    act(() => {
      abaA.result.current.journeyState.setTermoSelecionadoId(T1);
      abaA.result.current.journeyState.setTermoLido(true);
    });
    act(() => {
      expect(abaA.result.current.gravarEstadoTermos()).toBe(true);
    });
    await waitFor(() => expect(putsTermos()).toHaveLength(1), ESPERA);
    expect(putsTermos()[0].body).toMatchObject({ termoLido: true, termoSelecionadoId: T1 });
    const gravado = estado.dto.termos.find((t) => t.termoId === T1);
    expect(gravado).toMatchObject({ escolhido: true, lido: true });
    expect(gravado.lidoEm).toBeTruthy();

    emitirAviso();
    await waitFor(() => {
      expect(abaB.result.current.journeyState.termoLido).toBe(true);
      const l = abaB.result.current.servidor.termosDaConsulta.find((t) => t.termoId === T1);
      expect(l.lido).toBe(true);
      expect(l.lidoEm).toBeTruthy();
    }, ESPERA);
    await esperar(600);
    await assentar();
    expect(putsTermos()).toHaveLength(1); // B nao ecoou
    expect(abaB.result.current.journeyState.termoLido).toBe(true);
  });
  it('(g) F3: a faixa por item some na B depois que a A assina (faltantes do item = resolução menos ASSINADO)', async () => {
    const { abaA, abaB } = await montarDuasAbas();
    // Resolução do catálogo do item ativo da B, lida antes da assinatura: T1 e T2 faltam.
    const resolucaoDoItem = { faltantes: [{ termoId: T1, titulo: 'Termo 1' }, { termoId: T2, titulo: 'Termo 2' }] };
    expect(faltantesDoItem(resolucaoDoItem, abaB.result.current.servidor.termosDaConsulta).map((f) => f.termoId))
      .toEqual([T1, T2]);

    await act(async () => {
      await abaA.result.current.servidor.enviarAssinaturaPelaFila(corpoAssinatura(T1));
    });
    emitirAviso();
    await waitFor(() => {
      const faltantes = faltantesDoItem(resolucaoDoItem, abaB.result.current.servidor.termosDaConsulta);
      expect(faltantes.map((f) => f.termoId)).toEqual([T2]);
    }, ESPERA);

    await act(async () => {
      await abaA.result.current.servidor.enviarAssinaturaPelaFila(corpoAssinatura(T2));
    });
    emitirAviso();
    await waitFor(() => {
      expect(faltantesDoItem(resolucaoDoItem, abaB.result.current.servidor.termosDaConsulta)).toEqual([]);
    }, ESPERA);
  });

  it('(h) F3: o título do termo chega à B pelo termosDaConsulta (titulo do servidor, não o genérico)', async () => {
    const dto = consultaDto({
      termos: [linha(T1, { titulo: 'Termo de toxina botulínica' }), linha(T2, { titulo: null })],
    });
    const { abaB } = await montarDuasAbas(dto);
    const termos = abaB.result.current.servidor.termosDaConsulta;
    expect(termos.find((t) => t.termoId === T1).titulo).toBe('Termo de toxina botulínica');
    expect(termos.find((t) => t.termoId === T2).titulo).toBeNull();
  });
});
