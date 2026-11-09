/** Onda 3A-2: a seção de Configurações vem do endereço; trocar empilha; o aviso de "não salvo" é um só (do App). */
import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { limparAmbienteSnapshot } from '../snapshotConsulta.jsx';
import { assentarMuito, montarApp, TIMEOUT } from '../consulta/appConsulta.jsx';
import { ultimoRoteador } from './montarComRoteador.jsx';

vi.mock('../../lib/supabaseClient.js', async () => (await import('../encerrar/servidorEncerrarFalso.js')).supabaseFalso());
vi.mock('../../contexts/AvisosProvider.jsx', async () => (await import('../consulta/canalAvisosTeste.jsx')).avisosProviderFalso());

const grade = [{ diaSemana: 1, horaInicio: '08:00', horaFim: '12:00', ativo: true }];
const rotas = [['GET', /^\/api\/v1\/organizacoes\/[^/]+\/horarios$/, () => grade]];
const noHorarios = () => screen.queryByRole('switch', { name: /Terça-feira (in)?ativo/ }) !== null;
const caminho = () => ultimoRoteador().state.location.pathname;
const avisos = () => screen.queryAllByRole('heading', { name: 'Alterações não salvas' });

afterEach(() => {
  limparAmbienteSnapshot();
  sessionStorage.clear();
  localStorage.clear();
});

describe('Seção de Configurações pelo endereço', () => {
  it('F5 em /configuracoes/horarios abre Horários', async () => {
    await montarApp({ caminho: '/configuracoes/horarios', rotas });
    await waitFor(() => expect(noHorarios()).toBe(true));
  }, TIMEOUT);

  it('clicar numa seção empilha /configuracoes/<slug> e Voltar volta', async () => {
    await montarApp({ caminho: '/configuracoes/horarios', rotas });
    fireEvent.click(screen.getAllByRole('button', { name: 'Feriados' })[0]);
    await assentarMuito();
    await waitFor(() => expect(caminho()).toBe('/configuracoes/feriados'));
    await waitFor(() => expect(noHorarios()).toBe(false));
    act(() => {
      ultimoRoteador().navigate(-1);
    });
    await assentarMuito();
    await waitFor(() => expect(caminho()).toBe('/configuracoes/horarios'));
    await waitFor(() => expect(noHorarios()).toBe(true));
  }, TIMEOUT);

  it('com alteração não salva, trocar de seção pela barra lateral mostra o aviso uma vez', async () => {
    await montarApp({ caminho: '/configuracoes/horarios', rotas });
    fireEvent.click(await screen.findByRole('switch', { name: 'Terça-feira inativo' }));
    await assentarMuito();
    fireEvent.click(screen.getAllByRole('button', { name: 'Feriados' })[0]);
    await assentarMuito();
    await waitFor(() => expect(avisos()).toHaveLength(1)); // sinal positivo antes da negativa
    expect(caminho()).toBe('/configuracoes/horarios');
    fireEvent.click(await screen.findByRole('button', { name: 'Sair sem salvar' }));
    await assentarMuito();
    await waitFor(() => expect(avisos()).toHaveLength(0));
    await waitFor(() => expect(caminho()).toBe('/configuracoes/feriados'));
  }, TIMEOUT);

  it('slug legado /configuracoes/agenda-horarios é substituído por /configuracoes/horarios', async () => {
    await montarApp({ caminho: '/configuracoes/agenda-horarios', rotas });
    await waitFor(() => expect(caminho()).toBe('/configuracoes/horarios'));
    await waitFor(() => expect(noHorarios()).toBe(true));
    await waitFor(() => expect(ultimoRoteador().state.historyAction).toBe('REPLACE'));
  }, TIMEOUT);
});
