/**
 * Etapa 3 (FF1): o "Finalizar Atendimento" da consulta no servidor vira um único POST /atendimentos/{id}/encerrar.
 * Espera os envios do aparelho (fotos e mapa) antes do POST; as perguntas de depois ("Salvar como padrão?" e
 * "Catálogo") só aparecem com ao menos 1 procedimento devolvido; a do catálogo, como hoje (P5), com os nomes de TODOS
 * os itens da consulta (inclusive o item só com nome); a do padrão, F5b, uma vez por item com orientações definidas,
 * com a lista que o encerrar devolveu para o procedimento desse item; a falha de uma etapa (422) mostra a
 * mensagem do servidor no toast. O aviso ENCERRADO do próprio encerrar não faz a tela sair de novo (ND18).
 */
import { act, fireEvent, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { limparAmbienteSnapshot } from '../snapshotConsulta.jsx';
import { IDS, agendaDto } from '../encerrar/cenariosEncerrar.js';
import { PNG_A_BASE64, arquivoPng, limparMidia, prepararMidia } from '../encerrar/ambienteMidia.js';
import { AVISO } from '../../services/avisos/tiposAviso.js';
import { avisos } from './canalAvisosTeste.jsx';
import {
  ATENDIMENTO_ID,
  TIMEOUT,
  assentarMuito,
  clicarBotao,
  consultaDto,
  emConsulta,
  escritasDe,
  iniciarPeloPaciente,
  montarApp,
} from './appConsulta.jsx';

vi.mock('../../lib/supabaseClient.js', async () => (await import('../encerrar/servidorEncerrarFalso.js')).supabaseFalso());
vi.mock('../../contexts/AvisosProvider.jsx', async () => (await import('./canalAvisosTeste.jsx')).avisosProviderFalso());

const ENCERRAR = new RegExp(`^/api/v1/atendimentos/${ATENDIMENTO_ID}/encerrar$`);

/** AtendimentoItemDTO (contrato do servidor). F5b: `orientacoes` = null (nunca definidas) ou lista do item. */
function itemDto({ id, ordem, catalogoProcedimentoSaudeId = null, procedimentoNome = null, nomeLivre = null, orientacoes = null }) {
  return {
    id,
    ordem,
    agendaId: null,
    agendaTipoProcedimentoCodigo: null,
    agendaProcedimentoFeitoOrigemId: null,
    catalogoProcedimentoSaudeId,
    procedimentoNome,
    planejamentoItemId: null,
    nomeLivre,
    observacaoExecucao: null,
    orientacoes,
  };
}

/** Item de `procedimentos` no EncerramentoResultadoDTO (F5b: com as orientações gravadas no procedimento). */
function procedimentoDto({ procedimentoFeitoId, atendimentoItemId, catalogoProcedimentoSaudeId, nome, orientacoes = [] }) {
  return { procedimentoFeitoId, atendimentoItemId, catalogoProcedimentoSaudeId, nome, planoConcluidoNesteFinalizar: false, orientacoes };
}

const ITEM_TOXINA = itemDto({
  id: 'i-1',
  ordem: 0,
  catalogoProcedimentoSaudeId: IDS.CATALOGO_1,
  procedimentoNome: 'Toxina botulínica',
});
const EVITAR_SOL = { descricao: 'Evitar sol por 48 horas', checado: true, ordem: 0 };
const NAO_DEITAR = { descricao: 'Não deitar por 4 horas', checado: true, ordem: 0 };
/** O mesmo item, com as orientações já definidas na consulta (PATCH do item, F5b). */
const ITEM_TOXINA_COM_ORIENT = { ...ITEM_TOXINA, orientacoes: [EVITAR_SOL] };
const TOAST_SUCESSO = 'Jornada finalizada com sucesso.';

/** EncerramentoResultadoDTO (contrato da rota). */
function resultado({ procedimentos = [], orientacoes = [] } = {}) {
  return {
    atendimentoId: ATENDIMENTO_ID,
    status: 'encerrado',
    encerradoEm: '2026-10-06T13:10:00Z',
    procedimentos,
    orientacoes,
  };
}

/** Rotas de uma consulta com id fixo; o POST /encerrar responde `respostaEncerrar()`. */
function rotasDaConsulta(estado, respostaEncerrar) {
  return [
    ['POST', ENCERRAR, () => respostaEncerrar()],
    ['POST', /^\/api\/v1\/atendimentos$/, () => estado.dto],
    ['GET', new RegExp(`^/api/v1/atendimentos/${ATENDIMENTO_ID}$`), () => estado.dto],
  ];
}

async function finalizarPeloHub() {
  clicarBotao(/Encerrar consulta/);
  await assentarMuito();
  clicarBotao(/^Finalizar Atendimento$/);
  await assentarMuito(6);
}

async function esperar(ms) {
  await act(async () => {
    await new Promise((r) => setTimeout(r, ms));
  });
}

const perguntasNaTela = () => screen.queryAllByText(/^(Salvar como padrão\?|Catálogo)$/);
const escritasDoEncerrarDeHoje = (srv) => srv.escritas.filter((e) => /\/(procedimentos|agendas|mapas)/.test(e.path));

describe('encerrar da consulta no servidor (Etapa 3)', () => {
  afterEach(() => {
    limparMidia();
    limparAmbienteSnapshot();
    sessionStorage.clear();
    localStorage.clear();
  });

  it('consulta sem procedimento devolvido: um POST /encerrar, nenhuma pergunta e a tela sai', async () => {
    const estado = { dto: consultaDto() };
    const srv = await montarApp({
      agendas: [agendaDto({ id: IDS.AGENDA_1 })],
      rotas: rotasDaConsulta(estado, () => resultado()),
    });
    await iniciarPeloPaciente();
    expect(emConsulta()).toBe(true);
    const antes = srv.escritas.length;

    await finalizarPeloHub();

    const encerrar = escritasDe(srv, 'POST', ENCERRAR);
    expect(encerrar).toHaveLength(1);
    // F1: o corpo não leva mais `criarProcedimentos` (o servidor decide por item). F5b: a linha da agenda
    // cria o item no esvaziar da fila (1º POST /itens → ...001) e guarda o `itemId`: ele é o item ativo do encerrar.
    expect(encerrar[0].body).toEqual({
      modo: 'COMPLETO',
      pularGateTermos: true,
      itemAtivoId: 'c0000000-0000-4000-8000-000000000001',
    });
    expect(escritasDoEncerrarDeHoje({ escritas: srv.escritas.slice(antes) })).toEqual([]);
    expect(perguntasNaTela()).toEqual([]);
    expect(await screen.findByText(TOAST_SUCESSO)).toBeTruthy();
    expect(emConsulta()).toBe(false);
  }, TIMEOUT);

  it('F1: com o aparelho já sabendo do termo faltante, "Finalizar Atendimento" pelo hub não manda criarProcedimentos', async () => {
    const termoFaltante = { termoId: IDS.TERMO_1, titulo: 'Termo de toxina botulínica' };
    const estado = { dto: consultaDto({ agendaPrincipalId: IDS.AGENDA_1, itens: [ITEM_TOXINA] }) };
    const srv = await montarApp({
      agendas: [agendaDto({ id: IDS.AGENDA_1 })],
      rotas: [
        ...rotasDaConsulta(estado, () => resultado()),
        ['GET', /^\/api\/v1\/termos\/resolucao$/, () => ({
          faltantes: [termoFaltante],
          termosExigidos: [termoFaltante],
          procedimentosSemVinculo: [],
        })],
      ],
    });
    await iniciarPeloPaciente();
    expect(emConsulta()).toBe(true);

    // Tentar entrar no módulo Procedimento faz o GET da resolução: o aparelho passa a saber do termo faltante e o
    // modal de termos pendentes abre (a pessoa fica no hub).
    clicarBotao(/(^|sessões|assinatura)Procedimento/);
    await assentarMuito();
    expect(srv.leituras.some((l) => l.path.startsWith('/api/v1/termos/resolucao?'))).toBe(true);
    expect(screen.getByRole('button', { name: /Ir para a aba de termos e assinar o termo de Toxina botulínica/ })).toBeTruthy();
    clicarBotao(/^Fechar$/);
    await assentarMuito();

    await finalizarPeloHub();

    const encerrar = escritasDe(srv, 'POST', ENCERRAR);
    expect(encerrar).toHaveLength(1);
    expect(encerrar[0].body.pularGateTermos).toBe(true);
    expect(Object.keys(encerrar[0].body)).not.toContain('criarProcedimentos');
    expect(await screen.findByText(TOAST_SUCESSO)).toBeTruthy();
    expect(emConsulta()).toBe(false);
  }, TIMEOUT);

  it('com procedimento devolvido: "Salvar como padrão?" uma vez por item (decisão 6), com as orientações de cada item', async () => {
    const itemPreenchimento = itemDto({
      id: 'i-2',
      ordem: 1,
      catalogoProcedimentoSaudeId: IDS.CATALOGO_2,
      procedimentoNome: 'Preenchimento labial',
      orientacoes: [NAO_DEITAR],
    });
    const estado = { dto: consultaDto({ itens: [ITEM_TOXINA_COM_ORIENT, itemPreenchimento] }) };
    const srv = await montarApp({
      agendas: [agendaDto({ id: IDS.AGENDA_1 })],
      rotas: [
        ...rotasDaConsulta(estado, () =>
          resultado({
            procedimentos: [
              procedimentoDto({
                procedimentoFeitoId: 'p-1',
                atendimentoItemId: 'i-1',
                catalogoProcedimentoSaudeId: IDS.CATALOGO_1,
                nome: 'Toxina botulínica',
                orientacoes: [EVITAR_SOL],
              }),
              procedimentoDto({
                procedimentoFeitoId: 'p-2',
                atendimentoItemId: 'i-2',
                catalogoProcedimentoSaudeId: IDS.CATALOGO_2,
                nome: 'Preenchimento labial',
                orientacoes: [NAO_DEITAR],
              }),
            ],
            orientacoes: [EVITAR_SOL],
          }),
        ),
        ['GET', /^\/api\/v1\/catalogos$/, () => [{ id: IDS.CATALOGO_1, nomeProcedimento: 'Toxina botulínica' }]],
      ],
    });
    await iniciarPeloPaciente();

    await finalizarPeloHub();

    expect(escritasDe(srv, 'POST', ENCERRAR)).toHaveLength(1);
    // ND18: o aviso ENCERRADO do próprio encerrar chega com a pergunta aberta e não tira a pessoa da tela.
    estado.dto = consultaDto({ status: 'encerrado', encerradoEm: '2026-10-06T13:10:00Z' });
    avisos.emitirAviso(AVISO.ATENDIMENTO.ENCERRADO, ATENDIMENTO_ID, { atendimentoId: ATENDIMENTO_ID });
    await esperar(400);
    await assentarMuito();
    expect(screen.getByText('Salvar como padrão?')).toBeTruthy();
    expect(screen.queryByText(TOAST_SUCESSO)).toBeNull();
    // Uma pergunta por item, cada uma com a lista do seu item.
    expect(screen.getByText('Salvar estas orientações como padrão para "Toxina botulínica"?')).toBeTruthy();
    clicarBotao(/^Sim$/);
    await assentarMuito(6);
    expect(screen.getByText('Salvar estas orientações como padrão para "Preenchimento labial"?')).toBeTruthy();
    clicarBotao(/^Sim$/);
    await assentarMuito(6);

    const templates = srv.escritas.filter((e) => e.method === 'PUT' && /orientacoes-template$/.test(e.path));
    expect(templates.map((t) => t.body.procedimentoNome)).toEqual(['Toxina botulínica', 'Preenchimento labial']);
    expect(templates[0].body.itens).toEqual([EVITAR_SOL]);
    expect(templates[1].body.itens).toEqual([NAO_DEITAR]);

    // Os dois itens têm catálogo: nenhuma pergunta de catálogo, mesmo fora da lista de /catalogos (regra de hoje).
    expect(perguntasNaTela()).toEqual([]);
    expect(await screen.findAllByText(TOAST_SUCESSO)).toHaveLength(1);
    expect(emConsulta()).toBe(false);
  }, TIMEOUT);

  it('consulta mista (1 item com catálogo + 1 só nome): as perguntas de hoje, com os nomes de todos os itens (P5)', async () => {
    const itemSoNome = itemDto({ id: 'i-2', ordem: 1, nomeLivre: 'Peeling caseiro' });
    const estado = { dto: consultaDto({ itens: [ITEM_TOXINA_COM_ORIENT, itemSoNome] }) };
    const srv = await montarApp({
      agendas: [agendaDto({ id: IDS.AGENDA_1 })],
      rotas: [
        // O item só com nome não vira procedimento: o servidor devolve só o do catálogo.
        ...rotasDaConsulta(estado, () =>
          resultado({
            procedimentos: [
              procedimentoDto({
                procedimentoFeitoId: 'p-1',
                atendimentoItemId: 'i-1',
                catalogoProcedimentoSaudeId: IDS.CATALOGO_1,
                nome: 'Toxina botulínica',
                orientacoes: [EVITAR_SOL],
              }),
            ],
            orientacoes: [EVITAR_SOL],
          }),
        ),
        ['GET', /^\/api\/v1\/catalogos$/, () => [{ id: IDS.CATALOGO_1, nomeProcedimento: 'Toxina botulínica' }]],
      ],
    });
    await iniciarPeloPaciente();

    await finalizarPeloHub();

    expect(escritasDe(srv, 'POST', ENCERRAR)).toHaveLength(1);
    expect(screen.getByText('Salvar como padrão?')).toBeTruthy();
    // Só o item com orientações definidas pergunta (o item só com nome nunca as definiu: `orientacoes` nula).
    expect(screen.getByText('Salvar estas orientações como padrão para "Toxina botulínica"?')).toBeTruthy();
    expect(screen.queryByText(/padrão para "Peeling caseiro"/)).toBeNull();
    clicarBotao(/^Sim$/);
    await assentarMuito();

    const templates = srv.escritas.filter((e) => e.method === 'PUT' && /orientacoes-template$/.test(e.path));
    expect(templates.map((t) => t.body.procedimentoNome)).toEqual(['Toxina botulínica']);
    expect(templates[0].body.itens).toEqual([EVITAR_SOL]);

    // "Toxina botulínica" tem catálogo: só o item só com nome pergunta (P5: os nomes vêm de todos os itens).
    expect(screen.getByText('Catálogo')).toBeTruthy();
    expect(
      screen.getByText('O procedimento "Peeling caseiro" não está no catálogo. Deseja cadastrá-lo?'),
    ).toBeTruthy();
    expect(screen.queryByText(/O procedimento "Toxina botulínica" não está no catálogo/)).toBeNull();
    clicarBotao(/^Sim$/);
    await assentarMuito(6);

    const cadastros = srv.escritas.filter((e) => e.method === 'POST' && /\/catalogos$/.test(e.path));
    expect(cadastros.map((c) => c.body)).toEqual([{ nomeProcedimento: 'Peeling caseiro' }]);
    expect(perguntasNaTela()).toEqual([]);
    expect(await screen.findAllByText(TOAST_SUCESSO)).toHaveLength(1);
    expect(emConsulta()).toBe(false);
  }, TIMEOUT);

  it('espera a foto que ainda está subindo antes do POST /encerrar', async () => {
    const estado = { dto: consultaDto() };
    const srv = await montarApp({
      agendas: [agendaDto({ id: IDS.AGENDA_1 })],
      rotas: rotasDaConsulta(estado, () => resultado()),
    });
    prepararMidia();
    let liberarFoto;
    const fotoPresa = new Promise((resolve) => {
      liberarFoto = resolve;
    });
    vi.stubGlobal('fetch', async (url, init = {}) => {
      const metodo = String(init.method || 'GET').toUpperCase();
      const caminho = new URL(String(url), 'http://localhost').pathname;
      if (metodo === 'POST' && /^\/api\/v1\/pacientes\/[^/]+\/galeria$/.test(caminho)) await fotoPresa;
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

    await finalizarPeloHub();
    expect(escritasDe(srv, 'POST', ENCERRAR)).toHaveLength(0);
    expect(emConsulta()).toBe(true);

    liberarFoto();
    await assentarMuito(6);

    const ordem = srv.escritasConsulta.map((e) => e.path);
    const foto = ordem.findIndex((p) => /\/galeria$/.test(p));
    const encerrar = ordem.findIndex((p) => ENCERRAR.test(p));
    expect(foto).toBeGreaterThanOrEqual(0);
    expect(encerrar).toBeGreaterThan(foto);
    expect(await screen.findByText(TOAST_SUCESSO)).toBeTruthy();
    expect(emConsulta()).toBe(false);
  }, TIMEOUT);

  it('falha numa etapa (422): o toast mostra a mensagem da etapa e a tela fica na consulta', async () => {
    const estado = { dto: consultaDto() };
    const mensagem = 'Não foi possível finalizar o procedimento: a agenda já foi alterada.';
    const srv = await montarApp({
      agendas: [agendaDto({ id: IDS.AGENDA_1 })],
      rotas: rotasDaConsulta(estado, () => ({
        status: 422,
        corpo: { error: 'ENCERRAMENTO_FALHOU', etapa: 'FINALIZAR', message: mensagem, status: 422 },
      })),
    });
    await iniciarPeloPaciente();

    await finalizarPeloHub();

    expect(escritasDe(srv, 'POST', ENCERRAR)).toHaveLength(1);
    expect(await screen.findByText(mensagem)).toBeTruthy();
    expect(screen.queryByText(/\[HTTP 422\]/)).toBeNull();
    expect(screen.queryByText(TOAST_SUCESSO)).toBeNull();
    expect(perguntasNaTela()).toEqual([]);
    expect(emConsulta()).toBe(true);
  }, TIMEOUT);
});
