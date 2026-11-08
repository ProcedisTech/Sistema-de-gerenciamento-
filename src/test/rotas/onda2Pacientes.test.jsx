/** Onda 2, Pacientes: Voltar/Avançar, F5, voltar à lista com filtro, filtro substitui, CPF fora do sessionStorage. */
import { act, cleanup, fireEvent, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { limparAmbienteSnapshot } from '../snapshotConsulta.jsx';
import { assentarMuito, montarApp, TIMEOUT } from '../consulta/appConsulta.jsx';
import { caminhos } from '../../rotas/caminhos.js';
import { IDS, pacienteDto } from '../encerrar/cenariosEncerrar.js';
import { ultimoRoteador } from './montarComRoteador.jsx';

vi.mock('../../lib/supabaseClient.js', async () => (await import('../encerrar/servidorEncerrarFalso.js')).supabaseFalso());
vi.mock('../../contexts/AvisosProvider.jsx', async () => (await import('../consulta/canalAvisosTeste.jsx')).avisosProviderFalso());

const url = () => { const l = ultimoRoteador().state.location; return l.pathname + l.search; };
const irPara = async (d) => { act(() => { ultimoRoteador().navigate(d); }); await assentarMuito(); };
const clicar = async (el) => { fireEvent.click(el); await assentarMuito(); };
const FILTRADA = '/pacientes?filtro=sem-retorno&pagina=2';

afterEach(() => {
  limparAmbienteSnapshot();
  sessionStorage.clear();
  localStorage.clear();
});

describe('Onda 2 Pacientes', () => {
  it('Voltar/Avançar: lista filtrada > perfil > aba Prontuário; voltar volta à aba, depois à lista com o mesmo filtro e página', async () => {
    await montarApp({ caminho: FILTRADA });
    expect(url()).toBe(FILTRADA);
    await clicar(screen.getAllByText(pacienteDto.nomeCompleto)[0]);
    await clicar(screen.getAllByRole('button', { name: /Ver Cadastro|Ver Perfil/ })[0]);
    expect(url()).toBe(caminhos.paciente(IDS.PACIENTE));
    await clicar(screen.getAllByRole('button', { name: 'Prontuário Eletrônico' })[0]);
    expect(url()).toBe(caminhos.paciente(IDS.PACIENTE, 'prontuario'));

    await irPara(-1);
    expect(url()).toBe(caminhos.paciente(IDS.PACIENTE));
    expect(screen.getAllByText(pacienteDto.nomeCompleto).length).toBeGreaterThan(0);
    await irPara(-1);
    expect(url()).toBe(`${FILTRADA}&resumo=${IDS.PACIENTE}`);
    await irPara(-1);
    expect(url()).toBe(FILTRADA);
    await irPara(1);
    await irPara(1);
    expect(url()).toBe(caminhos.paciente(IDS.PACIENTE));
  }, TIMEOUT);

  it('F5 em /pacientes/<id>/prontuario reabre o mesmo paciente e a mesma aba, sem sessionStorage', async () => {
    const alvo = caminhos.paciente(IDS.PACIENTE, 'prontuario');
    await montarApp({ caminho: alvo });
    cleanup();
    sessionStorage.clear();
    await montarApp({ caminho: alvo });
    expect(url()).toBe(alvo);
    expect(screen.getAllByText(pacienteDto.nomeCompleto).length).toBeGreaterThan(0);
    expect(screen.getAllByRole('button', { name: 'Prontuário Eletrônico' })[0].className).toContain('border-[#00a88e]');
  }, TIMEOUT);

  it('"Pacientes" do perfil volta a /pacientes com o filtro sem retorno e a página da lista', async () => {
    await montarApp({ caminho: FILTRADA });
    await clicar(screen.getAllByText(pacienteDto.nomeCompleto)[0]);
    await clicar(screen.getAllByRole('button', { name: /Ver Cadastro|Ver Perfil/ })[0]);
    expect(url()).toBe(caminhos.paciente(IDS.PACIENTE));
    await clicar(within(screen.getByRole('navigation', { name: 'Navegação do perfil' })).getByRole('button', { name: /Pacientes/ }));
    expect(url()).toBe(FILTRADA);
  }, TIMEOUT);

  it('trocar a ordem na lista substitui a entrada (história não cresce) e volta à página 1', async () => {
    await montarApp({ caminho: '/pacientes?pagina=2' });
    const r = ultimoRoteador();
    const antes = window.history.length;
    let pushes = 0;
    r.subscribe((s) => { if (s.historyAction === 'PUSH') pushes += 1; });
    fireEvent.change(screen.getAllByLabelText('Ordenar lista')[0], { target: { value: 'nome-desc' } });
    await assentarMuito();
    expect(url()).toBe('/pacientes?ordem=nome-desc');
    expect(pushes).toBe(0);
    expect(r.state.historyAction).toBe('REPLACE');
    await irPara(-1); // não há entrada anterior da lista: Voltar não pode cair em ?pagina=2
    expect(url()).not.toBe('/pacientes?pagina=2');
    expect(window.history.length).toBe(antes);
  }, TIMEOUT);

  it('F5 sem endereço de perfil não reabre paciente antigo nem guarda o CPF no sessionStorage', async () => {
    await montarApp({ caminho: caminhos.paciente(IDS.PACIENTE) });
    expect(screen.getAllByText(pacienteDto.nomeCompleto).length).toBeGreaterThan(0);
    const guardado = Object.entries({ ...sessionStorage }).concat(Object.entries({ ...localStorage }));
    expect(JSON.stringify(guardado)).not.toContain(pacienteDto.cpf);
    // F5 em /pacientes com as chaves antigas (CPF/perfil/aba) no sessionStorage: elas não mandam mais
    cleanup();
    await montarApp({ caminho: '/pacientes', sessao: { selectedPatientCpf: pacienteDto.cpf, activePatientCpf: pacienteDto.cpf, patientView: 'profile', patientDetailTab: 'prontuario' } });
    expect(url()).toBe('/pacientes');
    expect(screen.queryByRole('button', { name: 'Prontuário Eletrônico' })).toBeNull();
  }, TIMEOUT);
});
