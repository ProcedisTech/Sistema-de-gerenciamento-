/**
 * B-42 rodada 4, item 1: no "Concluir Retorno", se o `finalizar` deu certo e o encerrar da consulta falhou, a tela
 * nunca diz "Retorno registrado com sucesso.", não sai do Retorno e mostra o aviso de que a consulta não foi
 * encerrada. O clique seguinte só encerra: nada criado, enviado, mapeado nem finalizado de novo.
 * O ambiente (abrirRetorno) segue o de concluirRetornoPendenteEFotos.test.jsx e concluirRetornoEncerra.test.jsx.
 */
import { fireEvent, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { assentar, limparAmbienteSnapshot } from '../snapshotConsulta.jsx';
import { IDS, agendaDto } from '../encerrar/cenariosEncerrar.js';
import { PNG_A_BASE64, PNG_B_BASE64, arquivoPng, limparMidia, prepararMidia } from '../encerrar/ambienteMidia.js';
import { persistirMapaAplicacao } from '../../utils/persistirMapaAplicacao.js';
import { AVISO } from '../../services/avisos/tiposAviso.js';
import { MENSAGEM_ENVIO_PENDENTE } from '../../components/hooks/useAtendimentoServidor.js';
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
  montarApp,
} from './appConsulta.jsx';

vi.mock('../../lib/supabaseClient.js', async () => (await import('../encerrar/servidorEncerrarFalso.js')).supabaseFalso());
vi.mock('../../contexts/AvisosProvider.jsx', async () => (await import('./canalAvisosTeste.jsx')).avisosProviderFalso());
// Espião que chama o de verdade: só conta as chamadas (o código do mapa não muda).
vi.mock('../../utils/persistirMapaAplicacao.js', async (importOriginal) => {
  const real = await importOriginal();
  return { ...real, persistirMapaAplicacao: vi.fn(real.persistirMapaAplicacao) };
});

const ENCERRAR = new RegExp(`^/api/v1/atendimentos/${ATENDIMENTO_ID}/encerrar$`);
const MODULO = new RegExp(`^/api/v1/atendimentos/${ATENDIMENTO_ID}/modulo$`);
const PATCH_ITEM = new RegExp(`^/api/v1/atendimentos/${ATENDIMENTO_ID}/itens/i-1$`);
const GALERIA = /^\/api\/v1\/pacientes\/[^/]+\/galeria$/;
const FINALIZAR = /\/procedimentos\/[^/]+\/finalizar$/;
const PROCEDIMENTOS = /^\/api\/v1\/procedimentos/;
const MAPAS = /^\/api\/v1\/mapas$/;
const PF_ORIGEM = '99999999-9999-4999-8999-999999999991';
const AGENDA_ORIGEM = '99999999-9999-4999-8999-999999999992';
const AGENDA_RETORNO = '99999999-9999-4999-8999-999999999993';
const SUCESSO = 'Retorno registrado com sucesso.';
const AVISO_CONEXAO =
  'O retorno foi registrado, mas a consulta ainda não foi encerrada. Verifique a conexão e clique em Concluir Retorno de novo.';

/** Plano com o item já feito e a sessão de retorno pendente (como em concluirRetornoEncerra.test.jsx). */
const plano = {
  id: IDS.PLANO_1,
  titulo: 'Rejuvenescimento facial',
  statusCodigo: 'ATIVO',
  statusNome: 'Ativo',
  criadoEm: '2026-09-01T13:00:00.000Z',
  valorTotal: 1500,
  progresso: 0,
  itens: [
    {
      id: IDS.PLANO_ITEM_1,
      planejamentoItemId: IDS.PLANO_ITEM_1,
      planejamentoId: IDS.PLANO_1,
      catalogoProcedimentoSaudeId: IDS.CATALOGO_1,
      catalogoNome: 'Toxina botulínica',
      dataPlanejada: '2026-09-20',
      statusItem: 'FINALIZADO',
      statusItemNome: 'Finalizado',
      valorOrcado: 1500,
      procedimentoFeitoId: PF_ORIGEM,
      sessoes: [
        {
          agendaId: AGENDA_ORIGEM,
          dataAgendamento: '2026-09-20',
          horaInicio: '10:00:00',
          statusCodigo: 'realizado',
          tipoProcedimentoCodigo: 'procedimento',
          procedimentoFeitoId: PF_ORIGEM,
        },
        {
          agendaId: AGENDA_RETORNO,
          dataAgendamento: '2026-10-06',
          horaInicio: '15:00:00',
          statusCodigo: 'pendente',
          tipoProcedimentoCodigo: 'retorno',
          procedimentoFeitoOrigemId: PF_ORIGEM,
        },
      ],
    },
  ],
};

