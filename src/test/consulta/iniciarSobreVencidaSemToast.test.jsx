/** Regra 13: Iniciar sobre consulta vencida devolve id novo e nenhum toast "Consulta retomada" aparece (app inteiro). */
import { screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { limparAmbienteSnapshot } from '../snapshotConsulta.jsx';
import { IDS, agendaDto } from '../encerrar/cenariosEncerrar.js';
import {
  TIMEOUT,
  assentarMuito,
  consultaDto,
  emConsulta,
  escritasDe,
  iniciarPelaAgenda,
  montarApp,
  resumoDto,
} from './appConsulta.jsx';

vi.mock('../../lib/supabaseClient.js', async () => (await import('../encerrar/servidorEncerrarFalso.js')).supabaseFalso());
vi.mock('../../contexts/AvisosProvider.jsx', async () => (await import('./canalAvisosTeste.jsx')).avisosProviderFalso());

const ID_NOVA = 'c0000000-0000-4000-8000-0000000000bb';

describe('Iniciar sobre consulta vencida', () => {
  afterEach(() => {
    limparAmbienteSnapshot();
    sessionStorage.clear();
    localStorage.clear();
  });

  it('abre a consulta nova e nao mostra "Consulta retomada"', async () => {
    const velha = consultaDto({ status: 'abandonado' });
    const nova = consultaDto({ id: ID_NOVA });
    const srv = await montarApp({
      agendas: [agendaDto({ id: IDS.AGENDA_1 })],
      view: 'agenda',
      rotas: [
        ['POST', /^\/api\/v1\/atendimentos$/, () => nova],
        ['GET', new RegExp(`^/api/v1/atendimentos/${ID_NOVA}$`), () => nova],
        ['GET', /^\/api\/v1\/atendimentos\/minhas$/, () => [resumoDto(velha)]],
      ],
    });
    await iniciarPelaAgenda();
    await assentarMuito(6);
    expect(escritasDe(srv, 'POST', /^\/api\/v1\/atendimentos$/).length).toBe(1);
    expect(emConsulta()).toBe(true);
    expect(screen.queryAllByText(/Consulta retomada/i)).toHaveLength(0);
  }, TIMEOUT);
});
