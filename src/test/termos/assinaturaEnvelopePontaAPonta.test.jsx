/**
 * Envelope de assinatura, ponta a ponta: Step3Termos REAL + useTermosConsulta REAL + useAtendimentoServidor REAL
 * sobre o servidor falso com `estado` (POST /termos/assinaturas idempotente por consulta+termo; 409 se encerrada).
 * O tablet desembrulha o envelope de `enviarAssinaturaPelaFila` e registra o DTO REAL (id), nunca o envelope.
 */
import React, { useEffect, useState } from 'react';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import '@testing-library/jest-dom';
import { Step3Termos } from '../../components/journey/Step4LGPD.jsx';
import { useAtendimentoServidor } from '../../components/hooks/useAtendimentoServidor.js';
import { useTermosConsulta } from '../../components/hooks/useTermosConsulta.js';
import { PERMISSOES } from '../../constants/permissoes.js';
import { setOrgId, termosApi, termoAssinaturaApi, organizacaoApi } from '../../services/api.js';
import { avisos } from '../consulta/canalAvisosTeste.jsx';
import { IDS } from '../encerrar/cenariosEncerrar.js';
import {
  criarServidorEncerrarFalso,
  ORG_ID,
  ROLE_USER_ID,
  storageFalso,
} from '../encerrar/servidorEncerrarFalso.js';

vi.mock('../../lib/supabaseClient.js', async () => (await import('../encerrar/servidorEncerrarFalso.js')).supabaseFalso());
vi.mock('../../services/api.js', async (importOriginal) => {
  const real = await importOriginal();
  return {
    ...real,
    termosApi: { ...real.termosApi, list: vi.fn(), resolver: vi.fn() },
    organizacaoApi: { ...real.organizacaoApi, getMinhas: vi.fn() },
    termoAssinaturaApi: { ...real.termoAssinaturaApi, listarPorPaciente: vi.fn() },
  };
});
vi.mock('../../contexts/OrgContext', async (importOriginal) => {
  const { orgComTodasPermissoes } = await import('../snapshotConsulta.jsx');
  const { PERMISSOES: P } = await import('../../constants/permissoes.js');
  return orgComTodasPermissoes(await importOriginal(), Object.values(P));
});
const toastMock = vi.hoisted(() => ({ info: vi.fn(), error: vi.fn(), success: vi.fn(), warning: vi.fn() }));
vi.mock('../../contexts/useToast.js', () => ({ useToast: () => toastMock }));

const noop = () => {};
const USUARIO = 'usr-1';
const ATENDIMENTO_ID = 'c0000000-0000-4000-8000-0000000000ae';
const T1 = 'd0000000-0000-4000-8000-000000000011';
const TITULO = 'Termo de consentimento — Toxina';
const termoCatalogo = { id: T1, titulo: TITULO, conteudo: 'Declaro que fui informada.', ativo: true };
const ESPERA = { timeout: 3000 };
const MSG_FILA = 'Assinatura guardada; será enviada quando a internet voltar.';

const linha = (termoId) => ({
  termoId, ordem: 0, lido: false, lidoEm: null, escolhido: false, termoAssinaturaId: null, statusAssinatura: null,
});
const consultaDto = (extras = {}) => ({
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
  termos: [linha(T1)],
  ...extras,
});

async function assentar() {
  await act(async () => {
    for (let i = 0; i < 5; i += 1) await new Promise((r) => setTimeout(r, 0));
  });
}

const abas = {};

