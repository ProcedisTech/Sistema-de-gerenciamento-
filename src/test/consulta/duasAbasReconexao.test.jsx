/**
 * F6a em duas abas: reconexão do canal relê (mesmo sem aviso ATENDIMENTO), releitura com nova tentativa
 * (1, 2, 5 s), consulta encerrada em outro aparelho x aba que encerrou (toasts), releitura velha descartada.
 * Molde: queixaDuasAbas.test.jsx / termosDuasAbas.test.jsx (UM servidor falso com `estado`, duas renderHook).
 */
import React from 'react';
import { act, renderHook, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAtendimentoServidor } from '../../components/hooks/useAtendimentoServidor.js';
import { criarLeitorAvisos } from '../../services/avisos/canalAvisos.js';
import { PERMISSOES } from '../../constants/permissoes.js';
import { setOrgId } from '../../services/api';
import { AVISO } from '../../services/avisos/tiposAviso.js';
import { limparAmbienteSnapshot } from '../snapshotConsulta.jsx';
import { IDS, agendaDto } from '../encerrar/cenariosEncerrar.js';
import { criarServidorFalso, prepararVisibilidade, sse } from '../servidorAvisosFalso.js';
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
  clicarBotao,
  consultaDto as appConsultaDto,
  emConsulta,
  iniciarPeloPaciente,
  montarApp,
} from './appConsulta.jsx';

vi.mock('../../lib/supabaseClient.js', async () => (await import('../encerrar/servidorEncerrarFalso.js')).supabaseFalso());
// O App usa o canal falso; o caso (a) usa o AvisosProvider REAL, exportado aqui como `AvisosProviderReal`.
vi.mock('../../contexts/AvisosProvider.jsx', async (importOriginal) => {
  const real = await importOriginal();
  const falso = (await import('./canalAvisosTeste.jsx')).avisosProviderFalso();
  return { ...real, AvisosProviderReal: real.AvisosProvider, AvisosProvider: falso.AvisosProvider };
});

const USUARIO = 'usr-1';
const ATENDIMENTO_ID = 'c0000000-0000-4000-8000-0000000000ad';
const ESPERA = { timeout: 3000 };
const TOAST_OUTRO = 'Consulta encerrada em outro aparelho';
const TOAST_SUCESSO = 'Jornada finalizada com sucesso.';

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

function propsAba(nome, extras = {}) {
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
    ...extras,
  };
}

async function avancar(ms) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

async function assentarReal() {
  await act(async () => {
    for (let i = 0; i < 5; i += 1) await new Promise((r) => setTimeout(r, 0));
  });
}

