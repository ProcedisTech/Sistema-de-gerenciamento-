/**
 * F7 front em duas abas (TESTADOR-G): pendência declarada ao servidor, encerrar que espera a outra aba liberar,
 * redeclaração no `conectado` e alterações que não entraram quando a consulta é encerrada por outro aparelho.
 * Molde: queixaDuasAbas.test.jsx / duasAbasReconexao.test.jsx (UM servidor falso com `estado`, duas renderHook,
 * storages separados, canal de avisos falso). O servidor falso guarda `estado.pendencias[abaId]` e devolve 409
 * ENVIO_PENDENTE_OUTRA_ABA no encerrar quando OUTRA aba tem pendência.
 */
import { useState } from 'react';
import { act, renderHook, screen, waitFor, fireEvent } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAtendimentoServidor } from '../../components/hooks/useAtendimentoServidor.js';
import { PERMISSOES } from '../../constants/permissoes.js';
import { atendimentosApi, setOrgId } from '../../services/api';
import { AVISO } from '../../services/avisos/tiposAviso.js';
import { limparAmbienteSnapshot } from '../snapshotConsulta.jsx';
import { IDS, agendaDto } from '../encerrar/cenariosEncerrar.js';
import { avisos } from './canalAvisosTeste.jsx';
import {
  criarServidorEncerrarFalso,
  ORG_ID,
  ROLE_USER_ID,
  storageFalso,
} from '../encerrar/servidorEncerrarFalso.js';
import {
  ATENDIMENTO_ID as APP_ATENDIMENTO_ID,
  assentarMuito,
  consultaDto as appConsultaDto,
  emConsulta,
  iniciarPeloPaciente,
  montarApp,
  resumoDto,
} from './appConsulta.jsx';

vi.mock('../../lib/supabaseClient.js', async () => (await import('../encerrar/servidorEncerrarFalso.js')).supabaseFalso());
vi.mock('../../contexts/AvisosProvider.jsx', async () => (await import('./canalAvisosTeste.jsx')).avisosProviderFalso());

const USUARIO = 'usr-1';
const ATENDIMENTO_ID = 'c0000000-0000-4000-8000-0000000000ad';
const VAZIOS = { queixa: '', expectativas: '', observacoesAvaliacao: '' };
const ESPERA = { timeout: 3000 };
const ESPERA_LONGA = { timeout: 9000 };
const MSG_OUTRA_ABA = 'Há envios pendentes em outro aparelho';
const FILA = `procedi_consulta_fila_${USUARIO}_${ATENDIMENTO_ID}`;
const NAO_ENTRARAM = `procedi_consulta_naoentraram_${USUARIO}_${ATENDIMENTO_ID}`;

const ENVIO_OBS = {
  chave: 'item:item-1:obs',
  grupo: 'item:item-1',
  tipo: 'item',
  dados: { itemId: 'item-1', campos: { observacaoExecucao: 'obs que a pessoa digitou' } },
};
const ENVIO_QUEIXA = {
  chave: 'avaliacao:queixa',
  grupo: 'avaliacao:queixa',
  tipo: 'avaliacao',
  dados: { queixa: 'rugas na testa' },
};
const ENVIO_MODULO = { chave: 'modulo', grupo: 'modulo', tipo: 'modulo', dados: { modulo: 'anamnese' } };

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
    itens: [{ id: 'item-1', nomeLivre: 'Botox' }],
    fotos: [],
    consultaAnteriorFechada: null,
    fechadaPor: null,
    queixa: null,
    expectativas: null,
    observacoesAvaliacao: null,
    preenchimentoAnamneseId: null,
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
async function avancar(ms) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

/** A tela de uma aba: os 3 textos num `useState` e o hook com a opção `avaliacao`. */
function useAba(props) {
  const [valores, setValores] = useState(VAZIOS);
  const servidor = useAtendimentoServidor({ ...props, avaliacao: { valores, aplicar: setValores } });
  return { servidor, valores, setValores };
}