/** Uma aba: hook do servidor + useTermosConsulta + Step3Termos reais. */
function Aba({ nome, storage, espiao }) {
  const [termoSelecionadoId, setTermoSelecionadoId] = useState(null);
  const [termoLido, setTermoLido] = useState(false);
  const [termosPendentesIds, setTermosPendentesIds] = useState([T1]);
  const [assinados, setAssinados] = useState([]);
  const journeyState = {
    termoSelecionadoId, setTermoSelecionadoId, termoLido, setTermoLido, termosPendentesIds, setTermosPendentesIds,
  };
  const servidor = useAtendimentoServidor({
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
  });
  const { gravarEstadoTermos } = useTermosConsulta({
    termosDaConsulta: servidor.termosDaConsulta,
    salvarTermosConsulta: servidor.salvarTermosConsulta,
    journeyState,
  });
  useEffect(() => {
    abas[nome].servidor = servidor;
  });
  const linhaT1 = (servidor.termosDaConsulta || []).find((t) => t.termoId === T1);
  return (
    <>
      <div data-testid={`status-${nome}`}>{`status=${linhaT1?.statusAssinatura ?? 'nenhum'};id=${linhaT1?.termoAssinaturaId ?? 'nenhum'}`}</div>
      <div data-testid={`naoentraram-${nome}`}>
        {(servidor.alteracoesNaoEntraram?.itens || []).map((i) => i.rotulo).join('|')}
      </div>
      <Step3Termos
        setTermoLido={setTermoLido}
        termoAssinaturaDataUrl=""
        setTermoAssinaturaDataUrl={noop}
        setTermoAssinado={noop}
        profissionalAssinaturaDataUrl="data:image/png;base64,PROF"
        setProfissionalAssinaturaDataUrl={noop}
        setStep4Errors={noop}
        termosAssinados={assinados}
        setTermosAssinados={setAssinados}
        termosPendentesIds={termosPendentesIds}
        setTermosPendentesIds={setTermosPendentesIds}
        termosDaConsulta={servidor.termosDaConsulta}
        gravarEstadoTermos={gravarEstadoTermos}
        enviarAssinaturaPelaFila={servidor.enviarAssinaturaPelaFila}
        termoTitulo=""
        termoConteudo=""
        onTermoChange={setTermoSelecionadoId}
        onAssinaturaSalva={espiao}
        pacienteId={IDS.PACIENTE}
        procedimentoFeitoId={null}
        roleUserId="ru-1"
        pacienteCtx={{ nome: 'Ana', cpf: '1', telefone: '1' }}
        clinicaCtx={{ nome: 'Clínica', cnpj: '1', endereco: 'R', telefone: '1' }}
        profissionalCtx={{ nome: 'Dra', cpf: '1', telefone: '1' }}
        onConcluir={noop}
        catalogoIds={[]}
        exigirFilaVinculo={false}
        atendimentoId={ATENDIMENTO_ID}
      />
    </>
  );
}

function stubCanvas() {
  const ctx = {
    setTransform: noop, clearRect: noop, beginPath: noop, moveTo: noop, lineTo: noop, stroke: noop, drawImage: noop,
  };
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(ctx);
  vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue('data:image/png;base64,PAC');
  vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} unobserve() {} });
}

