/**
 * F6b (testador F2): atalho no App real (trava de clique duplo, falhas com aviso, lista `minhas` revalidada sem
 * o botão sumir) e campo em foco em duas abas (o remoto não sobrescreve o campo focado; ao sair vale o local
 * mudado ou o remoto, com o aviso "Alterado em outro aparelho").
 * Atalho: AppRoot real + servidor falso. Foco: duas `renderHook` (molde de queixaDuasAbas) com DOM real
 * (`textarea[data-campo-consulta]` + focusin/focusout) num servidor falso com `estado` compartilhado.
 */
import { useState } from 'react';
import { act, renderHook, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { limparAmbienteSnapshot } from '../snapshotConsulta.jsx';
import { useAtendimentoServidor } from '../../components/hooks/useAtendimentoServidor.js';
import { PERMISSOES } from '../../constants/permissoes.js';
import { setOrgId } from '../../services/api';
import { avisos } from './canalAvisosTeste.jsx';
import { IDS } from '../encerrar/cenariosEncerrar.js';
import {
  criarServidorEncerrarFalso,
  ORG_ID,
  ROLE_USER_ID,
  storageFalso,
} from '../encerrar/servidorEncerrarFalso.js';
import {
  ATENDIMENTO_ID,
  TIMEOUT,
  assentarMuito,
  clicarBotao,
  consultaDto,
  emConsulta,
  montarApp,
  resumoDto,
} from './appConsulta.jsx';

vi.mock('../../lib/supabaseClient.js', async () => (await import('../encerrar/servidorEncerrarFalso.js')).supabaseFalso());
vi.mock('../../contexts/AvisosProvider.jsx', async () => (await import('./canalAvisosTeste.jsx')).avisosProviderFalso());

const ESPERA = { timeout: 3000 };
const OUTRO_PACIENTE_ID = '44444444-4444-4444-8444-444444444444';
const NOME_ATALHO = 'Voltar à consulta de Maria Souza';
const AVISO = 'Alterado em outro aparelho';
/** F2: a pessoa digitou no campo em foco e saiu com remoto em espera diferente: o local vence e o toast diz isso. */
const AVISO_SOBRESCREVEU = 'Sua alteração sobrescreveu a de outro aparelho';
const detalhePath = `/api/v1/atendimentos/${ATENDIMENTO_ID}`;
const reDetalhe = new RegExp(`^${detalhePath}$`);
const reMinhas = /^\/api\/v1\/atendimentos\/minhas$/;

function portaoNovo() {
  let liberar;
  const promessa = new Promise((r) => {
    liberar = r;
  });
  return { promessa, liberar };
}

describe('atalho da consulta no App real (F6b)', () => {
  afterEach(() => {
    limparAmbienteSnapshot();
    sessionStorage.clear();
    localStorage.clear();
  });

  it('(a) detalhe preso: 1º clique mostra Abrindo…, disabled e aria-busy; 2º clique não lê de novo; ao liberar entra 1 vez', async () => {
    const minha = consultaDto();
    const portao = portaoNovo();
    let chegadas = 0;
    await montarApp({
      view: 'pacientes',
      rotas: [
        ['GET', reMinhas, () => [resumoDto(minha)]],
        ['GET', reDetalhe, async () => {
          chegadas += 1;
          await portao.promessa;
          return minha;
        }],
      ],
    });
    const leiturasDetalhe = () => chegadas;
    expect(leiturasDetalhe()).toBe(0);

    clicarBotao(NOME_ATALHO);
    await waitFor(() => {
      expect(leiturasDetalhe()).toBe(1);
      const b = screen.getByRole('button', { name: NOME_ATALHO });
      expect(b.textContent).toContain('Abrindo…');
      expect(b.disabled).toBe(true);
      expect(b.getAttribute('aria-busy')).toBe('true');
    }, ESPERA);

    clicarBotao(NOME_ATALHO);
    await assentarMuito(2);
    expect(leiturasDetalhe()).toBe(1);
    expect(emConsulta()).toBe(false);

    portao.liberar();
    await waitFor(() => expect(emConsulta()).toBe(true), ESPERA);
    await assentarMuito(2);
    expect(leiturasDetalhe()).toBe(1);
  }, TIMEOUT);

  it('(b) detalhe encerrado: toast de falha e o botão volta ao normal (clicável de novo)', async () => {
    const minha = consultaDto();
    const fechada = consultaDto({ status: 'encerrado' });
    const srv = await montarApp({
      view: 'pacientes',
      rotas: [
        ['GET', reMinhas, () => [resumoDto(minha)]],
        ['GET', reDetalhe, () => fechada],
      ],
    });

    clicarBotao(NOME_ATALHO);
    await waitFor(() => {
      expect(screen.getAllByText('Não foi possível abrir a consulta. Ela pode ter sido encerrada.').length).toBeGreaterThan(0);
    }, ESPERA);
    await assentarMuito(2);
    expect(emConsulta()).toBe(false);
    const b = screen.getByRole('button', { name: NOME_ATALHO });
    expect(b.disabled).toBe(false);
    expect(b.getAttribute('aria-busy')).toBeNull();
    expect(b.textContent).not.toContain('Abrindo…');
    const antes = srv.leituras.filter((l) => l.path === detalhePath).length;
    clicarBotao(NOME_ATALHO);
    await waitFor(() => {
      expect(srv.leituras.filter((l) => l.path === detalhePath).length).toBeGreaterThan(antes);
    }, ESPERA);
  }, TIMEOUT);

  it('(b) paciente inexistente: toast "Paciente da consulta não foi encontrado."', async () => {
    const minha = consultaDto({ pacienteId: OUTRO_PACIENTE_ID, pacienteCpf: '11144477735', pacienteNome: 'João Lima' });
    await montarApp({
      view: 'pacientes',
      rotas: [
        ['GET', reMinhas, () => [resumoDto(minha)]],
        ['GET', reDetalhe, () => minha],
        ['GET', new RegExp(`^/api/v1/pacientes/${OUTRO_PACIENTE_ID}$`), () => null],
      ],
    });
    clicarBotao('Voltar à consulta de João Lima');
    await waitFor(() => {
      expect(screen.getAllByText('Paciente da consulta não foi encontrado.').length).toBeGreaterThan(0);
    }, ESPERA);
    expect(emConsulta()).toBe(false);
    expect(screen.getByRole('button', { name: 'Voltar à consulta de João Lima' }).disabled).toBe(false);
  }, TIMEOUT);

  it('(c) F5 simulado + recarregar: `minhas` é lida de novo (segurada) e o botão do atalho não sai do DOM', async () => {
    const minha = consultaDto();
    let leiturasMinhas = 0;
    let portao = null;
    const srv = await montarApp({
      view: 'consulta',
      rotas: [
        ['GET', reMinhas, async () => {
          leiturasMinhas += 1;
          if (portao) await portao.promessa;
          return [resumoDto(minha)];
        }],
        ['GET', reDetalhe, () => minha],
      ],
    });
    await assentarMuito(4);
    expect(screen.getByRole('button', { name: NOME_ATALHO })).toBeTruthy();

    const sumiu = [];
    const obs = new MutationObserver(() => {
      if (!screen.queryByRole('button', { name: NOME_ATALHO })) sumiu.push(true);
    });
    obs.observe(document.body, { childList: true, subtree: true, attributes: true });
    const antes = leiturasMinhas;
    portao = portaoNovo();
    avisos.emitirRecarregar();
    await waitFor(() => expect(leiturasMinhas).toBeGreaterThan(antes), ESPERA);
    // Durante a revalidação (resposta presa) o botão continua lá.
    expect(screen.getByRole('button', { name: NOME_ATALHO })).toBeTruthy();
    await assentarMuito(2);
    expect(screen.getByRole('button', { name: NOME_ATALHO })).toBeTruthy();
    portao.liberar();
    await assentarMuito(3);
    obs.disconnect();
    expect(screen.getByRole('button', { name: NOME_ATALHO })).toBeTruthy();
    expect(sumiu).toHaveLength(0);
    expect(srv.leituras.filter((l) => reMinhas.test(l.path)).length).toBeGreaterThan(1);
  }, TIMEOUT);
});

// ---------------------------------------------------------------- hook em duas abas (DOM real)

const USUARIO = 'usr-1';
const VAZIOS = { queixa: '', expectativas: '', observacoesAvaliacao: '' };

const itemDto = (obs) => ({
  id: 'i-1',
  ordem: 1,
  catalogoProcedimentoSaudeId: 'cat-1',
  procedimentoNome: 'Botox',
  observacaoExecucao: obs,
  orientacoes: null,
});

function dtoCon(extras = {}) {
  return {
    id: ATENDIMENTO_ID,
    pacienteId: IDS.PACIENTE,
    pacienteNome: 'Maria Souza',
    anfitriaoRoleUserId: ROLE_USER_ID,
    status: 'aberto',
    modulo: 'hub',
    tipoProcedimentoCodigo: 'CONSULTA',
    iniciadoEm: '2026-10-06T12:30:00Z',
    itens: [itemDto('obs0')],
    fotos: [],
    consultaAnteriorFechada: null,
    fechadaPor: null,
    queixa: 'q0',
    expectativas: null,
    observacoesAvaliacao: null,
    preenchimentoAnamneseId: null,
    ...extras,
  };
}

const assentar = () => act(async () => {
  for (let i = 0; i < 5; i += 1) await new Promise((r) => setTimeout(r, 0));
});
const esperar = (ms) => act(async () => {
  await new Promise((r) => setTimeout(r, ms));
});

function useTela({ avisar, ...props }) {
  const [sessao, setSessao] = useState([]);
  const [valores, setValores] = useState(VAZIOS);
  const servidor = useAtendimentoServidor({
    ...props,
    procedimentosSessao: sessao,
    aparelho: { setProcedimentosSessao: setSessao },
    avaliacao: { valores, aplicar: setValores },
    avisar,
  });
  return { servidor, sessao, setSessao, valores, setValores };
}

describe('campo em foco em duas abas (F6b)', () => {
  let srv;
  let estado;
  const campos = [];
  const patchesItem = () => srv.escritasConsulta.filter(
    (e) => e.method === 'PATCH' && /\/itens\/i-1$/.test(e.path),
  );
  const patchesAval = () => srv.escritasConsulta.filter(
    (e) => e.method === 'PATCH' && /\/avaliacao-texto$/.test(e.path),
  );
  const obsDe = (r) => r.result.current.sessao[0]?.observacoesExecucao;

  async function montarAba(nome) {
    const avisar = vi.fn();
    const props = {
      habilitado: true,
      orgId: ORG_ID,
      userId: USUARIO,
      emConsulta: true,
      pacienteId: IDS.PACIENTE,
      avisar,
      storage: storageFalso(),
      idDaAba: () => `aba-${nome}`,
      raizDeFoco: document.body,
    };
    const r = renderHook((p) => useTela(p), { initialProps: props, wrapper: avisos.Wrapper });
    await assentar();
    act(() => r.result.current.servidor.adotar(estado.dto));
    await assentar();
    expect(r.result.current.servidor.atual?.id).toBe(ATENDIMENTO_ID);
    return { ...r, avisar, props };
  }

  function criarCampo(chave, valor) {
    const el = document.createElement('textarea');
    el.setAttribute('data-campo-consulta', chave);
    el.value = valor;
    document.body.appendChild(el);
    campos.push(el);
    return el;
  }
  const focar = (el) => act(() => {
    el.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
  });
  const sair = (el) => act(() => {
    el.dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
  });
  const emitir = () => act(() => {
    avisos.emitirAviso('ATENDIMENTO.SESSAO_ALTERADA', ATENDIMENTO_ID, { atendimentoId: ATENDIMENTO_ID });
  });
  /** A aba A grava no servidor e avisa. */
  async function aGrava(extras) {
    estado.dto = { ...estado.dto, ...extras };
    emitir();
    await esperar(400);
    await assentar();
  }

  beforeEach(() => {
    sessionStorage.clear();
    estado = { dto: dtoCon() };
    srv = criarServidorEncerrarFalso({ permissoes: Object.values(PERMISSOES), estado });
    vi.stubGlobal('fetch', srv.fetchFalso);
    setOrgId(ORG_ID);
  });
  afterEach(() => {
    campos.splice(0).forEach((el) => el.remove());
    vi.unstubAllGlobals();
    setOrgId(null);
  });

  it('(d) obs do item em foco com "B digitando": o aviso da A não sobrescreve; ao sair 1 PATCH do local, toast, servidor com o local', async () => {
    const b = await montarAba('B');
    expect(obsDe(b)).toBe('obs0');
    const el = criarCampo('item:i-1:obs', 'obs0');
    focar(el);
    el.value = 'B digitando';
    act(() => b.result.current.setSessao((s) => s.map((l) => ({ ...l, observacoesExecucao: 'B digitando' }))));

    await aGrava({ itens: [itemDto('A gravou')] });
    expect(obsDe(b)).toBe('B digitando');
    expect(el.value).toBe('B digitando');
    expect(patchesItem()).toHaveLength(0);
    expect(b.avisar).not.toHaveBeenCalled();

    sair(el);
    await waitFor(() => expect(patchesItem()).toHaveLength(1), ESPERA);
    expect(patchesItem()[0].body).toEqual({ observacaoExecucao: 'B digitando' });
    // O toast sai com o 2xx do PATCH, não ao sair do campo.
    await waitFor(() => expect(b.avisar).toHaveBeenCalledWith('info', AVISO_SOBRESCREVEU), ESPERA);
    expect(b.avisar).not.toHaveBeenCalledWith('info', AVISO);
    expect(estado.dto.itens[0].observacaoExecucao).toBe('B digitando');
    await assentar();
    expect(obsDe(b)).toBe('B digitando');
  });

  it('(e) foco sem digitar: a A grava; ao sair o campo mostra o valor da A, ZERO PATCH e toast', async () => {
    const b = await montarAba('B');
    const el = criarCampo('item:i-1:obs', 'obs0');
    focar(el);
    await aGrava({ itens: [itemDto('A gravou')] });
    expect(obsDe(b)).toBe('obs0');
    expect(b.avisar).not.toHaveBeenCalled();

    sair(el);
    await esperar(1000);
    await assentar();
    expect(obsDe(b)).toBe('A gravou');
    expect(patchesItem()).toHaveLength(0);
    expect(b.avisar).toHaveBeenCalledWith('info', AVISO);
    expect(estado.dto.itens[0].observacaoExecucao).toBe('A gravou');
  });

  it('(f) avaliação: queixa em foco com "B digitando" não é sobrescrita; ao sair 1 PATCH da queixa e toast', async () => {
    const b = await montarAba('B');
    expect(b.result.current.valores.queixa).toBe('q0');
    const el = criarCampo('avaliacao:queixa', 'q0');
    focar(el);
    el.value = 'B digitando';
    act(() => b.result.current.setValores((v) => ({ ...v, queixa: 'B digitando' })));

    await aGrava({ queixa: 'Queixa da A' });
    expect(b.result.current.valores.queixa).toBe('B digitando');
    expect(patchesAval()).toHaveLength(0);
    expect(b.avisar).not.toHaveBeenCalled();

    sair(el);
    await waitFor(() => expect(patchesAval()).toHaveLength(1), ESPERA);
    expect(patchesAval()[0].body).toEqual({ queixa: 'B digitando' });
    // O toast sai com o 2xx do PATCH, não ao sair do campo.
    await waitFor(() => expect(b.avisar).toHaveBeenCalledWith('info', AVISO_SOBRESCREVEU), ESPERA);
    expect(b.avisar).not.toHaveBeenCalledWith('info', AVISO);
    expect(estado.dto.queixa).toBe('B digitando');
    await assentar();
    expect(b.result.current.valores.queixa).toBe('B digitando');
  });

  it('(f) avaliação: foco sem digitar; ao sair vale o remoto da A, zero PATCH e toast', async () => {
    const b = await montarAba('B');
    const el = criarCampo('avaliacao:queixa', 'q0');
    focar(el);
    await aGrava({ queixa: 'Queixa da A' });
    expect(b.result.current.valores.queixa).toBe('q0');
    sair(el);
    await esperar(1000);
    await assentar();
    expect(b.result.current.valores.queixa).toBe('Queixa da A');
    expect(patchesAval()).toHaveLength(0);
    expect(b.avisar).toHaveBeenCalledWith('info', AVISO);
  });

  // F2 (bug): a base otimista já era o texto local (PATCH aceito antes do remoto chegar), então o diff com a base
  // saía vazio: nenhum PATCH, toast "Alterado em outro aparelho" e o servidor ficava com o texto do OUTRO aparelho
  // enquanto a tela mostrava o local. Agora a comparação ao sair é com o REMOTO em espera: local vence e avisa.
  it('(h) obs: A digita, PATCH aceito, B grava; ao sair o local vence (2º PATCH), toast de sobrescrita, servidor com o local', async () => {
    const a = await montarAba('A');
    expect(obsDe(a)).toBe('obs0');
    const el = criarCampo('item:i-1:obs', 'obs0');
    focar(el);
    el.value = 'A digitou';
    act(() => a.result.current.setSessao((s) => s.map((l) => ({ ...l, observacoesExecucao: 'A digitou' }))));
    // O debounce (700 ms) passa e o PATCH da A é aceito: a base otimista agora é 'A digitou'.
    await esperar(800);
    await assentar();
    await waitFor(() => expect(patchesItem()).toHaveLength(1), ESPERA);
    expect(patchesItem()[0].body).toEqual({ observacaoExecucao: 'A digitou' });
    expect(estado.dto.itens[0].observacaoExecucao).toBe('A digitou');

    // A B grava por cima no servidor; a A continua no campo: nada muda na tela nem sai PATCH.
    await aGrava({ itens: [itemDto('B gravou')] });
    expect(obsDe(a)).toBe('A digitou');
    expect(el.value).toBe('A digitou');
    expect(patchesItem()).toHaveLength(1);
    expect(a.avisar).not.toHaveBeenCalled();

    sair(el);
    await waitFor(() => expect(patchesItem()).toHaveLength(2), ESPERA);
    expect(patchesItem()[1].body).toEqual({ observacaoExecucao: 'A digitou' });
    // O toast sai com o 2xx do PATCH, não ao sair do campo.
    await waitFor(() => expect(a.avisar).toHaveBeenCalledWith('info', AVISO_SOBRESCREVEU), ESPERA);
    expect(a.avisar).toHaveBeenCalledTimes(1);
    expect(estado.dto.itens[0].observacaoExecucao).toBe('A digitou');
    await assentar();
    expect(obsDe(a)).toBe('A digitou');
  });

  it('(h) queixa: A digita e o PATCH é aceito (onCampoAvaliacaoBlur), B grava; ao soltar o foco o local vence (2º PATCH) e avisa', async () => {
    const a = await montarAba('A');
    expect(a.result.current.valores.queixa).toBe('q0');
    const el = criarCampo('avaliacao:queixa', 'q0');
    focar(el);
    el.value = 'A digitou';
    act(() => a.result.current.setValores((v) => ({ ...v, queixa: 'A digitou' })));
    await assentar();
    // A tela chama o blur da avaliação (PATCH só desse campo) e a base otimista passa a 'A digitou'.
    let enfileirou = false;
    act(() => {
      enfileirou = a.result.current.servidor.onCampoAvaliacaoBlur('queixa');
    });
    expect(enfileirou).toBe(true);
    await waitFor(() => expect(patchesAval()).toHaveLength(1), ESPERA);
    expect(patchesAval()[0].body).toEqual({ queixa: 'A digitou' });
    expect(estado.dto.queixa).toBe('A digitou');

    await aGrava({ queixa: 'B gravou' });
    expect(a.result.current.valores.queixa).toBe('A digitou');
    expect(patchesAval()).toHaveLength(1);
    expect(a.avisar).not.toHaveBeenCalled();

    sair(el);
    await waitFor(() => expect(patchesAval()).toHaveLength(2), ESPERA);
    expect(patchesAval()[1].body).toEqual({ queixa: 'A digitou' });
    // O toast sai com o 2xx do PATCH, não ao sair do campo.
    await waitFor(() => expect(a.avisar).toHaveBeenCalledWith('info', AVISO_SOBRESCREVEU), ESPERA);
    expect(a.avisar).toHaveBeenCalledTimes(1);
    expect(estado.dto.queixa).toBe('A digitou');
    await assentar();
    expect(a.result.current.valores.queixa).toBe('A digitou');
  });

  it('(h) sem remoto em espera: digitar, PATCH aceito e sair não gera PATCH extra nem toast', async () => {
    const a = await montarAba('A');
    const el = criarCampo('item:i-1:obs', 'obs0');
    focar(el);
    el.value = 'A digitou';
    act(() => a.result.current.setSessao((s) => s.map((l) => ({ ...l, observacoesExecucao: 'A digitou' }))));
    await esperar(800);
    await assentar();
    await waitFor(() => expect(patchesItem()).toHaveLength(1), ESPERA);

    sair(el);
    await esperar(1000);
    await assentar();
    expect(patchesItem()).toHaveLength(1);
    expect(a.avisar).not.toHaveBeenCalled();
    expect(estado.dto.itens[0].observacaoExecucao).toBe('A digitou');
    expect(obsDe(a)).toBe('A digitou');
  });

  it('(g) sem foco: a B recebe o valor da A normalmente, sem toast e sem PATCH', async () => {
    const b = await montarAba('B');
    await aGrava({ itens: [itemDto('A gravou')], queixa: 'Queixa da A' });
    expect(obsDe(b)).toBe('A gravou');
    expect(b.result.current.valores.queixa).toBe('Queixa da A');
    expect(b.avisar).not.toHaveBeenCalled();
    expect(srv.escritasConsulta.filter((e) => e.method === 'PATCH')).toHaveLength(0);
  });

  it('(c, hook) mesmo dono: o efeito reexecuta (habilitado volta) e minhasCarregadas não volta a false', async () => {
    const b = await montarAba('B');
    await waitFor(() => expect(b.result.current.servidor.minhasCarregadas).toBe(true), ESPERA);
    const vistos = [];
    const sonda = () => vistos.push(b.result.current.servidor.minhasCarregadas);
    b.rerender({ ...b.props, habilitado: false });
    sonda();
    b.rerender({ ...b.props, habilitado: true });
    sonda();
    await assentar();
    sonda();
    expect(vistos).toEqual([true, true, true]);
    expect(b.result.current.servidor.minhasCarregadas).toBe(true);
  });
});
