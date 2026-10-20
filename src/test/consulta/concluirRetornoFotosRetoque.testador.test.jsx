/**
 * Testador T4 (B-42 rodada 3, item 4) — acrescentado, não altera teste existente.
 * - ramo 'procedimento' do Retorno (fotos do retoque) com upload falhando: toast "do procedimento", 1 e 2 fotos;
 * - falha parcial (2 fotos, só 1 falha): a contagem é attempted - succeeded (1), não o total.
 * O ambiente (abrirRetorno) é cópia do de concluirRetornoPendenteEFotos.test.jsx, com `falhar(n)` por chamada.
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
  iniciarPelaAgenda,
  montarApp,
} from './appConsulta.jsx';

vi.mock('../../lib/supabaseClient.js', async () => (await import('../encerrar/servidorEncerrarFalso.js')).supabaseFalso());
vi.mock('../../contexts/AvisosProvider.jsx', async () => (await import('./canalAvisosTeste.jsx')).avisosProviderFalso());

const ENCERRAR = new RegExp(`^/api/v1/atendimentos/${ATENDIMENTO_ID}/encerrar$`);
const MODULO = new RegExp(`^/api/v1/atendimentos/${ATENDIMENTO_ID}/modulo$`);
const GALERIA = /^\/api\/v1\/pacientes\/[^/]+\/galeria$/;
const PF_ORIGEM = '99999999-9999-4999-8999-999999999991';
const AGENDA_ORIGEM = '99999999-9999-4999-8999-999999999992';
const AGENDA_RETORNO = '99999999-9999-4999-8999-999999999993';

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
async function abrirRetorno({ falhar = () => false, fotos = [], fotosRetoque = [] }) {
  const agendas = [
    agendaDto({ id: IDS.AGENDA_1, tipoCodigo: 'CONSULTA', tipoNome: 'Consulta', catalogoId: null, catalogoNome: null }),
  ];
  const estado = { dto: consultaDto({ agendaPrincipalId: IDS.AGENDA_1 }), postsGaleria: 0 };
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
      ['PATCH', MODULO, () => ({})],
      ['PUT', /\/itens\/plano$/, () => {
        estado.dto = retorno;
        return retorno;
      }],
      ['POST', GALERIA, () => {
        estado.postsGaleria += 1;
        return falhar(estado.postsGaleria) ? { status: 500, corpo: { message: 'Falhou' } } : { id: `foto-${estado.postsGaleria}` };
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
  if (fotosRetoque.length > 0) {
    fireEvent.click(screen.getByRole('switch'));
    await assentarMuito();
    const caixa = screen.getByText('Pré-retoque (Antes)').closest('.rounded-xl');
    fireEvent.change(caixa.querySelector('input[type="file"]'), { target: { files: fotosRetoque } });
    await assentarMuito();
    expect(caixa.textContent).toContain(`${fotosRetoque.length} foto(s)`);
  }
  return srv;
}

const fotosDe = (n) => [arquivoPng('r1.png', PNG_A_BASE64), arquivoPng('r2.png', PNG_B_BASE64)].slice(0, n);
const postsGaleria = (srv) => srv.escritas.filter((e) => e.method === 'POST' && GALERIA.test(e.path));

describe('Testador T4: fotos do Retorno que não subiram (ramo procedimento e falha parcial)', () => {
  afterEach(() => {
    limparMidia();
    limparAmbienteSnapshot();
    sessionStorage.clear();
    localStorage.clear();
  });

  it.each([
    [1, 'Não foi possível enviar 1 foto do procedimento. Ela não fica guardada: envie de novo.'],
    [2, 'Não foi possível enviar 2 fotos do procedimento. Elas não ficam guardadas: envie de novo.'],
  ])('retoque: %i foto(s) do procedimento falham → toast "do procedimento"', async (n, texto) => {
    prepararMidia();
    const srv = await abrirRetorno({ falhar: () => true, fotosRetoque: fotosDe(n) });

    clicarBotao(/^Concluir Retorno$/);
    await assentarMuito(6);

    expect(postsGaleria(srv)).toHaveLength(n);
    expect(await screen.findByText(texto)).toBeTruthy();
    expect(screen.queryByText(/continuam\s+salvas/)).toBeNull();
    expect(screen.queryByText(/de avaliação/)).toBeNull();
  }, TIMEOUT);

  it('falha parcial (resultado): 2 fotos, só a 1ª chamada falha → "1 foto do resultado"', async () => {
    prepararMidia();
    const srv = await abrirRetorno({ falhar: (k) => k === 1, fotos: fotosDe(2) });

    clicarBotao(/^Concluir Retorno$/);
    await assentarMuito(6);

    expect(postsGaleria(srv)).toHaveLength(2);
    expect(await screen.findByText('Não foi possível enviar 1 foto do resultado. Ela não fica guardada: envie de novo.')).toBeTruthy();
    expect(screen.queryByText(/2 fotos/)).toBeNull();
  }, TIMEOUT);

  it('falha parcial (procedimento): 2 fotos do retoque, só a 1ª chamada falha → "1 foto do procedimento"', async () => {
    prepararMidia();
    const srv = await abrirRetorno({ falhar: (k) => k === 1, fotosRetoque: fotosDe(2) });

    clicarBotao(/^Concluir Retorno$/);
    await assentarMuito(6);

    expect(postsGaleria(srv)).toHaveLength(2);
    expect(await screen.findByText('Não foi possível enviar 1 foto do procedimento. Ela não fica guardada: envie de novo.')).toBeTruthy();
    expect(screen.queryByText(/2 fotos/)).toBeNull();
  }, TIMEOUT);
});