describe('F6a em duas abas: reconexão e releitura', () => {
  let estado;
  let srv;
  let chamadasGet;
  /** Intercepta o GET do detalhe: async (resposta, n) => resposta. */
  let hookGet;

  beforeEach(() => {
    sessionStorage.clear();
    estado = { dto: consultaDto() };
    chamadasGet = 0;
    hookGet = null;
    srv = criarServidorEncerrarFalso({ permissoes: Object.values(PERMISSOES), estado });
    vi.stubGlobal('fetch', async (url, init = {}) => {
      const method = String(init.method || 'GET').toUpperCase();
      const ehDetalhe = method === 'GET'
        && new URL(String(url), 'http://localhost').pathname === `/api/v1/atendimentos/${ATENDIMENTO_ID}`;
      if (ehDetalhe) chamadasGet += 1;
      const n = chamadasGet;
      const resposta = await srv.fetchFalso(url, init);
      return ehDetalhe && hookGet ? hookGet(resposta, n) : resposta;
    });
    setOrgId(ORG_ID);
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    setOrgId(null);
  });

  it('(a) volta de aba escondida: a reconexão do canal REAL relê e a aba B mostra o dado novo, sem aviso ATENDIMENTO', async () => {
    vi.useFakeTimers();
    prepararVisibilidade();
    const { AvisosProviderReal } = await import('../../contexts/AvisosProvider.jsx');
    const servidorSse = criarServidorFalso();
    const criarLeitor = (opts) =>
      criarLeitorAvisos({
        ...opts,
        url: '/api/v1/eventos/stream',
        fetchImpl: servidorSse.fetchImpl,
        obterHeaders: async ({ orgId }) => ({ Authorization: 'Bearer t', 'X-Org-Id': orgId }),
        renovarToken: vi.fn().mockResolvedValue({ tipo: 'definitiva' }),
        aleatorio: () => 0.5,
      });
    const WrapperReal = ({ children }) => (
      <AvisosProviderReal orgId={ORG_ID} ativo criarLeitor={criarLeitor}>{children}</AvisosProviderReal>
    );

    const abaA = renderHook((p) => useAtendimentoServidor(p), { initialProps: propsAba('A'), wrapper: avisos.Wrapper });
    const abaB = renderHook((p) => useAtendimentoServidor(p), { initialProps: propsAba('B'), wrapper: WrapperReal });
    await avancar(10);
    act(() => {
      abaA.result.current.adotar(estado.dto);
      abaB.result.current.adotar(estado.dto);
    });
    await avancar(10);
    servidorSse.ultima().enviar(sse.conectado('1'));
    await avancar(1000); // deixa assentar o recarregar da 1a conexão (debounce do useAviso = 300 ms)
    expect(abaB.result.current.atual.modulo).toBe('hub');

    // B "escondida": a conexão cai e nenhum aviso chega. A aba A grava.
    servidorSse.ultima().fechar();
    estado.dto = { ...estado.dto, modulo: 'procedimento' };
    const getsAntes = chamadasGet;
    expect(abaB.result.current.atual.modulo).toBe('hub');

    await avancar(1500);
    servidorSse.ultima().enviar(sse.conectado('1')); // 2a conexão (primeiro = false)
    await avancar(500);

    expect(chamadasGet).toBeGreaterThan(getsAntes);
    expect(abaB.result.current.atual.modulo).toBe('procedimento');
  });

  it('(a2) nível do hook: {tipo:"recarregar"} do canal falso (sem aviso ATENDIMENTO) relê e as abas mostram o dado novo em até 3 s', async () => {
    const abaA = renderHook((p) => useAtendimentoServidor(p), { initialProps: propsAba('A'), wrapper: avisos.Wrapper });
    const abaB = renderHook((p) => useAtendimentoServidor(p), { initialProps: propsAba('B'), wrapper: avisos.Wrapper });
    await assentarReal();
    act(() => {
      abaA.result.current.adotar(estado.dto);
      abaB.result.current.adotar(estado.dto);
    });
    await assentarReal();
    estado.dto = { ...estado.dto, modulo: 'procedimento' };
    expect(abaB.result.current.atual.modulo).toBe('hub');

    avisos.emitirRecarregar();
    await waitFor(() => {
      expect(abaB.result.current.atual.modulo).toBe('procedimento');
      expect(abaA.result.current.atual.modulo).toBe('procedimento');
    }, ESPERA);
  });

  describe('(b) releitura que falha', () => {
    async function montarB() {
      vi.useFakeTimers();
      const aba = renderHook((p) => useAtendimentoServidor(p), { initialProps: propsAba('B'), wrapper: avisos.Wrapper });
      await avancar(10);
      act(() => aba.result.current.adotar(estado.dto));
      await avancar(10);
      return aba;
    }

    function falharVezes(n) {
      let falhas = n;
      hookGet = async (resposta) => {
        if (falhas > 0) {
          falhas -= 1;
          throw new TypeError('Failed to fetch');
        }
        return resposta;
      };
    }

    it('falha de rede 1x: o dado aparece depois de ~1 s', async () => {
      const aba = await montarB();
      estado.dto = { ...estado.dto, modulo: 'procedimento' };
      falharVezes(1);
      const antes = chamadasGet;
      avisos.emitirRecarregar();
      await avancar(300);
      expect(chamadasGet).toBe(antes + 1);
      expect(aba.result.current.atual.modulo).toBe('hub');
      await avancar(900);
      expect(aba.result.current.atual.modulo).toBe('hub');
      await avancar(100);
      expect(chamadasGet).toBe(antes + 2);
      expect(aba.result.current.atual.modulo).toBe('procedimento');
    });

    it('3 falhas seguidas respeitam 1, 2 e 5 s', async () => {
      const aba = await montarB();
      estado.dto = { ...estado.dto, modulo: 'procedimento' };
      falharVezes(3);
      const antes = chamadasGet;
      avisos.emitirRecarregar();
      await avancar(300);
      expect(chamadasGet).toBe(antes + 1);
      await avancar(900); // 1,2 s
      expect(chamadasGet).toBe(antes + 1);
      await avancar(200);
      expect(chamadasGet).toBe(antes + 2);
      await avancar(1800); // ~2 s depois da 2a
      expect(chamadasGet).toBe(antes + 2);
      await avancar(300);
      expect(chamadasGet).toBe(antes + 3);
      await avancar(4600);
      expect(chamadasGet).toBe(antes + 3);
      expect(aba.result.current.atual.modulo).toBe('hub');
      await avancar(600); // ~5 s depois da 3a: a 4a chamada responde
      expect(chamadasGet).toBe(antes + 4);
      expect(aba.result.current.atual.modulo).toBe('procedimento');
    });
  });

  it('(e) releitura velha: o PATCH da própria aba termina durante o GET e a resposta velha não sobrescreve', async () => {
    const aba = renderHook((p) => useAtendimentoServidor(p), { initialProps: propsAba('A'), wrapper: avisos.Wrapper });
    await assentarReal();
    act(() => aba.result.current.adotar(estado.dto));
    await assentarReal();

    let soltar;
    const portao = new Promise((r) => { soltar = r; });
    let primeira = true;
    hookGet = async (resposta) => {
      if (primeira) {
        primeira = false;
        await portao; // resposta capturada ANTES do PATCH (modulo 'hub'): chega velha
      }
      return resposta;
    };
    const antes = chamadasGet;
    avisos.emitirRecarregar();
    await waitFor(() => expect(chamadasGet).toBe(antes + 1), ESPERA);

    act(() => aba.result.current.trocarModulo('procedimento'));
    await waitFor(() => {
      expect(srv.escritasConsulta.some((e) => e.method === 'PATCH' && /\/modulo$/.test(e.path))).toBe(true);
      expect(estado.dto.modulo).toBe('procedimento');
    }, ESPERA);
    await act(async () => {
      soltar();
    });
    await assentarReal();
    await waitFor(() => expect(aba.result.current.atual.modulo).toBe('procedimento'), ESPERA);
    await assentarReal();
    expect(aba.result.current.atual.modulo).toBe('procedimento');
    expect(chamadasGet).toBe(antes + 2); // 1 GET extra (a releitura refeita), não mais
  });
});