function propsDaAba(nome, extras = {}) {
  return {
    habilitado: true,
    orgId: ORG_ID,
    userId: USUARIO,
    emConsulta: true,
    pacienteId: IDS.PACIENTE,
    procedimentosSessao: [],
    aparelho: { setProcedimentosSessao: vi.fn() },
    storage: storageFalso(),
    idDaAba: () => `aba-${nome}`,
    raizDeFoco: document.createElement('div'),
    avisar: vi.fn(),
    ...extras,
  };
}

/** `fila`: entradas guardadas no storage DESTA aba antes de montar (a fila nasce com elas e tenta enviar). */
function montarAba(nome, { fila = [], ...extras } = {}) {
  const props = propsDaAba(nome, extras);
  if (fila.length > 0) props.storage.setItem(FILA, JSON.stringify(fila));
  const r = renderHook((p) => useAba(p), { initialProps: props, wrapper: avisos.Wrapper });
  return { ...r, props };
}

function emitir(msg) {
  act(() => {
    for (const f of Array.from(avisos.inscritos)) f(msg);
  });
}

describe('F7 em duas abas: pendência, espera da outra aba e alterações que não entraram', () => {
  let srv;
  let estado;
  /** `patchOff`: PATCH/POST de envio da consulta falham sem rede; `getOff`: o GET do detalhe falha sem rede. */
  let rede;

  const chamadasPendenciaDe = (abaId) => estado.chamadasPendencia.filter((c) => c.abaId === abaId);
  const encerrarPosts = () => srv.escritasConsulta.filter(
    (e) => e.method === 'POST' && e.path === `/api/v1/atendimentos/${ATENDIMENTO_ID}/encerrar`,
  );

  async function adotarAbas(abas, dto = estado.dto) {
    await assentar();
    act(() => {
      for (const a of abas) a.result.current.servidor.adotar(dto);
    });
    await assentar();
    for (const a of abas) expect(a.result.current.servidor.atual?.id).toBe(ATENDIMENTO_ID);
  }

  beforeEach(() => {
    sessionStorage.clear();
    estado = { dto: consultaDto() };
    rede = { patchOff: false, getOff: false };
    srv = criarServidorEncerrarFalso({ permissoes: Object.values(PERMISSOES), estado });
    vi.stubGlobal('fetch', async (url, init = {}) => {
      const method = String(init.method || 'GET').toUpperCase();
      const path = new URL(String(url), 'http://localhost').pathname;
      const ehEnvio = (method === 'PATCH' || (method === 'POST' && /\/termos\/assinaturas$/.test(path)))
        && /^\/api\/v1\/atendimentos\//.test(path);
      if (rede.patchOff && ehEnvio) throw new TypeError('Failed to fetch');
      if (rede.getOff && method === 'GET' && path === `/api/v1/atendimentos/${ATENDIMENTO_ID}`) {
        throw new TypeError('Failed to fetch');
      }
      return srv.fetchFalso(url, init);
    });
    setOrgId(ORG_ID);
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    setOrgId(null);
    sessionStorage.clear();
    Object.defineProperty(navigator, 'clipboard', { value: undefined, configurable: true });
  });

  it('(a) A com envio pendente declara pendência; B é barrada (409), espera, e conclui SOZINHA com pendencia-liberada', async () => {
    rede.patchOff = true;
    const abaA = montarAba('A', { fila: [ENVIO_OBS] });
    // Espera longa: só a mensagem `pendencia-liberada` pode acordar a B dentro do teste.
    const abaB = montarAba('B', { esperaOutraAbaMs: 600000 });
    await adotarAbas([abaA, abaB]);

    await waitFor(() => {
      expect(chamadasPendenciaDe('aba-A')).toHaveLength(1);
    }, ESPERA);
    expect(chamadasPendenciaDe('aba-A')[0].pendente).toBe(true);
    expect(estado.pendencias['aba-A']).toBe(true);

    let promessa;
    act(() => {
      promessa = abaB.result.current.servidor
        .encerrarAguardandoOutraAba({ modo: 'COMPLETO' })
        .then((r) => ({ ok: r }), (e) => ({ erro: e }));
    });
    await waitFor(() => {
      expect(abaB.result.current.servidor.esperandoOutraAba).toBe(true);
    }, ESPERA);
    expect(encerrarPosts().map((e) => e.status)).toEqual([409]);
    expect(abaB.props.avisar).toHaveBeenCalledTimes(1);
    expect(abaB.props.avisar).toHaveBeenCalledWith('warning', MSG_OUTRA_ABA);

    // A volta online e esvazia a fila: PUT pendente:false.
    rede.patchOff = false;
    await waitFor(() => {
      expect(estado.pendencias['aba-A']).toBe(false);
    }, ESPERA_LONGA);
    expect(chamadasPendenciaDe('aba-A').map((c) => c.pendente)).toEqual([true, false]);
    expect(estado.dto.itens[0].observacaoExecucao).toBe('obs que a pessoa digitou');
    // Sem a mensagem, B ainda espera.
    expect(encerrarPosts()).toHaveLength(1);
    expect(abaB.result.current.servidor.esperandoOutraAba).toBe(true);

    emitir({ tipo: 'pendencia-liberada', atendimentoId: ATENDIMENTO_ID });
    let resultado;
    await act(async () => {
      resultado = await promessa;
    });
    expect(resultado.erro).toBeUndefined();
    expect(encerrarPosts().map((e) => e.status)).toEqual([409, 204]);
    expect(abaB.result.current.servidor.esperandoOutraAba).toBe(false);
    expect(abaB.props.avisar).toHaveBeenCalledTimes(1);
  }, 30000);

  it('(b) sem a mensagem pendencia-liberada, B tenta de novo em ~10 s e conclui', async () => {
    vi.useFakeTimers();
    rede.patchOff = true;
    const abaA = montarAba('A', { fila: [ENVIO_OBS] });
    const abaB = montarAba('B');
    await avancar(10);
    act(() => {
      abaA.result.current.servidor.adotar(estado.dto);
      abaB.result.current.servidor.adotar(estado.dto);
    });
    await avancar(50);
    expect(estado.pendencias['aba-A']).toBe(true);

    let promessa;
    let resultado;
    await act(async () => {
      promessa = abaB.result.current.servidor
        .encerrarAguardandoOutraAba({ modo: 'COMPLETO' })
        .then((r) => ({ ok: r }), (e) => ({ erro: e }));
      await vi.advanceTimersByTimeAsync(50);
    });
    expect(abaB.result.current.servidor.esperandoOutraAba).toBe(true);
    expect(encerrarPosts().map((e) => e.status)).toEqual([409]);

    // A volta online na retentativa da fila (3 s) e libera; nenhuma mensagem é emitida.
    rede.patchOff = false;
    await avancar(3500);
    expect(estado.pendencias['aba-A']).toBe(false);
    expect(encerrarPosts()).toHaveLength(1);

    await avancar(6000); // ~9,6 s desde o 409: ainda não
    expect(encerrarPosts()).toHaveLength(1);
    await avancar(1000); // passou de 10 s
    await act(async () => {
      resultado = await promessa;
    });
    expect(resultado.erro).toBeUndefined();
    expect(encerrarPosts().map((e) => e.status)).toEqual([409, 204]);
    expect(abaB.result.current.servidor.esperandoOutraAba).toBe(false);
    expect(abaB.props.avisar).toHaveBeenCalledTimes(1);
  }, 30000);

  describe('(c) perda silenciosa corrigida', () => {
    it('A offline com 2 envios; B encerra; ao voltar online as 2 alterações não entraram e nada é descartado calado', async () => {
      rede.patchOff = true;
      rede.getOff = true;
      const abaA = montarAba('A', { fila: [ENVIO_OBS, ENVIO_QUEIXA] });
      await adotarAbas([abaA]);
      await waitFor(() => {
        expect(estado.pendencias['aba-A']).toBe(true);
      }, ESPERA);
      expect(JSON.parse(abaA.props.storage.getItem(FILA))).toHaveLength(2);

      // A consulta é encerrada pela B; o aviso chega à A (sem rede, a releitura falha).
      estado.dto = consultaDto({ status: 'encerrado', encerradoEm: '2026-10-06T13:05:00Z' });
      avisos.emitirAviso(AVISO.ATENDIMENTO.ENCERRADO, ATENDIMENTO_ID, { atendimentoId: ATENDIMENTO_ID });
      await esperar(700);
      expect(abaA.result.current.servidor.alteracoesNaoEntraram).toBeNull();

      // A volta online (antes da retentativa de 3 s da fila): a releitura vê status 'encerrado'.
      rede.patchOff = false;
      rede.getOff = false;
      await waitFor(() => {
        expect(abaA.result.current.servidor.alteracoesNaoEntraram?.quantidade).toBe(2);
      }, ESPERA_LONGA);
      const ne = abaA.result.current.servidor.alteracoesNaoEntraram;
      const porChave = Object.fromEntries(ne.itens.map((i) => [i.chave, i]));
      expect(porChave['item:item-1:obs']).toMatchObject({
        tipo: 'item',
        rotulo: expect.stringMatching(/^Observação do procedimento/),
        texto: 'obs que a pessoa digitou',
      });
      expect(porChave['avaliacao:queixa']).toMatchObject({ tipo: 'avaliacao', rotulo: 'Queixa', texto: 'rugas na testa' });
      expect(ne.textoParaCopiar).toContain('obs que a pessoa digitou');
      expect(ne.textoParaCopiar).toContain('rugas na testa');
      // Nada foi descartado calado nem foi enviado a uma consulta fechada.
      expect(console.warn.mock.calls.some((c) => /Envio recusado/.test(String(c[0])))).toBe(false);
      expect(srv.escritasConsulta.filter((e) => e.method === 'PATCH')).toHaveLength(0);
      // Fila guardada limpa; os textos ficam em outra chave.
      expect(abaA.props.storage.getItem(FILA)).toBeNull();
      expect(JSON.parse(abaA.props.storage.getItem(NAO_ENTRARAM))).toHaveLength(2);

      // Copiar: usa o clipboard e devolve true.
      const writeText = vi.fn().mockResolvedValue(undefined);
      Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
      let ok;
      await act(async () => {
        ok = await abaA.result.current.servidor.copiarAlteracoesNaoEntraram();
      });
      expect(ok).toBe(true);
      expect(writeText).toHaveBeenCalledWith(ne.textoParaCopiar);

      // Descartar: zera memória e storage.
      act(() => abaA.result.current.servidor.descartarAlteracoesNaoEntraram());
      expect(abaA.result.current.servidor.alteracoesNaoEntraram).toBeNull();
      expect(abaA.props.storage.getItem(NAO_ENTRARAM)).toBeNull();
      expect(abaA.props.storage.getItem(FILA)).toBeNull();
    }, 30000);
  });

  it('(d) A envia ANTES de saber que fechou: o PATCH leva 409 "consulta já foi fechada" e vai para alteracoesNaoEntraram (modulo não)', async () => {
    rede.patchOff = true;
    const abaA = montarAba('A', { fila: [ENVIO_OBS, ENVIO_MODULO] });
    await adotarAbas([abaA]);
    await waitFor(() => {
      expect(estado.pendencias['aba-A']).toBe(true);
    }, ESPERA);

    // Fechou no servidor, sem aviso para a A; a rede volta e a retentativa da fila (3 s) leva o 409.
    estado.dto = consultaDto({ status: 'encerrado', encerradoEm: '2026-10-06T13:05:00Z' });
    rede.patchOff = false;
    await waitFor(() => {
      expect(abaA.result.current.servidor.alteracoesNaoEntraram?.quantidade).toBe(1);
    }, ESPERA_LONGA);
    const ne = abaA.result.current.servidor.alteracoesNaoEntraram;
    expect(ne.itens.map((i) => i.chave)).toEqual(['item:item-1:obs']);
    expect(ne.itens[0].texto).toBe('obs que a pessoa digitou');
    expect(srv.escritasConsulta.some((e) => e.method === 'PATCH' && e.status === 409)).toBe(true);
    expect(console.warn.mock.calls.some((c) => /Envio recusado/.test(String(c[0])))).toBe(false);
    const guardado = JSON.parse(abaA.props.storage.getItem(NAO_ENTRARAM));
    expect(guardado.map((g) => g.chave)).toEqual(['item:item-1:obs']);
    expect(guardado.some((g) => g.tipo === 'modulo')).toBe(false);
  }, 30000);

  it('(e) A recarrega a página (remount com o mesmo storage): alteracoesNaoEntraram continua lá', async () => {
    rede.patchOff = true;
    const abaA = montarAba('A', { fila: [ENVIO_OBS, ENVIO_QUEIXA] });
    await adotarAbas([abaA]);
    await waitFor(() => {
      expect(estado.pendencias['aba-A']).toBe(true);
    }, ESPERA);
    estado.dto = consultaDto({ status: 'encerrado' });
    rede.patchOff = false;
    avisos.emitirAviso(AVISO.ATENDIMENTO.ENCERRADO, ATENDIMENTO_ID, { atendimentoId: ATENDIMENTO_ID });
    await waitFor(() => {
      expect(abaA.result.current.servidor.alteracoesNaoEntraram?.quantidade).toBe(2);
    }, ESPERA_LONGA);

    abaA.unmount();
    const abaA2 = renderHook((p) => useAba(p), {
      initialProps: {
        ...abaA.props,
        emConsulta: false,
        pacienteId: null,
        raizDeFoco: document.createElement('div'),
      },
      wrapper: avisos.Wrapper,
    });
    await assentar();
    expect(abaA2.result.current.servidor.alteracoesNaoEntraram?.quantidade).toBe(2);
    expect(abaA2.result.current.servidor.alteracoesNaoEntraram.itens.map((i) => i.texto).sort())
      .toEqual(['obs que a pessoa digitou', 'rugas na testa']);
    expect(abaA.props.storage.getItem(FILA)).toBeNull();
  }, 30000);

  it('(f) redeclara no `conectado`: o servidor perdeu a pendência, A faz PUT true de novo (seq maior) e B volta a ser barrada', async () => {
    rede.patchOff = true;
    const abaA = montarAba('A', { fila: [ENVIO_OBS] });
    const abaB = montarAba('B');
    await adotarAbas([abaA, abaB]);
    await waitFor(() => {
      expect(chamadasPendenciaDe('aba-A')).toHaveLength(1);
    }, ESPERA);
    const seq1 = chamadasPendenciaDe('aba-A')[0].seq;

    // O servidor "perdeu" o que sabia da aba.
    estado.pendencias = {};
    estado.seqPendencias = {};
    expect(estado.pendencias['aba-A']).toBeUndefined();

    emitir({ tipo: 'conectado', primeiro: false });
    await waitFor(() => {
      expect(chamadasPendenciaDe('aba-A')).toHaveLength(2);
    }, ESPERA);
    const [, segunda] = chamadasPendenciaDe('aba-A');
    expect(segunda.pendente).toBe(true);
    expect(segunda.seq).toBeGreaterThan(seq1);
    expect(estado.pendencias['aba-A']).toBe(true);

    let erro = null;
    await act(async () => {
      await abaB.result.current.servidor.encerrar({ modo: 'COMPLETO' }).catch((e) => {
        erro = e;
      });
    });
    expect(erro?.codigo).toBe('ENVIO_PENDENTE_OUTRA_ABA');
    expect(encerrarPosts().map((e) => e.status)).toEqual([409]);
  }, 30000);

  it('(g) a PRÓPRIA aba com pendência não é barrada pela própria pendência (X-Aba-Id igual); outra aba é', async () => {
    estado.pendencias = { 'aba-A': true };
    estado.seqPendencias = { 'aba-A': 1 };
    setOrgId(ORG_ID);
    // Nível servidor falso + api.js (cabeçalho X-Aba-Id).
    await expect(atendimentosApi.encerrar(ATENDIMENTO_ID, { modo: 'COMPLETO' }, { abaId: 'aba-A' })).resolves.toBeDefined();
    await expect(atendimentosApi.encerrar(ATENDIMENTO_ID, { modo: 'COMPLETO' }, { abaId: 'aba-B' }))
      .rejects.toMatchObject({ status: 409 });
    expect(encerrarPosts().map((e) => e.status)).toEqual([204, 409]);
  }, 30000);

  it('(g2) hook: a aba A com pendência própria encerra sem ser barrada pela própria pendência', async () => {
    rede.patchOff = false;
    const abaA = montarAba('A');
    await adotarAbas([abaA]);
    estado.pendencias = { 'aba-A': true };
    estado.seqPendencias = { 'aba-A': 1 };
    let erro = null;
    await act(async () => {
      await abaA.result.current.servidor.encerrar({ modo: 'COMPLETO' }).catch((e) => {
        erro = e;
      });
    });
    expect(erro).toBeNull();
    expect(encerrarPosts().map((e) => e.status)).toEqual([204]);
  }, 30000);
});

