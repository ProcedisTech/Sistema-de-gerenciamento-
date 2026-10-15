/**
 * Testador do item 2 ("Toast que promete demais"): o toast do "Apenas Sair" só promete o que o app faz de verdade.
 * - Só texto pendente (módulo): "guardado neste aparelho, será enviado quando a conexão voltar" e ele sai mesmo
 *   sozinho, fora da consulta, quando o servidor volta (sem abrir a consulta).
 * - Foto que falhou: "não fica guardada: envie de novo" e nada a reenvia, nem ao voltar à consulta.
 */
import { fireEvent, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { limparAmbienteSnapshot } from '../snapshotConsulta.jsx';
import { IDS, agendaDto } from '../encerrar/cenariosEncerrar.js';
import { PNG_A_BASE64, arquivoPng, limparMidia, prepararMidia } from '../encerrar/ambienteMidia.js';
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
  resumoDto,
} from './appConsulta.jsx';

vi.mock('../../lib/supabaseClient.js', async () => (await import('../encerrar/servidorEncerrarFalso.js')).supabaseFalso());
vi.mock('../../contexts/AvisosProvider.jsx', async () => (await import('./canalAvisosTeste.jsx')).avisosProviderFalso());

const DETALHE = new RegExp(`^/api/v1/atendimentos/${ATENDIMENTO_ID}$`);
const MINHAS = /^\/api\/v1\/atendimentos\/minhas$/;
const ITENS = new RegExp(`^/api/v1/atendimentos/${ATENDIMENTO_ID}/itens$`);
const MODULO = new RegExp(`^/api/v1/atendimentos/${ATENDIMENTO_ID}/modulo$`);
const GALERIA = /^\/api\/v1\/pacientes\/[^/]+\/galeria$/;
const TOAST_SUCESSO = 'Rascunho salvo com sucesso.';
const TOAST_GUARDADO = 'Rascunho guardado neste aparelho. Será enviado quando a conexão voltar.';

function rotasDaConsulta(estado) {
  return [
    ['POST', /^\/api\/v1\/atendimentos$/, () => estado.dto],
    ['GET', DETALHE, () => estado.dto],
    ['GET', MINHAS, () => (estado.minhas ? [resumoDto(estado.dto)] : [])],
    ['POST', ITENS, () => ({ id: 'item-1', ordem: 0 })],
    ['PATCH', MODULO, () => estado.respostaModulo?.() ?? {}],
  ];
}

async function avancar(ms) {
  vi.setSystemTime(new Date(Date.now() + ms + 500));
  await new Promise((r) => setTimeout(r, ms));
  await assentarMuito(6);
}

describe('Testador item 2: o toast do "Apenas Sair" bate com o que acontece', () => {
  afterEach(() => {
    limparMidia();
    limparAmbienteSnapshot();
    sessionStorage.clear();
    localStorage.clear();
  });

  it('só o módulo ficou pendente (servidor fora): toast "quando a conexão voltar", e ele sai sozinho fora da consulta', async () => {
    const estado = {
      dto: consultaDto(),
      respostaModulo: () => ({ status: 503, corpo: { message: 'Fora do ar' } }),
    };
    const srv = await montarApp({ agendas: [agendaDto({ id: IDS.AGENDA_1 })], rotas: rotasDaConsulta(estado) });
    await iniciarPeloPaciente();
    estado.minhas = true;
    clicarBotao(/(^|sessões|assinatura)Avaliação/);
    await assentarMuito();
    clicarBotao(/Concluir Avaliação/);
    await assentarMuito();
    clicarBotao(/Encerrar consulta/);
    await assentarMuito();
    clicarBotao('Apenas Sair (Manter em andamento)');
    await assentarMuito(6);

    // Nenhum procedimento novo pendente: só o módulo (texto) ficou.
    expect(escritasDe(srv, 'POST', ITENS).every((e) => e.status === 200)).toBe(true);
    expect(escritasDe(srv, 'PATCH', MODULO).length).toBeGreaterThanOrEqual(1);
    expect(escritasDe(srv, 'PATCH', MODULO).every((e) => e.status === 503)).toBe(true);
    expect(await screen.findByText(TOAST_GUARDADO)).toBeTruthy();
    expect(screen.queryByText(/Procedimento novo guardado/)).toBeNull();
    expect(screen.queryByText(TOAST_SUCESSO)).toBeNull();
    expect(emConsulta()).toBe(false);
    expect(Object.keys(sessionStorage).some((k) => k.startsWith('procedi_consulta_fila_usr-1_'))).toBe(true);

    // A conexão volta: sem abrir a consulta, o módulo sai sozinho (fila em segundo plano) e a fila guardada some.
    estado.respostaModulo = undefined;
    await avancar(3500);
    expect(emConsulta()).toBe(false);
    const modulos = escritasDe(srv, 'PATCH', MODULO);
    expect(modulos.at(-1).status).toBe(200);
    expect(Object.keys(sessionStorage).some((k) => k.startsWith('procedi_consulta_fila_usr-1_'))).toBe(false);
  }, TIMEOUT);

  it('foto que falhou: nada a reenvia depois do "Apenas Sair", nem ao voltar à consulta com o servidor de volta', async () => {
    const estado = { dto: consultaDto(), galeriaRecusa: true };
    const srv = await montarApp({ agendas: [agendaDto({ id: IDS.AGENDA_1 })], rotas: rotasDaConsulta(estado) });
    prepararMidia();
    const postsGaleria = [];
    vi.stubGlobal('fetch', async (url, init = {}) => {
      const metodo = String(init.method || 'GET').toUpperCase();
      const caminho = new URL(String(url), 'http://localhost').pathname;
      if (metodo === 'POST' && GALERIA.test(caminho)) {
        postsGaleria.push(caminho);
        if (estado.galeriaRecusa) {
          return new Response(JSON.stringify({ message: 'Recusada' }), { status: 422, headers: { 'Content-Type': 'application/json' } });
        }
      }
      return srv.fetchFalso(url, init);
    });
    await iniciarPeloPaciente();
    estado.minhas = true;
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

    expect(
      await screen.findByText(`${TOAST_SUCESSO} Não foi possível enviar 1 foto. Ela não fica guardada: envie de novo.`),
    ).toBeTruthy();
    expect(postsGaleria).toHaveLength(1);

    // O servidor volta e passa bem mais que as esperas (2/4/8 s) e a retentativa da fila (3 s): nenhum reenvio.
    estado.galeriaRecusa = false;
    await avancar(4000);
    expect(postsGaleria).toHaveLength(1);

    // Voltar à consulta também não reenvia a foto.
    clicarBotao('Voltar à consulta de Maria Souza');
    await assentarMuito(6);
    expect(emConsulta()).toBe(true);
    await avancar(1500);
    expect(postsGaleria).toHaveLength(1);

    // "Não fica guardada": na Avaliação da consulta retomada a foto que falhou não está mais (0/30).
    clicarBotao(/(^|sessões|assinatura)Avaliação/);
    await assentarMuito(6);
    const secaoDepois = screen.getByText('Fotos da avaliação').closest('.mb-2').parentElement;
    expect(secaoDepois.querySelectorAll('img')).toHaveLength(0);
    expect(secaoDepois.textContent).toContain('0/30');
    await avancar(1500);
    expect(postsGaleria).toHaveLength(1);
  }, TIMEOUT);
});
