/**
 * Testador T1 (B-42 rodada 4, item 1). Casos que o teste do implementador não cobre:
 * (f) terceiro clique depois de 2 falhas (503 e 429): nada recriado; só o terceiro encerrar dá "sucesso".
 * (g) plano concluído: a resposta do `finalizar` (planoConcluidoNesteFinalizar) guardada no 1º clique abre o pop-up
 *     no 2º clique, que não chama o finalizar; com o encerrar falhando, o pop-up NÃO aparece.
 * (h) NÃO DETERMINADO do implementador: a consulta é encerrada em outro aparelho DURANTE o 1º clique (o aviso chega
 *     com a trava ligada e é ignorado). Mede o que o 2º clique faz.
 * O ambiente segue concluirRetornoSemEncerrar.test.jsx (não importa dele: aquele arquivo é do implementador).
 */
import { screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { limparAmbienteSnapshot } from '../snapshotConsulta.jsx';
import { IDS, agendaDto } from '../encerrar/cenariosEncerrar.js';
import { PNG_A_BASE64, arquivoPng, limparMidia, prepararMidia } from '../encerrar/ambienteMidia.js';
import { AVISO } from '../../services/avisos/tiposAviso.js';
import { avisos } from './canalAvisosTeste.jsx';
import { fireEvent } from '@testing-library/react';
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

const ENCERRAR = new RegExp(`^/api/v1/atendimentos/${ATENDIMENTO_ID}/encerrar$`);
const MODULO = new RegExp(`^/api/v1/atendimentos/${ATENDIMENTO_ID}/modulo$`);
const GALERIA = /^\/api\/v1\/pacientes\/[^/]+\/galeria$/;
const FINALIZAR = /\/procedimentos\/[^/]+\/finalizar$/;
const PROCEDIMENTOS = /^\/api\/v1\/procedimentos/;
const PF_ORIGEM = '99999999-9999-4999-8999-999999999991';
const AGENDA_ORIGEM = '99999999-9999-4999-8999-999999999992';
const AGENDA_RETORNO = '99999999-9999-4999-8999-999999999993';
const SUCESSO = 'Retorno registrado com sucesso.';
const AVISO_CONEXAO =
  'O retorno foi registrado, mas a consulta ainda não foi encerrada. Verifique a conexão e clique em Concluir Retorno de novo.';
const PLANO_CONCLUIDO = /Plano concluído com êxito/;

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

async function abrirRetorno({ encerrar = () => ENCERRADO, fotos = [], planoConcluido = false }) {
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
    }],
  });
  const rotas = [
    ['POST', ENCERRAR, () => {
      estado.encerrar += 1;
      return encerrar(estado.encerrar);
    }],
    ['POST', /^\/api\/v1\/atendimentos$/, () => estado.dto],
    ['GET', new RegExp(`^/api/v1/atendimentos/${ATENDIMENTO_ID}$`), () => estado.dto],
    ['PATCH', MODULO, () => ({})],
    ['PUT', /\/itens\/plano$/, () => {
      estado.dto = retorno;
      return retorno;
    }],
    ['GET', /^\/api\/v1\/planejamentos$/, () => [plano]],
    ['GET', /^\/api\/v1\/planejamentos\/[^/]+$/, () => plano],
    ['GET', /^\/api\/v1\/procedimentos\/paciente\/[^/]+$/, () => ({})],
  ];
  if (planoConcluido) {
    rotas.unshift(['PATCH', FINALIZAR, ({ path }) => ({
      id: path.split('/')[4],
      statusCodigo: 'finalizado',
      planoConcluidoNesteFinalizar: true,
    })]);
  }
  const srv = await montarApp({ agendas, rotas });
  await iniciarPelaAgenda();
  clicarBotao(/(^|sessões)Planejamento/);
  await assentarMuito();
  clicarBotao(/^Iniciar Retorno$/);
  await assentarMuito(6);
  if (fotos.length > 0) {
    const secao = screen.getByText('Foto do resultado').closest('.rounded-2xl');
    fireEvent.change(secao.querySelector('input[type="file"]'), { target: { files: fotos } });
    await assentarMuito();
  }
  return { srv, estado, retorno };
}