describe('F6a no App: quem encerrou x outro aparelho', () => {
  afterEach(() => {
    limparAmbienteSnapshot();
    sessionStorage.clear();
    localStorage.clear();
  });

  const GET_DETALHE = new RegExp(`^/api/v1/atendimentos/${APP_ATENDIMENTO_ID}$`);
  const ENCERRAR = new RegExp(`^/api/v1/atendimentos/${APP_ATENDIMENTO_ID}/encerrar$`);

  it('(c) encerrada em outro aparelho: a aba que NÃO encerrou sai e mostra o toast "em outro aparelho", nunca o de sucesso', async () => {
    const estado = { dto: appConsultaDto() };
    await montarApp({
      agendas: [agendaDto({ id: IDS.AGENDA_1 })],
      rotas: [
        ['POST', /^\/api\/v1\/atendimentos$/, () => estado.dto],
        ['GET', GET_DETALHE, () => estado.dto],
      ],
    });
    await iniciarPeloPaciente();
    expect(emConsulta()).toBe(true);

    estado.dto = appConsultaDto({ status: 'encerrado', encerradoEm: '2026-10-06T13:05:00Z' });
    avisos.emitirAviso(AVISO.ATENDIMENTO.ENCERRADO, APP_ATENDIMENTO_ID, { atendimentoId: APP_ATENDIMENTO_ID });
    await assentarMuito(6);

    expect(emConsulta()).toBe(false);
    expect(await screen.findByText(TOAST_OUTRO)).toBeTruthy();
    expect(screen.queryByText(TOAST_SUCESSO)).toBeNull();
  }, 60000);

  it('(d) a aba que encerrou: toast de sucesso, nunca "em outro aparelho", mesmo recebendo o aviso depois', async () => {
    const estado = { dto: appConsultaDto() };
    const srv = await montarApp({
      agendas: [agendaDto({ id: IDS.AGENDA_1 })],
      rotas: [
        ['POST', ENCERRAR, () => ({
          atendimentoId: APP_ATENDIMENTO_ID,
          status: 'encerrado',
          encerradoEm: '2026-10-06T13:10:00Z',
          procedimentos: [],
          orientacoes: [],
        })],
        ['POST', /^\/api\/v1\/atendimentos$/, () => estado.dto],
        ['GET', GET_DETALHE, () => estado.dto],
      ],
    });
    await iniciarPeloPaciente();
    expect(emConsulta()).toBe(true);

    clicarBotao(/Encerrar consulta/);
    await assentarMuito();
    clicarBotao(/^Finalizar Atendimento$/);
    await assentarMuito(6);

    expect(srv.escritasConsulta.filter((e) => e.method === 'POST' && ENCERRAR.test(e.path))).toHaveLength(1);
    expect(await screen.findByText(TOAST_SUCESSO)).toBeTruthy();
    expect(emConsulta()).toBe(false);

    // o aviso do próprio encerrar chega depois (servidor já com a consulta encerrada)
    estado.dto = appConsultaDto({ status: 'encerrado', encerradoEm: '2026-10-06T13:10:00Z' });
    avisos.emitirAviso(AVISO.ATENDIMENTO.ENCERRADO, APP_ATENDIMENTO_ID, { atendimentoId: APP_ATENDIMENTO_ID });
    await assentarMuito(6);

    expect(screen.queryByText(TOAST_OUTRO)).toBeNull();
    expect(screen.queryByText(TOAST_SUCESSO)).toBeTruthy();
  }, 60000);
});
