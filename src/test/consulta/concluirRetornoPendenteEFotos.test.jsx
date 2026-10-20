/**
 * B-42 rodada 3:
 * - item 1: "Concluir Retorno" com alteração da consulta que ainda não chegou ao servidor não segue: toast com a
 *   mensagem exata, nenhuma foto enviada, nada finalizado, e o Retorno fica na tela;
 * - item 4: foto do Retorno que não subiu não promete que ficou salva: diz quantas e que não ficam guardadas.
 */
import { fireEvent, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { limparAmbienteSnapshot } from '../snapshotConsulta.jsx';
import { IDS, agendaDto } from '../encerrar/cenariosEncerrar.js';
import { PNG_A_BASE64, PNG_B_BASE64, arquivoPng, limparMidia, prepararMidia } from '../encerrar/ambienteMidia.js';
import {
  ATENDIMENTO_ID,
  TIMEOUT,
  assentarMuito,
  clicarBotao,
  consultaDto,
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
const PF_ORIGEM = '99999999-9999-4999-8999-999999999991';
const AGENDA_ORIGEM = '99999999-9999-4999-8999-999999999992';
const AGENDA_RETORNO = '99999999-9999-4999-8999-999999999993';
const MENSAGEM_PENDENTE = 'Há alterações que ainda não chegaram ao servidor. Verifique a conexão e tente encerrar de novo.';

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

/**
 * Agenda → Planejamento → "Iniciar Retorno" → fotos do resultado (`fotos`). `moduloFora`: a troca de módulo não chega
 * ao servidor (503). `galeriaFora`: o envio de foto do Retorno falha (500).
 */
async function abrirRetorno({ moduloFora = false, galeriaFora = false, fotos = [] }) {
  const agendas = [
    agendaDto({ id: IDS.AGENDA_1, tipoCodigo: 'CONSULTA', tipoNome: 'Consulta', catalogoId: null, catalogoNome: null }),
  ];
  const estado = { dto: consultaDto({ agendaPrincipalId: IDS.AGENDA_1 }) };
  const retorno = consultaDto({
    agendaPrincipalId: IDS.AGENDA_1,
    tipoProcedimentoCodigo: 'retorno',
    procedimentoFeitoOrigemId: PF_ORIGEM,
    itens: [{ id: 'i-1', ordem: 1, agendaId: null, catalogoProcedimentoSaudeId: IDS.CATALOGO_1, procedimentoNome: 'Toxina botulínica' }],
  });
  const srv = await montarApp({
    agendas,
    rotas: [
      ['POST', ENCERRAR, () => ({
        atendimentoId: ATENDIMENTO_ID,
        status: 'encerrado',
        encerradoEm: '2026-10-06T13:10:00Z',
        procedimentos: [],
        orientacoes: [],
      })],
      ['POST', /^\/api\/v1\/atendimentos$/, () => estado.dto],
      ['GET', new RegExp(`^/api/v1/atendimentos/${ATENDIMENTO_ID}$`), () => estado.dto],
      ['PATCH', MODULO, () => (moduloFora ? { status: 503, corpo: { message: 'Fora do ar' } } : {})],
      ['PUT', /\/itens\/plano$/, () => {
        estado.dto = retorno;
        return retorno;
      }],
      ['POST', GALERIA, () => (galeriaFora ? { status: 500, corpo: { message: 'Falhou' } } : { id: 'foto-1' })],
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
  return srv;
}

const fotosDe = (n) => [arquivoPng('r1.png', PNG_A_BASE64), arquivoPng('r2.png', PNG_B_BASE64)].slice(0, n);

describe('"Concluir Retorno": envio pendente e fotos que não subiram (B-42 rodada 3)', () => {
  afterEach(() => {
    limparMidia();
    limparAmbienteSnapshot();
    sessionStorage.clear();
    localStorage.clear();
  });

  it('item 1: com alteração que não chegou ao servidor, toast exato, nenhuma foto enviada, nada criado nem finalizado, e fica na tela', async () => {
    prepararMidia();
    const srv = await abrirRetorno({ moduloFora: true, fotos: fotosDe(1) });
    expect(escritasDe(srv, 'PATCH', MODULO).length).toBeGreaterThanOrEqual(1);

    clicarBotao(/^Concluir Retorno$/);
    await assentarMuito(6);

    expect(await screen.findByText(MENSAGEM_PENDENTE)).toBeTruthy();
    expect(srv.escritas.filter((e) => e.method === 'POST' && GALERIA.test(e.path))).toEqual([]);
    expect(srv.escritas.filter((e) => e.method === 'PATCH' && FINALIZAR.test(e.path))).toEqual([]);
    expect(srv.escritas.filter((e) => e.method === 'POST' && /^\/api\/v1\/procedimentos/.test(e.path))).toEqual([]);
    expect(escritasDe(srv, 'POST', ENCERRAR)).toEqual([]);
    expect(screen.queryByText('Retorno registrado com sucesso.')).toBeNull();
    // Continua no Retorno, com a foto na tela.
    expect(screen.getAllByRole('button', { name: /^Concluir Retorno$/ }).length).toBeGreaterThan(0);
    expect(screen.getByText('Foto do resultado').closest('.rounded-2xl').querySelectorAll('img')).toHaveLength(1);
  }, TIMEOUT);

  it.each([
    [1, 'Não foi possível enviar 1 foto do resultado. Ela não fica guardada: envie de novo.'],
    [2, 'Não foi possível enviar 2 fotos do resultado. Elas não ficam guardadas: envie de novo.'],
  ])('item 4: %i foto(s) do Retorno que não subiram → toast novo, sem a promessa antiga', async (n, texto) => {
    prepararMidia();
    const srv = await abrirRetorno({ galeriaFora: true, fotos: fotosDe(n) });

    clicarBotao(/^Concluir Retorno$/);
    await assentarMuito(6);

    expect(srv.escritas.filter((e) => e.method === 'POST' && GALERIA.test(e.path))).toHaveLength(n);
    expect(await screen.findByText(texto)).toBeTruthy();
    expect(screen.queryByText(/continuam\s+salvas/)).toBeNull();
  }, TIMEOUT);
});
