/**
 * Consulta aberta no servidor: "Apenas sair" sai depois dos envios pendentes e a consulta continua aberta (sem rota de
 * consulta), aviso de cancelamento por outra pessoa (D2), um aviso → uma rebusca (R8) e PATCH de módulo só por ação da
 * pessoa (Y9).
 */
import { fireEvent, screen } from '@testing-library/react';
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

const DETALHE = new RegExp(`^/api/v1/atendimentos/${ATENDIMENTO_ID}$`);

/** Rotas de uma consulta com id fixo; `estado.dto` é o que o detalhe devolve. */
function rotasDaConsulta(estado) {
  return [
    ['POST', /^\/api\/v1\/atendimentos$/, () => estado.dto],
    ['GET', DETALHE, () => estado.dto],
  ];
}

const leiturasDoDetalhe = (srv) => srv.leituras.filter((l) => DETALHE.test(l.path));

describe('consulta no servidor (Etapa 1)', () => {
  afterEach(() => {
    limparMidia();
    limparAmbienteSnapshot();
    sessionStorage.clear();
    localStorage.clear();
  });

  it('"Apenas sair" não chama rota de consulta, avisa e não cria procedimento nem mexe em agenda', async () => {
    const estado = { dto: consultaDto() };
    const srv = await montarApp({ agendas: [agendaDto({ id: IDS.AGENDA_1 })], rotas: rotasDaConsulta(estado) });
    await iniciarPeloPaciente();
    expect(emConsulta()).toBe(true);
    const antes = srv.escritas.length;

    clicarBotao(/Encerrar consulta/);
    await assentarMuito();
    const consultaAntes = srv.escritasConsulta.length;
    clicarBotao('Apenas Sair (Manter em andamento)');
    await assentarMuito();

    // Só o envio que estava na fila (o item da linha da agenda) sai antes de sair; nenhuma outra rota de consulta (a
    // consulta continua aberta no servidor). A declaração de pendência (F7, PUT .../pendencia) não é rota de edição.
    expect(srv.escritasConsulta.slice(consultaAntes)
      .filter((e) => !/\/pendencia$/.test(e.path))
      .map((e) => `${e.method} ${e.path}`)).toEqual([
      `POST /api/v1/atendimentos/${ATENDIMENTO_ID}/itens`,
    ]);
    const novas = srv.escritas.slice(antes).filter((e) => /procedimentos|agendas/.test(e.path));
    expect(novas).toEqual([]);
    expect(await screen.findByText('Rascunho salvo com sucesso.')).toBeTruthy();
    expect(emConsulta()).toBe(false);
  }, TIMEOUT);

  it('"Apenas sair" espera a foto que ainda está subindo antes de sair', async () => {
    const estado = { dto: consultaDto() };
    const srv = await montarApp({ agendas: [agendaDto({ id: IDS.AGENDA_1 })], rotas: rotasDaConsulta(estado) });
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

    clicarBotao(/Encerrar consulta/);
    await assentarMuito();
    clicarBotao('Apenas Sair (Manter em andamento)');
    await assentarMuito();
    expect(screen.queryByText('Rascunho salvo com sucesso.')).toBeNull();
    expect(emConsulta()).toBe(true);

    liberarFoto();
    await assentarMuito(6);

    const ordem = srv.escritasConsulta.map((e) => e.path);
    const foto = ordem.findIndex((p) => /\/galeria$/.test(p));
    expect(foto).toBeGreaterThanOrEqual(0);
    expect(escritasDe(srv, 'POST', new RegExp(`^/api/v1/atendimentos/${ATENDIMENTO_ID}/(?!itens$)`))).toEqual([]);
    expect(await screen.findByText('Rascunho salvo com sucesso.')).toBeTruthy();
    expect(emConsulta()).toBe(false);
  }, TIMEOUT);

  it('consulta cancelada por outra pessoa: sai da consulta e avisa quem fechou (D2)', async () => {
    const estado = { dto: consultaDto() };
    await montarApp({ agendas: [agendaDto({ id: IDS.AGENDA_1 })], rotas: rotasDaConsulta(estado) });
    await iniciarPeloPaciente();
    expect(emConsulta()).toBe(true);

    estado.dto = consultaDto({
      status: 'cancelado',
      fechadaPor: { profissionalNome: 'Ana Prado', pacienteNome: 'Maria Souza' },
    });
    avisos.emitirAviso(AVISO.ATENDIMENTO.CANCELADO, ATENDIMENTO_ID, { atendimentoId: ATENDIMENTO_ID });
    await new Promise((resolve) => setTimeout(resolve, 320));
    await assentarMuito(6);

    expect(emConsulta()).toBe(false);
    expect(
      await screen.findByText(
        'Sua consulta com Maria Souza foi fechada porque Ana Prado iniciou um atendimento. Tudo o que foi registrado continua salvo.',
      ),
    ).toBeTruthy();
  }, TIMEOUT);

  it('um aviso da consulta atual gera uma rebusca só (R8)', async () => {
    const estado = { dto: consultaDto() };
    const srv = await montarApp({ agendas: [agendaDto({ id: IDS.AGENDA_1 })], rotas: rotasDaConsulta(estado) });
    await iniciarPeloPaciente();
    const antes = leiturasDoDetalhe(srv).length;

    avisos.emitirAviso(AVISO.ATENDIMENTO.SESSAO_ALTERADA, ATENDIMENTO_ID, { atendimentoId: ATENDIMENTO_ID });
    await new Promise((resolve) => setTimeout(resolve, 320));
    await assentarMuito(6);

    expect(leiturasDoDetalhe(srv).length - antes).toBe(1);
    expect(emConsulta()).toBe(true);
  }, TIMEOUT);

  it('módulo só vai ao servidor quando a pessoa troca (Y9)', async () => {
    const estado = { dto: consultaDto() };
    const srv = await montarApp({ agendas: [agendaDto({ id: IDS.AGENDA_1 })], rotas: rotasDaConsulta(estado) });
    await iniciarPeloPaciente();
    const modulo = () => escritasDe(srv, 'PATCH', /\/modulo$/);
    expect(modulo()).toHaveLength(0);

    clicarBotao(/^Termos/);
    await assentarMuito();

    expect(modulo()).toHaveLength(1);
    expect(modulo()[0].body).toEqual({ modulo: 'termos' });
  }, TIMEOUT);
});