describe('Assinatura de termo: envelope da fila ponta a ponta', () => {
  let srv;
  let estado;
  let offline;
  let chamadas;
  let rotaPostCustom;

  const posts = () => chamadas.filter((c) => c.method === 'POST' && /\/termos\/assinaturas$/.test(c.path));
  const linhasServidor = () => Object.keys(estado.assinaturas || {});

  /** Monta uma aba, adota a consulta e devolve o container + espião. */
  async function montarAba(nome, storage = storageFalso()) {
    abas[nome] = { storage };
    const espiao = vi.fn();
    abas[nome].espiao = espiao;
    const r = render(<Aba nome={nome} storage={storage} espiao={espiao} />, { wrapper: avisos.Wrapper });
    await assentar();
    act(() => {
      abas[nome].servidor.adotar(estado.dto);
    });
    await assentar();
    expect(abas[nome].servidor.atual?.id).toBe(ATENDIMENTO_ID);
    return { ...r, nome, espiao, q: within(r.container) };
  }

  async function abrirTermoEPrepararAssinatura(aba) {
    fireEvent.click(await aba.q.findByRole('button', { name: 'Ler e Assinar' }));
    await assentar();
    // O "lido" automatico sai num PUT /termos; espera sair para a consulta so ser encerrada depois dele.
    await waitFor(() => expect(chamadas.some((c) => c.method === 'PUT' && /\/termos$/.test(c.path))).toBe(true), ESPERA);
    await assentar();
    fireEvent.click(await aba.q.findByRole('button', { name: 'Solicitar Assinatura' }));
    fireEvent.click(await aba.q.findByText('Neste Dispositivo'));
    const canvas = aba.container.querySelector('canvas');
    fireEvent.pointerDown(canvas, { clientX: 5, clientY: 5 });
    fireEvent.pointerMove(canvas, { clientX: 20, clientY: 20 });
    fireEvent.pointerUp(canvas);
    const confirmar = await aba.q.findByRole('button', { name: 'Confirmar assinatura' });
    await waitFor(() => expect(confirmar).toBeEnabled());
    return confirmar;
  }

  async function confirmar(botao) {
    await act(async () => {
      fireEvent.click(botao);
    });
    await assentar();
  }

  function emitirAviso() {
    act(() => {
      avisos.emitirAviso('ATENDIMENTO.SESSAO_ALTERADA', ATENDIMENTO_ID, { atendimentoId: ATENDIMENTO_ID });
    });
  }

  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
    estado = { dto: consultaDto() };
    offline = false;
    chamadas = [];
    rotaPostCustom = null;
    srv = criarServidorEncerrarFalso({ permissoes: Object.values(PERMISSOES), estado });
    vi.stubGlobal('fetch', async (url, init = {}) => {
      const method = String(init.method || 'GET').toUpperCase();
      const u = new URL(String(url), 'http://localhost');
      if (u.hostname === 'api.ipify.org') throw new TypeError('sem rede externa');
      let corpoJson = null;
      try {
        corpoJson = typeof init.body === 'string' ? JSON.parse(init.body) : null;
      } catch {
        corpoJson = null;
      }
      chamadas.push({ method, path: u.pathname, body: corpoJson });
      const ehPost = method === 'POST' && /\/termos\/assinaturas$/.test(u.pathname);
      if (offline && ehPost) throw new TypeError('Failed to fetch');
      if (rotaPostCustom && ehPost) return rotaPostCustom();
      return srv.fetchFalso(url, init);
    });
    vi.stubGlobal('matchMedia', vi.fn((query) => ({
      matches: false, media: query, onchange: null, addListener: noop, removeListener: noop,
      addEventListener: noop, removeEventListener: noop, dispatchEvent: () => false,
    })));
    if (!URL.createObjectURL) URL.createObjectURL = () => 'blob:teste';
    stubCanvas();
    setOrgId(ORG_ID);
    termosApi.list.mockResolvedValue([termoCatalogo]);
    termosApi.resolver.mockResolvedValue(null);
    organizacaoApi.getMinhas.mockResolvedValue([]);
    termoAssinaturaApi.listarPorPaciente.mockResolvedValue([]);
  });
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    setOrgId(null);
  });

  it('(a) hook real: 1 POST com atendimentoId; registra o DTO real (id), não o envelope; ASSINADO na própria aba', async () => {
    const aba = await montarAba('A');
    await confirmar(await abrirTermoEPrepararAssinatura(aba));

    await waitFor(() => expect(posts()).toHaveLength(1), ESPERA);
    expect(posts()[0].body).toMatchObject({ termoId: T1, atendimentoId: ATENDIMENTO_ID });
    await waitFor(() => expect(aba.espiao).toHaveBeenCalledTimes(1), ESPERA);
    const arg = aba.espiao.mock.calls[0][0];
    expect(arg).not.toHaveProperty('naFila');
    expect(arg).not.toHaveProperty('ok');
    expect(arg.id).toBeDefined();
    expect(arg.id).toBe(estado.assinaturas[`${ATENDIMENTO_ID}:${T1}`].id);
    expect(toastMock.error).not.toHaveBeenCalled();

    emitirAviso();
    await waitFor(() => {
      expect(screen.getByTestId('status-A')).toHaveTextContent(`status=ASSINADO;id=${arg.id}`);
    }, ESPERA);
  });

  it('(b) sem internet: toast.info, modal fecha, nada registrado, fica no storage; a rede volta e 1 POST sobe', async () => {
    const aba = await montarAba('A');
    offline = true;
    await confirmar(await abrirTermoEPrepararAssinatura(aba));

    await waitFor(() => expect(toastMock.info).toHaveBeenCalledWith(MSG_FILA), ESPERA);
    expect(screen.queryByRole('button', { name: 'Confirmar assinatura' })).not.toBeInTheDocument();
    expect(aba.espiao).not.toHaveBeenCalled();
    expect(toastMock.success).not.toHaveBeenCalled();
    expect(toastMock.error).not.toHaveBeenCalled();
    expect(linhasServidor()).toHaveLength(0);
    expect(screen.getByTestId('status-A')).toHaveTextContent('status=nenhum');
    let guardado = '';
    for (let i = 0; i < abas.A.storage.length; i += 1) guardado += abas.A.storage.getItem(abas.A.storage.key(i));
    expect(guardado).toContain(`assinatura:${T1}`);

    // A internet volta; o retry da fila (3 s) reenvia sozinho.
    offline = false;
    await waitFor(() => expect(linhasServidor()).toHaveLength(1), { timeout: 9000 });
    emitirAviso();
    await waitFor(() => {
      expect(screen.getByTestId('status-A')).toHaveTextContent('status=ASSINADO');
    }, { timeout: 9000 });
    const bemSucedidos = srv.escritas.filter((e) => e.path === '/api/v1/termos/assinaturas' && e.status < 300);
    expect(bemSucedidos).toHaveLength(1);
  }, 25000);

  it('(c) duas abas assinam o mesmo termo: 1 linha, 201 e 200, sem erro, mesmo id nas duas', async () => {
    const abaA = await montarAba('A');
    const abaB = await montarAba('B');
    const botaoA = await abrirTermoEPrepararAssinatura(abaA);
    const botaoB = await abrirTermoEPrepararAssinatura(abaB);

    await act(async () => {
      fireEvent.click(botaoA);
      fireEvent.click(botaoB);
    });
    await assentar();

    await waitFor(() => {
      expect(abaA.espiao).toHaveBeenCalledTimes(1);
      expect(abaB.espiao).toHaveBeenCalledTimes(1);
    }, ESPERA);
    expect(linhasServidor()).toHaveLength(1);
    const status = srv.escritas.filter((e) => e.path === '/api/v1/termos/assinaturas').map((e) => e.status).sort();
    expect(status).toEqual([200, 201]);
    expect(toastMock.error).not.toHaveBeenCalled();
    expect(screen.queryByText(/Erro ao salvar assinatura/)).not.toBeInTheDocument();
    const a = abaA.espiao.mock.calls[0][0];
    const b = abaB.espiao.mock.calls[0][0];
    expect(a).not.toHaveProperty('naFila');
    expect(b).not.toHaveProperty('naFila');
    expect(a.id).toBeDefined();
    expect(a.id).toBe(b.id);
  });

  it('(d) consulta encerrada enquanto assina: 409 "já foi fechada" -> toast.warning, modal fecha, alteracoesNaoEntraram', async () => {
    const aba = await montarAba('A');
    const botao = await abrirTermoEPrepararAssinatura(aba);
    estado.dto = { ...estado.dto, status: 'encerrado' };
    await confirmar(botao);

    await waitFor(() => expect(posts()).toHaveLength(1), ESPERA);
    expect(srv.escritas.find((e) => e.path === '/api/v1/termos/assinaturas')?.status).toBe(409);
    await waitFor(() => {
      expect(toastMock.warning).toHaveBeenCalledWith('A consulta já foi encerrada; a assinatura não entrou.');
    }, ESPERA);
    expect(screen.queryByRole('button', { name: 'Confirmar assinatura' })).not.toBeInTheDocument();
    expect(aba.espiao).not.toHaveBeenCalled();
    expect(toastMock.error).not.toHaveBeenCalled();
    await waitFor(() => {
      expect(abas.A.servidor.alteracoesNaoEntraram).not.toBeNull();
      expect(abas.A.servidor.alteracoesNaoEntraram.itens.map((i) => i.rotulo)).toContain('Assinatura de termo');
    }, ESPERA);
    expect(screen.getByTestId('naoentraram-A')).toHaveTextContent('Assinatura de termo');
  });

  it('(e) 409 genérico "Termo já assinado": toast.info "já foi registrado", relê, sem erro e sem registrar', async () => {
    rotaPostCustom = () => new Response(JSON.stringify({ error: 'Termo já assinado', status: 409 }), {
      status: 409, headers: { 'Content-Type': 'application/json' },
    });
    const aba = await montarAba('A');
    const antesLeituras = termoAssinaturaApi.listarPorPaciente.mock.calls.length;
    const botao = await abrirTermoEPrepararAssinatura(aba);
    await confirmar(botao);

    await waitFor(() => {
      expect(toastMock.info).toHaveBeenCalledWith('Este termo já foi registrado nesta consulta.');
    }, ESPERA);
    expect(toastMock.warning).not.toHaveBeenCalled();
    expect(toastMock.error).not.toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: 'Confirmar assinatura' })).not.toBeInTheDocument();
    expect(aba.espiao).not.toHaveBeenCalled();
    expect(abas.A.servidor.alteracoesNaoEntraram).toBeNull();
    // Com hub (termosDaConsulta é array) a releitura vem pela prop/aviso, não por listarPorPaciente.
    expect(termoAssinaturaApi.listarPorPaciente.mock.calls.length).toBe(antesLeituras);
  });
});