describe('(h) nível App: consulta encerrada em outro aparelho com envio pendente guardado', () => {
  afterEach(() => {
    limparAmbienteSnapshot();
    sessionStorage.clear();
    localStorage.clear();
    vi.restoreAllMocks();
  });

  const GET_DETALHE = new RegExp(`^/api/v1/atendimentos/${APP_ATENDIMENTO_ID}$`);

  it('mostra "Consulta encerrada em outro aparelho" e o banner "1 alteração não entrou" já na tela de Pacientes; Descartar some o banner', async () => {
    const itemId = 'item-app-1';
    const estado = { dto: appConsultaDto({ itens: [{ id: itemId, nomeLivre: 'Botox' }] }) };
    const rede = { fora: true };
    const filaApp = [{
      chave: `item:${itemId}:obs`,
      grupo: `item:${itemId}`,
      tipo: 'item',
      dados: { itemId, campos: { observacaoExecucao: 'texto sem internet' } },
    }];
    await montarApp({
      agendas: [agendaDto({ id: IDS.AGENDA_1 })],
      sessao: { [`procedi_consulta_fila_${USUARIO}_${APP_ATENDIMENTO_ID}`]: JSON.stringify(filaApp) },
      rotas: [
        ['GET', /^\/api\/v1\/atendimentos\/minhas$/, () => (estado.dto.status === 'aberto' ? [resumoDto(estado.dto)] : [])],
        ['POST', /^\/api\/v1\/atendimentos$/, () => estado.dto],
        ['GET', GET_DETALHE, () => estado.dto],
        ['PATCH', /^\/api\/v1\/atendimentos\/[^/]+\/itens\/[^/]+$/, () => (rede.fora
          ? { status: 503, corpo: { error: 'sem rede' } }
          : { status: 409, corpo: { error: 'Esta consulta já foi fechada.', status: 409 } })],
        ['PUT', /^\/api\/v1\/atendimentos\/[^/]+\/pendencia$/, () => ({ status: 204, corpo: null })],
      ],
    });
    // A consulta aberta volta sozinha (F5: `minhas` + fila guardada); se não, inicia pelo paciente.
    const naConsulta = () => emConsulta() || Array.from(document.querySelectorAll('button')).some((b) => /Encerrar consulta/.test(b.textContent || ''));
    if (!naConsulta()) {
      // Abrir o paciente que já tem consulta aberta leva direto a ela (ou mostra "Iniciar atendimento").
      fireEvent.click(screen.getAllByText('Maria Souza')[0]);
      await assentarMuito();
      if (!naConsulta()) await iniciarPeloPaciente();
    }
    expect(naConsulta()).toBe(true);
    await assentarMuito(4);
    expect(screen.queryByRole('alert')).toBeNull();

    // Outra aba encerrou; o servidor já recusa o envio guardado; chega o aviso.
    estado.dto = appConsultaDto({ status: 'encerrado', encerradoEm: '2026-10-06T13:05:00Z', itens: estado.dto.itens });
    avisos.emitirAviso(AVISO.ATENDIMENTO.ENCERRADO, APP_ATENDIMENTO_ID, { atendimentoId: APP_ATENDIMENTO_ID });
    await new Promise((resolve) => setTimeout(resolve, 320));
    await assentarMuito(8);

    expect(naConsulta()).toBe(false);
    expect(await screen.findByText('Consulta encerrada em outro aparelho')).toBeTruthy();
    const banner = await screen.findByRole('alert');
    expect(banner.textContent).toContain('1 alteração não entrou');
    expect(banner.textContent).toContain('texto sem internet');

    fireEvent.click(screen.getByRole('button', { name: /Descartar alterações que não entraram/ }));
    await assentarMuito(2);
    expect(screen.queryByText(/alteração não entrou/)).toBeNull();
  }, 90000);
});
