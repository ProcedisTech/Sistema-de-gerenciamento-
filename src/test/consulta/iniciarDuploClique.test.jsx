/**
 * Onda 7 (F2): duplo clique em "Iniciar atendimento" do perfil do paciente, com o POST /atendimentos ainda em voo,
 * manda exatamente um abrir. Um segundo abrir (retomada de abandono) apagaria o texto digitado depois do primeiro.
 */
import { act, fireEvent, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { limparAmbienteSnapshot } from '../snapshotConsulta.jsx';
import {
  TIMEOUT,
  assentarMuito,
  clicarBotao,
  consultaDto,
  emConsulta,
  montarApp,
} from './appConsulta.jsx';

vi.mock('../../lib/supabaseClient.js', async () => (await import('../encerrar/servidorEncerrarFalso.js')).supabaseFalso());
vi.mock('../../contexts/AvisosProvider.jsx', async () => (await import('./canalAvisosTeste.jsx')).avisosProviderFalso());

const AVISO = 'Aguarde: ainda estamos abrindo o atendimento anterior.';

describe('Iniciar atendimento: duplo clique (Onda 7, F2)', () => {
  afterEach(() => {
    limparAmbienteSnapshot();
    sessionStorage.clear();
    localStorage.clear();
  });

  async function abrirPerfilEIniciarDuasVezes(rotaAbrir) {
    await montarApp({ view: 'pacientes', rotas: [rotaAbrir] });
    fireEvent.click(screen.getAllByText('Maria Souza')[0]);
    await assentarMuito();
    clicarBotao(/Iniciar atendimento/i);
    clicarBotao(/Iniciar atendimento/i);
    await assentarMuito();
  }

  it('dois cliques com o primeiro abrir em voo: um unico POST /atendimentos e entra na consulta', async () => {
    let chamadas = 0;
    let liberar;
    const segurada = new Promise((res) => { liberar = res; });
    await abrirPerfilEIniciarDuasVezes(['POST', /^\/api\/v1\/atendimentos$/, async () => {
      chamadas += 1;
      await segurada;
      return consultaDto();
    }]);

    expect(chamadas).toBe(1);
    expect(screen.getAllByText(AVISO)).toHaveLength(1);
    await act(async () => { liberar(); });
    await assentarMuito();
    expect(chamadas).toBe(1);
    expect(emConsulta()).toBe(true);
  }, TIMEOUT);

  it('abrir recusado libera a trava: um novo clique abre de novo', async () => {
    let chamadas = 0;
    await abrirPerfilEIniciarDuasVezes(['POST', /^\/api\/v1\/atendimentos$/, async () => {
      chamadas += 1;
      return chamadas === 1 ? { status: 409, corpo: { message: 'Agendamento de outro paciente.' } } : consultaDto();
    }]);
    expect(chamadas).toBe(1);
    expect(emConsulta()).toBe(false);

    clicarBotao(/Iniciar atendimento/i);
    await assentarMuito();
    expect(chamadas).toBe(2);
    expect(emConsulta()).toBe(true);
  }, TIMEOUT);

  it('sem segundo clique em voo, nao ha aviso: primeiro clique em voo e novo clique depois de recusado', async () => {
    let chamadas = 0;
    let liberar;
    const segurada = new Promise((res) => { liberar = res; });
    await montarApp({
      view: 'pacientes',
      rotas: [['POST', /^\/api\/v1\/atendimentos$/, async () => {
        chamadas += 1;
        if (chamadas === 1) { await segurada; return { status: 409, corpo: { message: 'Agendamento de outro paciente.' } }; }
        return consultaDto();
      }]],
    });
    fireEvent.click(screen.getAllByText('Maria Souza')[0]);
    await assentarMuito();
    clicarBotao(/Iniciar atendimento/i);
    await assentarMuito();
    expect(chamadas).toBe(1);
    expect(screen.queryByText(AVISO)).toBeNull();

    await act(async () => { liberar(); });
    await assentarMuito();
    clicarBotao(/Iniciar atendimento/i);
    await assentarMuito();
    expect(chamadas).toBe(2);
    expect(screen.queryByText(AVISO)).toBeNull();
    expect(emConsulta()).toBe(true);
  }, TIMEOUT);
});
