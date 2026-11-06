/**
 * F6 (Onda 6): "Voltar à consulta" (card da agenda) e o botão do topo, quando o detalhe volta "abandonado", dizem que a
 * consulta foi abandonada e que o caminho é Iniciar. Outro motivo de falha (encerrada) mantém o texto antigo.
 */
import { screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { limparAmbienteSnapshot } from '../snapshotConsulta.jsx';
import { IDS, agendaDto } from '../encerrar/cenariosEncerrar.js';
import { ROLE_USER_ID } from '../encerrar/servidorEncerrarFalso.js';
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

const TEXTO_ABANDONADA = 'Esta consulta foi encerrada porque ninguém respondeu ao aviso de 4 h. O que não tinha sido salvo se perdeu. Use Iniciar para começar uma nova.';
const TEXTO_ANTIGO = 'Não foi possível abrir a consulta. Ela pode ter sido encerrada.';
const rotaDetalhe = (status) => [
  'GET',
  new RegExp(`^/api/v1/atendimentos/${ATENDIMENTO_ID}$`),
  () => consultaDto({ status, agendaPrincipalId: IDS.AGENDA_1 }),
];
const agendaEmConsulta = () => ({
  ...agendaDto({ id: IDS.AGENDA_1 }),
  atendimentoId: ATENDIMENTO_ID,
  atendimentoStatusCodigo: 'aberto',
  atendimentoAnfitriaoRoleUserId: ROLE_USER_ID,
});

describe('entrar numa consulta abandonada: texto (F6)', () => {
  afterEach(() => {
    limparAmbienteSnapshot();
    sessionStorage.clear();
    localStorage.clear();
  });

  it('botão do topo: detalhe "abandonado" mostra o texto de abandonada e não entra', async () => {
    await montarApp({
      view: 'pacientes',
      rotas: [
        ['GET', /^\/api\/v1\/atendimentos\/minhas$/, () => [resumoDto(consultaDto())]],
        rotaDetalhe('abandonado'),
      ],
    });
    clicarBotao('Voltar à consulta de Maria Souza');
    await assentarMuito(4);

    expect(emConsulta()).toBe(false);
    expect(screen.getAllByText(TEXTO_ABANDONADA).length).toBeGreaterThan(0);
    expect(screen.queryAllByText(TEXTO_ANTIGO)).toHaveLength(0);
  }, TIMEOUT);

  it('botão do topo: detalhe "encerrado" mantém o texto antigo', async () => {
    await montarApp({
      view: 'pacientes',
      rotas: [
        ['GET', /^\/api\/v1\/atendimentos\/minhas$/, () => [resumoDto(consultaDto())]],
        rotaDetalhe('encerrado'),
      ],
    });
    clicarBotao('Voltar à consulta de Maria Souza');
    await assentarMuito(4);

    expect(emConsulta()).toBe(false);
    expect(screen.getAllByText(TEXTO_ANTIGO).length).toBeGreaterThan(0);
    expect(screen.queryAllByText(TEXTO_ABANDONADA)).toHaveLength(0);
  }, TIMEOUT);

  it('"Voltar à consulta" do card da agenda: detalhe "abandonado" mostra o texto de abandonada', async () => {
    await montarApp({
      agendas: [agendaEmConsulta()],
      view: 'agenda',
      agora: '2026-10-06T11:00:00.000Z',
      rotas: [rotaDetalhe('abandonado')],
    });
    clicarBotao('Voltar à consulta');
    await assentarMuito(4);

    expect(emConsulta()).toBe(false);
    expect(screen.getAllByText(TEXTO_ABANDONADA).length).toBeGreaterThan(0);
    expect(screen.queryAllByText(TEXTO_ANTIGO)).toHaveLength(0);
  }, TIMEOUT);

  it('"Voltar à consulta" do card da agenda: detalhe "encerrado" mantém o texto antigo', async () => {
    await montarApp({
      agendas: [agendaEmConsulta()],
      view: 'agenda',
      agora: '2026-10-06T11:00:00.000Z',
      rotas: [rotaDetalhe('encerrado')],
    });
    clicarBotao('Voltar à consulta');
    await assentarMuito(4);

    expect(emConsulta()).toBe(false);
    expect(screen.getAllByText(TEXTO_ANTIGO).length).toBeGreaterThan(0);
    expect(screen.queryAllByText(TEXTO_ABANDONADA)).toHaveLength(0);
  }, TIMEOUT);
});
