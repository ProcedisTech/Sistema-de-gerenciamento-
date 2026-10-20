/**
 * "Apenas Sair (Manter em andamento)" pelo hub (decisão de 11/10: a pausa não existe mais). Espera as fotos, o mapa e
 * a fila; nenhuma rota de consulta (a consulta continua aberta no servidor); toast "Rascunho salvo com sucesso." só
 * depois dos envios; a barra do topo mostra a consulta com o tempo e "minhas" é recarregado. A consulta acompanhada não
 * se perde quando os efeitos do app rodam de novo na mesma clínica (hot update). Consulta não resolvida → toast de erro,
 * sem sucesso, e a tela não sai. Voltar pela barra busca o detalhe e não abre outra.
 */
import { simularFastRefresh } from './fastRefreshTeste.js';
import { fireEvent, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { limparAmbienteSnapshot } from '../snapshotConsulta.jsx';
import { IDS, agendaDto, pacienteDto } from '../encerrar/cenariosEncerrar.js';
import { AVISO } from '../../services/avisos/tiposAviso.js';
import { PNG_A_BASE64, arquivoPng, limparMidia, prepararMidia } from '../encerrar/ambienteMidia.js';
import { avisos } from './canalAvisosTeste.jsx';
import {
  ATENDIMENTO_ID,
  TIMEOUT,
  assentarMuito,
  clicarBotao,
  consultaDto,
  emConsulta,
  escritasDe,
  iniciarPelaAgenda,
  iniciarPeloPaciente,
  montarApp,
  resumoDto,
} from './appConsulta.jsx';

vi.mock('../../lib/supabaseClient.js', async () => (await import('../encerrar/servidorEncerrarFalso.js')).supabaseFalso());
vi.mock('../../contexts/AvisosProvider.jsx', async () => (await import('./canalAvisosTeste.jsx')).avisosProviderFalso());

const DETALHE = new RegExp(`^/api/v1/atendimentos/${ATENDIMENTO_ID}$`);
const MINHAS = /^\/api\/v1\/atendimentos\/minhas$/;
const ITENS = new RegExp(`^/api/v1/atendimentos/${ATENDIMENTO_ID}/itens$`);
/** Qualquer POST numa rota da consulta que não seja o envio de item da fila (ex.: a rota de pausa que existia). */
const POST_DE_CONSULTA_FORA_DA_FILA = new RegExp(`^/api/v1/atendimentos/${ATENDIMENTO_ID}/(?!itens$)`);
const TOAST_SUCESSO = 'Rascunho salvo com sucesso.';
const TOAST_GUARDADO = 'Rascunho guardado neste aparelho. Será enviado quando a conexão voltar.';
const TOAST_ITEM_NOVO = 'Procedimento novo guardado neste aparelho. Será enviado quando você abrir esta consulta de novo.';

/** Consulta com id fixo. `estado.dto` é o que o detalhe devolve. */
function rotasDaConsulta(estado) {
  return [
    ['POST', /^\/api\/v1\/atendimentos$/, () => estado.dto],
    ['GET', DETALHE, () => estado.respostaDetalhe?.() ?? estado.dto],
    ['GET', MINHAS, () => (estado.minhas ? [resumoDto(estado.dto)] : [])],
    ['POST', ITENS, () => estado.respostaItens?.() ?? { id: 'item-1', ordem: 0 }],
  ];
}

/**
 * Agenda → "Iniciar atendimento" → módulo Procedimento. `antesDeIniciar(srv)` roda com o app montado, antes de iniciar.
 */
async function abrirPelaAgendaEEntrarNoProcedimento(estado, antesDeIniciar) {
  const srv = await montarApp({ agendas: [agendaDto({ id: IDS.AGENDA_1 })], view: 'agenda', rotas: rotasDaConsulta(estado) });
  antesDeIniciar?.(srv);
  await iniciarPelaAgenda();
  expect(emConsulta()).toBe(true);
  clicarBotao(/^Procedimento/);
  await assentarMuito();
  expect(screen.getAllByText('Voltar ao hub').length).toBeGreaterThan(0);
  return srv;
}

/** "Voltar ao hub" → "Encerrar consulta" → "Apenas Sair (Manter em andamento)". */
async function voltarAoHubEApenasSair() {
  clicarBotao(/Voltar ao hub/);
  await assentarMuito();
  expect(emConsulta()).toBe(true);
  clicarBotao(/Encerrar consulta/);
  await assentarMuito();
  clicarBotao('Apenas Sair (Manter em andamento)');
  await assentarMuito(6);
}

const leiturasDe = (srv, re) => srv.leituras.filter((l) => re.test(l.path.split('?')[0]));

/** Chaves do sessionStorage que contêm o CPF do paciente (com ou sem pontuação). */
function chavesComCpf() {
  return Object.keys(sessionStorage).filter((k) => k.replace(/\D/g, '').includes(pacienteDto.cpf));
}

describe('"Apenas Sair" mantém a consulta aberta, sem rota de pausa', () => {
  afterEach(() => {
    limparMidia();
    limparAmbienteSnapshot();
    sessionStorage.clear();
    localStorage.clear();
  });

  it('agenda → Procedimento → hot update → hub → Apenas Sair: espera a fila, nenhuma rota de consulta, toast, barra com tempo e "minhas" recarregado', async () => {
    const estado = { dto: consultaDto(), minhas: true };
    // O item da linha da agenda sai pela fila e fica preso no servidor até liberar.
    let liberarItem;
    const itemPreso = new Promise((resolve) => {
      liberarItem = resolve;
    });
    const srv = await abrirPelaAgendaEEntrarNoProcedimento(estado, (montado) => {
      vi.stubGlobal('fetch', async (url, init = {}) => {
        const metodo = String(init.method || 'GET').toUpperCase();
        const caminho = new URL(String(url), 'http://localhost').pathname;
        if (metodo === 'POST' && ITENS.test(caminho)) await itemPreso;
        return montado.fetchFalso(url, init);
      });
    });

    // Os efeitos do app rodam de novo com a mesma clínica (no `npm run dev`, a cada arquivo salvo).
    await simularFastRefresh('AppRefactoredInner');
    await assentarMuito(6);
    const minhasAntes = leiturasDe(srv, MINHAS).length;

    await voltarAoHubEApenasSair();

    expect(screen.queryByText(TOAST_SUCESSO)).toBeNull();
    expect(emConsulta()).toBe(true);

    liberarItem();
    await assentarMuito(6);

    expect(escritasDe(srv, 'POST', ITENS)).toHaveLength(1);
    expect(escritasDe(srv, 'POST', POST_DE_CONSULTA_FORA_DA_FILA)).toEqual([]);
    expect(await screen.findByText(TOAST_SUCESSO)).toBeTruthy();
    expect(screen.queryByText(/guardado neste aparelho/)).toBeNull();
    expect(emConsulta()).toBe(false);
    expect(leiturasDe(srv, MINHAS).length).toBeGreaterThan(minhasAntes);
    const atalho = screen.getByRole('button', { name: 'Voltar à consulta de Maria Souza' });
    // 09:30 → 10:00 na clínica (iniciadoEm do servidor).
    expect(atalho.textContent).toContain('30 min');
    expect(atalho.textContent).not.toContain('Pausada');
    // Nenhuma chave do sessionStorage leva o CPF do paciente (o horário de início não vai mais para lá).
    expect(chavesComCpf()).toEqual([]);
  }, TIMEOUT);

  it('servidor fora: o procedimento novo não sai → toast "abrir esta consulta de novo" (não "quando a conexão voltar"), e só sai ao voltar', async () => {
    const estado = {
      dto: consultaDto(),
      minhas: true,
      respostaItens: () => ({ status: 503, corpo: { message: 'Fora do ar' } }),
    };
    const srv = await abrirPelaAgendaEEntrarNoProcedimento(estado);

    await voltarAoHubEApenasSair();

    expect(escritasDe(srv, 'POST', ITENS).length).toBeGreaterThanOrEqual(1);
    // O que sobrou é o item da linha da agenda (POST /itens, procedimento novo).
    expect(await screen.findByText(TOAST_ITEM_NOVO)).toBeTruthy();
    expect(screen.queryByText(TOAST_GUARDADO)).toBeNull();
    expect(screen.queryByText(TOAST_SUCESSO)).toBeNull();
    expect(screen.queryByText(/Não feche esta aba/)).toBeNull();
    expect(emConsulta()).toBe(false);
    expect(Object.keys(sessionStorage).some((k) => k.startsWith('procedi_consulta_fila_usr-1_'))).toBe(true);

    // A conexão volta e passa a espera da retentativa (3 s; o relógio do teste é fixo, então é avançado à mão):
    // fora da consulta, o procedimento novo não sai.
    estado.respostaItens = undefined;
    const postsFora = escritasDe(srv, 'POST', ITENS).length;
    vi.setSystemTime(new Date(Date.now() + 4000));
    await new Promise((r) => setTimeout(r, 3500));
    await assentarMuito(6);
    expect(escritasDe(srv, 'POST', ITENS)).toHaveLength(postsFora);

    // Só ao abrir esta consulta de novo ele sai (depois do debounce de 700 ms da fila).
    clicarBotao('Voltar à consulta de Maria Souza');
    await assentarMuito(6);
    expect(emConsulta()).toBe(true);
    vi.setSystemTime(new Date(Date.now() + 1000));
    await new Promise((r) => setTimeout(r, 1000));
    await assentarMuito(6);
    const posts = escritasDe(srv, 'POST', ITENS);
    expect(posts).toHaveLength(postsFora + 1);
    expect(posts.at(-1).status).toBe(200);
  }, TIMEOUT);

  it('foto que não subiu (fila vazia): toast "salvo" + quantas fotos não foram e que não ficam guardadas (sem prometer reenvio)', async () => {
    const estado = { dto: consultaDto() };
    const srv = await montarApp({ agendas: [agendaDto({ id: IDS.AGENDA_1 })], rotas: rotasDaConsulta(estado) });
    prepararMidia();
    // O envio da foto é recusado (4xx: sem novas tentativas); a foto fica só no aparelho.
    vi.stubGlobal('fetch', async (url, init = {}) => {
      const metodo = String(init.method || 'GET').toUpperCase();
      const caminho = new URL(String(url), 'http://localhost').pathname;
      if (metodo === 'POST' && /^\/api\/v1\/pacientes\/[^/]+\/galeria$/.test(caminho)) {
        return new Response(JSON.stringify({ message: 'Recusada' }), { status: 422, headers: { 'Content-Type': 'application/json' } });
      }
      return srv.fetchFalso(url, init);
    });
    await iniciarPeloPaciente();
    clicarBotao(/(^|sessões|assinatura)Avaliação/);
    await assentarMuito();
    const secao = screen.getByText('Fotos da avaliação').closest('.mb-2').parentElement;
    fireEvent.change(secao.querySelector('input[type="file"]'), {
      target: { files: [arquivoPng('avaliacao-1.png', PNG_A_BASE64)] },
    });
    await assentarMuito();
    clicarBotao(/Concluir Avaliação/);
    await assentarMuito();

    clicarBotao(/Encerrar consulta/);
    await assentarMuito();
    clicarBotao('Apenas Sair (Manter em andamento)');
    await assentarMuito(6);

    // A fila esvaziou (nada recusado nela); só a foto ficou no aparelho.
    expect(escritasDe(srv, 'POST', ITENS).every((e) => e.status === 200)).toBe(true);
    expect(
      await screen.findByText(`${TOAST_SUCESSO} Não foi possível enviar 1 foto. Ela não fica guardada: envie de novo.`),
    ).toBeTruthy();
    expect(screen.queryByText(/guardado neste aparelho/)).toBeNull();
    expect(screen.queryByText(/Não feche esta aba/)).toBeNull();
    expect(emConsulta()).toBe(false);
  }, TIMEOUT);

  it('depois do Apenas Sair, voltar pela barra busca o detalhe e entra na mesma consulta sem abrir outra', async () => {
    const estado = { dto: consultaDto(), minhas: true };
    const srv = await abrirPelaAgendaEEntrarNoProcedimento(estado);
    await voltarAoHubEApenasSair();
    expect(emConsulta()).toBe(false);
    const abrirAntes = escritasDe(srv, 'POST', /^\/api\/v1\/atendimentos$/).length;
    const detalheAntes = leiturasDe(srv, DETALHE).length;

    clicarBotao('Voltar à consulta de Maria Souza');
    await assentarMuito(6);

    expect(emConsulta()).toBe(true);
    expect(leiturasDe(srv, DETALHE).length).toBe(detalheAntes + 1);
    expect(escritasDe(srv, 'POST', /^\/api\/v1\/atendimentos$/).length).toBe(abrirAntes);
  }, TIMEOUT);

  it('sem consulta resolvida (a rebusca devolveu 404): toast de erro, nenhum sucesso e a tela não sai', async () => {
    const estado = { dto: consultaDto() };
    const srv = await abrirPelaAgendaEEntrarNoProcedimento(estado);

    estado.respostaDetalhe = () => ({ status: 404, corpo: { message: 'Consulta não encontrada' } });
    avisos.emitirAviso(AVISO.ATENDIMENTO.SESSAO_ALTERADA, ATENDIMENTO_ID, { atendimentoId: ATENDIMENTO_ID });
    await new Promise((resolve) => setTimeout(resolve, 320));
    await assentarMuito(6);

    await voltarAoHubEApenasSair();

    expect(escritasDe(srv, 'POST', POST_DE_CONSULTA_FORA_DA_FILA)).toEqual([]);
    expect(await screen.findByText('Consulta não encontrada no servidor. Recarregue a página.')).toBeTruthy();
    expect(screen.queryByText(TOAST_SUCESSO)).toBeNull();
    expect(emConsulta()).toBe(true);
  }, TIMEOUT);
});