const ENCERRADO = {
  atendimentoId: ATENDIMENTO_ID,
  status: 'encerrado',
  encerradoEm: '2026-10-06T13:10:00Z',
  procedimentos: [],
  orientacoes: [],
};

/**
 * Agenda → Planejamento → "Iniciar Retorno". `encerrar(k)`: resposta da k-ésima chamada ao POST /encerrar.
 * `itemFora`: depois de abrir o Retorno, outro aparelho grava uma observação no item (aviso + rebusca: a tela a
 * adota); o "Concluir Retorno" a troca pelo texto da avaliação (aqui vazio) e o PATCH dessa troca responde 503.
 * `fotos`: na "Foto do resultado".
 * `retoqueComMarcacao`: liga o retoque, envia a foto do mapa de retoque e marca 1 ponto.
 */
async function abrirRetorno({ encerrar = () => ENCERRADO, itemFora = false, fotos = [], retoqueComMarcacao = false }) {
  const agendas = [
    agendaDto({ id: IDS.AGENDA_1, tipoCodigo: 'CONSULTA', tipoNome: 'Consulta', catalogoId: null, catalogoNome: null }),
  ];
  const estado = { dto: consultaDto({ agendaPrincipalId: IDS.AGENDA_1 }), encerrar: 0 };
  const retorno = consultaDto({
    agendaPrincipalId: IDS.AGENDA_1,
    tipoProcedimentoCodigo: 'retorno',
    procedimentoFeitoOrigemId: PF_ORIGEM,
    itens: [{
      id: 'i-1',
      ordem: 1,
      agendaId: null,
      catalogoProcedimentoSaudeId: IDS.CATALOGO_1,
      procedimentoNome: 'Toxina botulínica',
      ...(itemFora ? { agendaId: AGENDA_RETORNO } : {}),
    }],
  });
  const srv = await montarApp({
    agendas,
    rotas: [
      ['POST', ENCERRAR, () => {
        estado.encerrar += 1;
        return encerrar(estado.encerrar);
      }],
      ['POST', /^\/api\/v1\/atendimentos$/, () => estado.dto],
      ['GET', new RegExp(`^/api/v1/atendimentos/${ATENDIMENTO_ID}$`), () => estado.dto],
      ['PATCH', MODULO, () => ({})],
      ['PATCH', PATCH_ITEM, () => (itemFora ? { status: 503, corpo: { message: 'Fora do ar' } } : {})],
      ['PUT', /\/itens\/plano$/, () => {
        estado.dto = retorno;
        return retorno;
      }],
      ['GET', /^\/api\/v1\/planejamentos$/, () => [plano]],
      ['GET', /^\/api\/v1\/planejamentos\/[^/]+$/, () => plano],
      ['GET', /^\/api\/v1\/procedimentos\/paciente\/[^/]+$/, () => ({})],
    ],
  });
  await iniciarPelaAgenda();
  clicarBotao(/(^|sessões)Planejamento/);
  await assentarMuito();
  clicarBotao(/^Iniciar Retorno$/);
  await assentarMuito(6);
  if (fotos.length > 0) {
    const secao = screen.getByText('Foto do resultado').closest('.rounded-2xl');
    fireEvent.change(secao.querySelector('input[type="file"]'), { target: { files: fotos } });
    await assentarMuito();
    expect(secao.querySelectorAll('img')).toHaveLength(fotos.length);
  }
  if (retoqueComMarcacao) await marcarPontoNoRetoque();
  if (itemFora) {
    estado.dto = { ...retorno, itens: [{ ...retorno.itens[0], observacaoExecucao: 'Anotada em outro aparelho' }] };
    avisos.emitirAviso(AVISO.ATENDIMENTO.SESSAO_ALTERADA, ATENDIMENTO_ID, { atendimentoId: ATENDIMENTO_ID });
    await new Promise((resolve) => setTimeout(resolve, 320));
    await assentarMuito(6);
    // O servidor falso responde em microtarefas; no navegador o PATCH /finalizar leva tempo e a tela renderiza a troca
    // das observações (e a fila a enfileira) antes do encerrar. Um atraso de 20 ms no finalizar reproduz isso.
    vi.stubGlobal('fetch', async (url, init = {}) => {
      if (String(init.method || 'GET').toUpperCase() === 'PATCH' && FINALIZAR.test(new URL(String(url), 'http://x').pathname)) {
        await new Promise((resolve) => setTimeout(resolve, 20));
      }
      return srv.fetchFalso(url, init);
    });
  }
  return srv;
}

