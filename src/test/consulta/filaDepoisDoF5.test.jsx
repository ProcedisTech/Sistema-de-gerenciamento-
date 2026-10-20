/**
 * Fila de texto da consulta em segundo plano (decisão de 11/10), na tela inteira. Depois do F5 (ou da saída e de um
 * novo login da mesma pessoa), o envio guardado desta pessoa sobe quando "minhas" carrega: a tela continua fora da
 * consulta, sem GET de detalhe e sem abrir. A fila de outra pessoa na mesma aba nunca é enviada.
 */
import { fireEvent, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { limparAmbienteSnapshot } from '../snapshotConsulta.jsx';
import {
  ATENDIMENTO_ID,
  TIMEOUT,
  assentarMuito,
  clicarBotao,
  consultaDto,
  emConsulta,
  escritasDe,
  montarApp,
  resumoDto,
} from './appConsulta.jsx';

/** Sessão do Supabase que sai e volta (o falso padrão não tem `user` no login). */
vi.mock('../../lib/supabaseClient.js', async () => {
  const falso = (await import('../encerrar/servidorEncerrarFalso.js')).supabaseFalso();
  const { data } = await falso.supabase.auth.getSession();
  const session = data.session;
  let logado = true;
  Object.assign(falso.supabase.auth, {
    getSession: async () => ({ data: { session: logado ? session : null } }),
    signOut: async () => {
      logado = false;
      return { error: null };
    },
    signInWithPassword: async () => {
      logado = true;
      return { data: { session, user: session.user }, error: null };
    },
  });
  return falso;
});
vi.mock('../../contexts/AvisosProvider.jsx', async () => (await import('./canalAvisosTeste.jsx')).avisosProviderFalso());

/** Id da pessoa logada no Supabase falso. */
const USUARIO = 'usr-1';
const DETALHE = new RegExp(`^/api/v1/atendimentos/${ATENDIMENTO_ID}$`);
const PATCH_ITEM = new RegExp(`^/api/v1/atendimentos/${ATENDIMENTO_ID}/itens/i-1$`);
const ABRIR = /^\/api\/v1\/atendimentos$/;
const ITEM = { id: 'i-1', ordem: 0, agendaId: null, nomeLivre: 'Botox', catalogoProcedimentoSaudeId: null, observacaoExecucao: '' };
const ENVIO_GUARDADO = [
  {
    chave: 'item:i-1:obs',
    grupo: 'item:i-1',
    tipo: 'item',
    dados: { itemId: 'i-1', campos: { observacaoExecucao: 'Aplicado 20U na glabela' } },
  },
];
const chaveDaFila = (userId) => `procedi_consulta_fila_${userId}_${ATENDIMENTO_ID}`;

function rotas(estado) {
  return [
    ['GET', /^\/api\/v1\/atendimentos\/minhas$/, () => [resumoDto(estado.dto)]],
    ['GET', DETALHE, () => estado.dto],
    ['PATCH', PATCH_ITEM, () => estado.respostaPatch?.() ?? { ...ITEM, observacaoExecucao: 'Aplicado 20U na glabela' }],
  ];
}

const leiturasDoDetalhe = (srv) => srv.leituras.filter((l) => DETALHE.test(l.path));

describe('fila da consulta em segundo plano (tela inteira)', () => {
  afterEach(() => {
    limparAmbienteSnapshot();
    sessionStorage.clear();
    localStorage.clear();
  });

  it('F5 com 1 envio de texto guardado: o PATCH sai em segundo plano, a tela fica em Pacientes, 0 detalhe e 0 abrir', async () => {
    const estado = { dto: consultaDto({ itens: [ITEM] }) };
    const srv = await montarApp({
      view: 'consulta',
      sessao: { [chaveDaFila(USUARIO)]: JSON.stringify(ENVIO_GUARDADO) },
      rotas: rotas(estado),
    });
    await assentarMuito(4);

    const patches = escritasDe(srv, 'PATCH', PATCH_ITEM);
    expect(patches).toHaveLength(1);
    expect(patches[0].body).toEqual({ observacaoExecucao: 'Aplicado 20U na glabela' });
    expect(emConsulta()).toBe(false);
    expect(sessionStorage.getItem('activeView')).toBe('pacientes');
    expect(leiturasDoDetalhe(srv)).toHaveLength(0);
    expect(escritasDe(srv, 'POST', ABRIR)).toHaveLength(0);
    expect(sessionStorage.getItem(chaveDaFila(USUARIO))).toBeNull();
    expect(screen.getByRole('button', { name: 'Voltar à consulta de Maria Souza' })).toBeTruthy();

    // Entrar na consulta depois não reenvia o que já saiu.
    clicarBotao('Voltar à consulta de Maria Souza');
    await assentarMuito(4);
    expect(emConsulta()).toBe(true);
    expect(escritasDe(srv, 'PATCH', PATCH_ITEM)).toHaveLength(1);
  }, TIMEOUT);

  it('F5 com a fila de OUTRA pessoa na aba: nada é enviado e a fila dela fica intacta', async () => {
    const estado = { dto: consultaDto({ itens: [ITEM] }) };
    const guardada = JSON.stringify(ENVIO_GUARDADO);
    const srv = await montarApp({
      view: 'consulta',
      sessao: { [chaveDaFila('usr-outra')]: guardada },
      rotas: rotas(estado),
    });
    await assentarMuito(4);

    expect(escritasDe(srv, 'PATCH', /\/itens\//)).toHaveLength(0);
    expect(sessionStorage.getItem(chaveDaFila('usr-outra'))).toBe(guardada);
  }, TIMEOUT);

  // Deixe por último: o Supabase falso deste arquivo guarda se a pessoa está logada.
  it('saída com 1 envio pendente (servidor fora) → a mesma pessoa entra de novo → o envio sobe em segundo plano', async () => {
    const estado = {
      dto: consultaDto({ itens: [ITEM] }),
      // Sem rede: o PATCH falha e o envio fica na fila (e no sessionStorage).
      respostaPatch: () => ({ status: 503, corpo: { message: 'Fora do ar' } }),
    };
    const srv = await montarApp({ view: 'pacientes', rotas: rotas(estado) });
    clicarBotao('Voltar à consulta de Maria Souza');
    await assentarMuito(4);
    expect(emConsulta()).toBe(true);
    clicarBotao(/^Procedimento/);
    await assentarMuito();

    const rotulo = screen.getByText('Descrição detalhada do que foi realizado');
    const campo = rotulo.parentElement.querySelector('textarea');
    fireEvent.change(campo, { target: { value: 'Aplicado 20U na glabela' } });
    // O relógio da tela é falso (só Date): passa o debounce de 700 ms da fila.
    vi.setSystemTime(new Date(Date.now() + 1000));
    await new Promise((r) => setTimeout(r, 800));
    await assentarMuito(2);
    expect(escritasDe(srv, 'PATCH', PATCH_ITEM).length).toBeGreaterThanOrEqual(1);
    expect(sessionStorage.getItem(chaveDaFila(USUARIO))).not.toBeNull();

    // "Apenas Sair" (o envio falha de novo e continua guardado) e depois sai do sistema; o servidor volta logo depois.
    clicarBotao(/Voltar ao hub/);
    await assentarMuito();
    clicarBotao(/Encerrar consulta/);
    await assentarMuito();
    clicarBotao('Apenas Sair (Manter em andamento)');
    await assentarMuito(4);
    expect(emConsulta()).toBe(false);
    expect(sessionStorage.getItem(chaveDaFila(USUARIO))).not.toBeNull();
    clicarBotao(/^Sair do sistema$/i);
    await assentarMuito(4);
    expect(screen.getByPlaceholderText('E-mail ou nome cadastrado')).toBeTruthy();
    expect(sessionStorage.getItem(chaveDaFila(USUARIO))).not.toBeNull();
    estado.respostaPatch = null;
    const patchesAntes = escritasDe(srv, 'PATCH', PATCH_ITEM).length;
    const detalheAntes = leiturasDoDetalhe(srv).length;
    const abrirAntes = escritasDe(srv, 'POST', ABRIR).length;

    // A mesma pessoa entra de novo.
    fireEvent.change(screen.getByPlaceholderText('E-mail ou nome cadastrado'), { target: { value: 'beatriz@teste.com' } });
    fireEvent.change(screen.getByPlaceholderText('Sua senha'), { target: { value: 'segredo123' } });
    fireEvent.click(screen.getByRole('button', { name: 'Entrar no Sistema' }));
    await assentarMuito(8);

    const depois = escritasDe(srv, 'PATCH', PATCH_ITEM).slice(patchesAntes);
    expect(depois).toHaveLength(1);
    expect(depois[0].status).toBe(200);
    expect(depois[0].body).toEqual({ observacaoExecucao: 'Aplicado 20U na glabela' });
    expect(sessionStorage.getItem(chaveDaFila(USUARIO))).toBeNull();
    expect(emConsulta()).toBe(false);
    expect(leiturasDoDetalhe(srv).length).toBe(detalheAntes);
    expect(escritasDe(srv, 'POST', ABRIR).length).toBe(abrirAntes);
  }, TIMEOUT);
});
