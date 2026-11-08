/** Onda 3A-2: a seção de Configurações vem do endereço; trocar empilha; o aviso de "não salvo" é um só (do App). */
import { act, fireEvent, screen } from '@testing-library/react';
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
    expect(noHorarios()).toBe(true);
  }, TIMEOUT);

  it('clicar numa seção empilha /configuracoes/<slug> e Voltar volta', async () => {
    await montarApp({ caminho: '/configuracoes/horarios', rotas });
    fireEvent.click(screen.getAllByRole('button', { name: 'Feriados' })[0]);
    await assentarMuito();
    expect(caminho()).toBe('/configuracoes/feriados');
    expect(noHorarios()).toBe(false);
    act(() => {
      ultimoRoteador().navigate(-1);
    });
    await assentarMuito();
    expect(caminho()).toBe('/configuracoes/horarios');
    expect(noHorarios()).toBe(true);
  }, TIMEOUT);

  it('com alteração não salva, trocar de seção pela barra lateral mostra o aviso uma vez', async () => {
    await montarApp({ caminho: '/configuracoes/horarios', rotas });
    fireEvent.click(screen.getByRole('switch', { name: 'Terça-feira inativo' }));
    await assentarMuito();
    fireEvent.click(screen.getAllByRole('button', { name: 'Feriados' })[0]);
    await assentarMuito();
    expect(avisos()).toHaveLength(1);
    expect(caminho()).toBe('/configuracoes/horarios');
    fireEvent.click(screen.getByRole('button', { name: 'Sair sem salvar' }));
    await assentarMuito();
    expect(avisos()).toHaveLength(0);
    expect(caminho()).toBe('/configuracoes/feriados');
  }, TIMEOUT);

  it('slug legado /configuracoes/agenda-horarios é substituído por /configuracoes/horarios', async () => {
    await montarApp({ caminho: '/configuracoes/agenda-horarios', rotas });
    expect(caminho()).toBe('/configuracoes/horarios');
    expect(noHorarios()).toBe(true);
    expect(ultimoRoteador().state.historyAction).toBe('REPLACE');
  }, TIMEOUT);
});