/** Liga o retoque, envia a foto da vista no "Mapa de retoque" e marca 1 ponto (confirma a quantidade padrão). */
async function marcarPontoNoRetoque() {
  fireEvent.click(screen.getByRole('switch'));
  await assentarMuito();
  const painel = () => screen.getByText('Mapa de retoque').closest('.rounded-2xl');
  fireEvent.change(painel().querySelector('input[type="file"]'), { target: { files: [arquivoPng('mapa.png', PNG_B_BASE64)] } });
  await assentarMuito();
  const area = painel().querySelector('.cursor-crosshair');
  if (!area) throw new Error('Área de marcação do mapa de retoque não encontrada.');
  fireEvent.pointerDown(area, { clientX: 400, clientY: 300, pointerId: 1 });
  await assentar();
  const modal = screen.getByRole('dialog', { name: /Quantidade no ponto/ });
  fireEvent.click(within(modal).getByRole('button', { name: /^Confirmar$/ }));
  await assentarMuito();
}

/** Escritas que o "Concluir Retorno" não pode repetir, contadas a cada momento. */
function contar(srv) {
  const de = (metodo, re) => srv.escritas.filter((e) => e.method === metodo && re.test(e.path)).length;
  return {
    procedimentos: de('POST', PROCEDIMENTOS),
    mapa: persistirMapaAplicacao.mock.calls.length,
    mapasPost: de('POST', MAPAS),
    galeria: de('POST', GALERIA),
    finalizar: de('PATCH', FINALIZAR),
    encerrar: escritasDe(srv, 'POST', ENCERRAR).length,
  };
}

async function concluirRetorno() {
  clicarBotao(/^Concluir Retorno$/);
  await assentarMuito(6);
}

const botaoConcluir = () => screen.queryAllByRole('button', { name: /^Concluir Retorno$/ });

function aindaNoRetorno() {
  expect(screen.queryByText(SUCESSO)).toBeNull();
  expect(botaoConcluir().length).toBeGreaterThan(0);
}