function contar(srv) {
  const de = (metodo, re) => srv.escritas.filter((e) => e.method === metodo && re.test(e.path)).length;
  return {
    procedimentos: de('POST', PROCEDIMENTOS),
    mapasPost: de('POST', /^\/api\/v1\/mapas$/),
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
const quantosAvisos = () => screen.queryAllByText(AVISO_CONEXAO).length;

describe('"Concluir Retorno" sem encerrar — testador T1 (B-42 rodada 4)', () => {
  afterEach(() => {
    limparMidia();
    limparAmbienteSnapshot();
    sessionStorage.clear();
    localStorage.clear();
  });

  it('(f) terceiro clique depois de 2 falhas (503, 429): nada recriado, só o 3º encerrar dá "sucesso"', async () => {
    prepararMidia();
    const { srv } = await abrirRetorno({
      encerrar: (k) => (k === 1 ? { status: 503, corpo: {} } : k === 2 ? { status: 429, corpo: {} } : ENCERRADO),
      fotos: [arquivoPng('r1.png', PNG_A_BASE64)],
    });

    await concluirRetorno();
    const c1 = contar(srv);
    expect(c1).toMatchObject({ galeria: 1, finalizar: 1, encerrar: 1 });
    expect(quantosAvisos()).toBeGreaterThanOrEqual(1);
    expect(screen.queryByText(SUCESSO)).toBeNull();
    expect(botaoConcluir().length).toBeGreaterThan(0);
    const avisos1 = quantosAvisos();

    await concluirRetorno();
    const c2 = contar(srv);
    expect(c2).toEqual({ ...c1, encerrar: 2 });
    expect(screen.queryByText(SUCESSO)).toBeNull();
    expect(botaoConcluir().length).toBeGreaterThan(0);
    // O segundo aviso (429) é um toast novo (ou o mesmo continua): nunca some sem nada no lugar.
    expect(quantosAvisos()).toBeGreaterThanOrEqual(avisos1);

    await concluirRetorno();
    expect(contar(srv)).toEqual({ ...c1, encerrar: 3 });
    expect(await screen.findByText(SUCESSO)).toBeTruthy();
    expect(emConsulta()).toBe(false);
  }, TIMEOUT);

  it('(g) plano concluído: o 2º clique usa o dtoFinalizar guardado (pop-up abre, finalizar não repete); falhando, sem pop-up', async () => {
    prepararMidia();
    const { srv } = await abrirRetorno({
      encerrar: (k) => (k === 1 ? { status: 503, corpo: {} } : ENCERRADO),
      planoConcluido: true,
    });

    await concluirRetorno();
    expect(contar(srv)).toMatchObject({ finalizar: 1, encerrar: 1 });
    expect(await screen.findByText(AVISO_CONEXAO)).toBeTruthy();
    expect(screen.queryByText(PLANO_CONCLUIDO)).toBeNull();
    expect(screen.queryByText(SUCESSO)).toBeNull();

    await concluirRetorno();
    expect(contar(srv)).toMatchObject({ finalizar: 1, encerrar: 2 });
    expect(await screen.findByText(PLANO_CONCLUIDO)).toBeTruthy();
  }, TIMEOUT);

  /**
   * Outro aparelho encerra a consulta enquanto o PATCH /finalizar do 1º clique demora. A trava do clique faz a tela
   * ignorar a saída (aoConsultaEncerradaRef: `finishJourneyLockRef.current` → return).
   */
  async function fecharDuranteOFinalizar({ atrasoMs }) {
    const ctx = await abrirRetorno({
      encerrar: () => ({ status: 409, corpo: { message: 'Consulta já encerrada.' } }),
      fotos: [arquivoPng('r1.png', PNG_A_BASE64)],
    });
    let fechou = false;
    vi.stubGlobal('fetch', async (url, init = {}) => {
      const metodo = String(init.method || 'GET').toUpperCase();
      if (!fechou && metodo === 'PATCH' && FINALIZAR.test(new URL(String(url), 'http://x').pathname)) {
        fechou = true;
        ctx.estado.dto = { ...ctx.retorno, status: 'encerrado', encerradoEm: '2026-10-06T13:05:00Z' };
        avisos.emitirAviso(AVISO.ATENDIMENTO.SESSAO_ALTERADA, ATENDIMENTO_ID, { atendimentoId: ATENDIMENTO_ID });
        await new Promise((resolve) => setTimeout(resolve, atrasoMs));
      }
      return ctx.srv.fetchFalso(url, init);
    });
    return ctx;
  }

  it('(h1) ND: rebusca chega DEPOIS do POST /encerrar (409): aviso "ainda não foi encerrada: Consulta já encerrada." e a tela sai sozinha', async () => {
    prepararMidia();
    const { srv } = await fecharDuranteOFinalizar({ atrasoMs: 30 });

    await concluirRetorno();

    expect(contar(srv)).toMatchObject({ procedimentos: 1, galeria: 1, finalizar: 1, encerrar: 1 });
    // Medido: os dois toasts juntos (contraditórios) e a saída pela rota do "encerrada em outro aparelho".
    expect(
      screen.getByText('O retorno foi registrado, mas a consulta ainda não foi encerrada: Consulta já encerrada.'),
    ).toBeTruthy();
    expect(await screen.findByText('Consulta encerrada em outro aparelho')).toBeTruthy();
    expect(screen.queryByText('Jornada finalizada com sucesso.')).toBeNull();
    expect(screen.queryByText(SUCESSO)).toBeNull();
    expect(botaoConcluir()).toEqual([]);
  }, TIMEOUT);

  it('(h2) ND: rebusca chega ANTES do encerrar: aviso de conexão (falso), tela fica; o 2º clique refaz o finalizar', async () => {
    prepararMidia();
    const { srv } = await fecharDuranteOFinalizar({ atrasoMs: 400 });

    await concluirRetorno();
    const c1 = contar(srv);
    // O encerrar nem sai: a consulta já foi esquecida (CONSULTA_NAO_ENCONTRADA, sem status → texto de conexão).
    expect(c1).toMatchObject({ procedimentos: 1, galeria: 1, finalizar: 1, encerrar: 0 });
    expect(quantosAvisos()).toBe(1);
    expect(botaoConcluir().length).toBeGreaterThan(0);
    expect(screen.queryByText(SUCESSO)).toBeNull();

    await concluirRetorno();
    const c2 = contar(srv);
    expect(c2.procedimentos - c1.procedimentos).toBe(0);
    expect(c2.galeria - c1.galeria).toBe(0);
    expect(c2.encerrar - c1.encerrar).toBe(0);
    // Medido hoje: 1 (o PATCH /finalizar é refeito). NÃO travado aqui de propósito (o certo seria 0).
    expect(c2.finalizar - c1.finalizar).toBeLessThanOrEqual(1);
    expect(await screen.findByText(SUCESSO)).toBeTruthy();
    expect(emConsulta()).toBe(false);
  }, TIMEOUT);
});