describe('"Concluir Retorno" sem encerrar a consulta (B-42 rodada 4)', () => {
  beforeEach(() => {
    persistirMapaAplicacao.mockClear();
  });

  afterEach(() => {
    limparMidia();
    limparAmbienteSnapshot();
    sessionStorage.clear();
    localStorage.clear();
  });

  it('(a) finalizar ok e encerrar 503: sem "sucesso", aviso exato, continua no Retorno', async () => {
    prepararMidia();
    const srv = await abrirRetorno({ encerrar: () => ({ status: 503, corpo: { message: 'Fora do ar' } }) });

    await concluirRetorno();

    expect(contar(srv)).toMatchObject({ finalizar: 1, encerrar: 1 });
    expect(await screen.findByText(AVISO_CONEXAO)).toBeTruthy();
    aindaNoRetorno();
  }, TIMEOUT);

  it('(b) segundo clique: 0 POST /procedimentos, 0 mapa, 0 upload, 0 PATCH /finalizar, 1 POST /encerrar e aí "sucesso"', async () => {
    prepararMidia();
    const srv = await abrirRetorno({
      encerrar: (k) => (k === 1 ? { status: 503, corpo: { message: 'Fora do ar' } } : ENCERRADO),
      fotos: [arquivoPng('r1.png', PNG_A_BASE64)],
    });

    await concluirRetorno();
    const depoisDoPrimeiro = contar(srv);
    expect(depoisDoPrimeiro).toMatchObject({ galeria: 1, finalizar: 1, encerrar: 1 });
    expect(depoisDoPrimeiro.procedimentos).toBeGreaterThanOrEqual(1);
    expect(await screen.findByText(AVISO_CONEXAO)).toBeTruthy();
    aindaNoRetorno();

    await concluirRetorno();
    const depoisDoSegundo = contar(srv);
    expect({
      procedimentos: depoisDoSegundo.procedimentos - depoisDoPrimeiro.procedimentos,
      mapa: depoisDoSegundo.mapa - depoisDoPrimeiro.mapa,
      mapasPost: depoisDoSegundo.mapasPost - depoisDoPrimeiro.mapasPost,
      galeria: depoisDoSegundo.galeria - depoisDoPrimeiro.galeria,
      finalizar: depoisDoSegundo.finalizar - depoisDoPrimeiro.finalizar,
      encerrar: depoisDoSegundo.encerrar - depoisDoPrimeiro.encerrar,
    }).toEqual({ procedimentos: 0, mapa: 0, mapasPost: 0, galeria: 0, finalizar: 0, encerrar: 1 });
    expect(await screen.findByText(SUCESSO)).toBeTruthy();
    expect(emConsulta()).toBe(false);
    expect(botaoConcluir()).toEqual([]);
  }, TIMEOUT);

  it('(c) PATCH das observações dá 503: o encerrar recusa (ENVIO_PENDENTE) → mesmo aviso, fica no Retorno', async () => {
    prepararMidia();
    const srv = await abrirRetorno({ itemFora: true });
    expect(escritasDe(srv, 'PATCH', PATCH_ITEM)).toEqual([]);

    await concluirRetorno();

    expect(contar(srv)).toMatchObject({ finalizar: 0, encerrar: 0 });
    const patches = escritasDe(srv, 'PATCH', PATCH_ITEM);
    expect(patches.length).toBeGreaterThanOrEqual(1);
    expect(patches.every((e) => e.status === 503)).toBe(true);
    expect(await screen.findByText(MENSAGEM_ENVIO_PENDENTE)).toBeTruthy();
    aindaNoRetorno();
  }, TIMEOUT);

  it('(d) 4xx com mensagem do servidor: o aviso traz a mensagem, sem "[HTTP n]"', async () => {
    prepararMidia();
    const srv = await abrirRetorno({
      encerrar: () => ({ status: 409, corpo: { status: 409, message: 'A consulta mudou em outro aparelho.' } }),
    });

    await concluirRetorno();

    expect(contar(srv)).toMatchObject({ finalizar: 1, encerrar: 1 });
    expect(
      await screen.findByText(
        'O retorno foi registrado, mas a consulta ainda não foi encerrada: A consulta mudou em outro aparelho.',
      ),
    ).toBeTruthy();
    expect(screen.queryByText(/\[HTTP/)).toBeNull();
    aindaNoRetorno();
  }, TIMEOUT);

  it('(e) retoque com marcação: o segundo clique não chama persistirMapaAplicacao de novo', async () => {
    prepararMidia();
    const srv = await abrirRetorno({
      encerrar: (k) => (k === 1 ? { status: 503, corpo: { message: 'Fora do ar' } } : ENCERRADO),
      retoqueComMarcacao: true,
    });

    await concluirRetorno();
    expect(persistirMapaAplicacao).toHaveBeenCalledTimes(1);
    const mapasDepoisDoPrimeiro = contar(srv).mapasPost;
    expect(await screen.findByText(AVISO_CONEXAO)).toBeTruthy();
    aindaNoRetorno();

    await concluirRetorno();
    expect(persistirMapaAplicacao).toHaveBeenCalledTimes(1);
    expect(contar(srv).mapasPost).toBe(mapasDepoisDoPrimeiro);
    expect(contar(srv)).toMatchObject({ finalizar: 1, encerrar: 2 });
    expect(await screen.findByText(SUCESSO)).toBeTruthy();
  }, TIMEOUT);
});
