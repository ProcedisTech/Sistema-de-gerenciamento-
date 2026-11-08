/** Onda 2: atalhos do topo com guarda de Configurações, Voltar das Notificações, Voltar/Avançar do detalhe da agenda e limpeza do legado. */
import { act, fireEvent, screen } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { limparAmbienteSnapshot } from '../snapshotConsulta.jsx';
import { IDS, agendaDto, pacienteDto } from '../encerrar/cenariosEncerrar.js';
import { assentarMuito, montarApp, TIMEOUT } from '../consulta/appConsulta.jsx';
import { caminhos } from '../../rotas/caminhos.js';
import { consumirChavesAntigas } from '../../rotas/legado.js';
import { ultimoRoteador } from './montarComRoteador.jsx';

vi.mock('../../lib/supabaseClient.js', async () => (await import('../encerrar/servidorEncerrarFalso.js')).supabaseFalso());
vi.mock('../../contexts/AvisosProvider.jsx', async () => (await import('../consulta/canalAvisosTeste.jsx')).avisosProviderFalso());

const grade = [{ diaSemana: 1, horaInicio: '08:00', horaFim: '12:00', ativo: true }];
const rotasHorarios = [['GET', /^\/api\/v1\/organizacoes\/[^/]+\/horarios$/, () => grade]];
const MODAL = 'Você tem alterações não salvas no horário de atendimento. Deseja sair sem salvar?';
const modal = () => screen.queryByRole('heading', { name: 'Alterações não salvas' });
const caminho = () => ultimoRoteador().state.location.pathname;
const menuConfig = () => fireEvent.click(screen.getAllByRole('button', { name: /^Configurações$/ }).at(-1));
const ir = async (destino) => {
  act(() => {
    ultimoRoteador().navigate(destino);
  });
  await assentarMuito();
};

async function emHorarios({ sujar }) {
  await montarApp({ view: 'pacientes', rotas: rotasHorarios });
  menuConfig();
  await assentarMuito();
  fireEvent.click(screen.getAllByText(/Horários, feriados e mensagens/)[0]);
  await assentarMuito();
  fireEvent.click(screen.getAllByText(/Horários de funcionamento/)[0]);
  await assentarMuito();
  if (sujar) {
    fireEvent.click(screen.getByRole('switch', { name: 'Terça-feira inativo' }));
    await assentarMuito();
  }
  const aqui = caminho();
  expect(aqui.startsWith(caminhos.configuracoes())).toBe(true);
  return aqui;
}

async function buscarPacienteNoTopo() {
  const campo = screen.getByRole('combobox', { name: 'Buscar paciente' });
  fireEvent.focus(campo);
  fireEvent.change(campo, { target: { value: 'Maria' } });
  await assentarMuito(8);
  fireEvent.click(screen.getAllByText('Maria Souza')[0]);
  await assentarMuito();
}

const novoPacienteTopo = async () => {
  fireEvent.click(screen.getByRole('button', { name: /Novo Paciente/i }));
  await assentarMuito();
};

beforeAll(() => {
  Element.prototype.scrollTo = () => {};
});

afterEach(() => {
  limparAmbienteSnapshot();
  sessionStorage.clear();
  localStorage.clear();
});

describe('Onda 2: guarda nos atalhos do topo', () => {
  it('busca global de paciente com horários sujos: aviso; continuar editando fica; sair sem salvar vai a /pacientes/<id>', async () => {
    const aqui = await emHorarios({ sujar: true });
    await buscarPacienteNoTopo();
    expect(screen.getByText(MODAL)).toBeTruthy();
    expect(caminho()).toBe(aqui);

    fireEvent.click(screen.getByRole('button', { name: 'Continuar editando' }));
    await assentarMuito();
    expect(modal()).toBeNull();
    expect(caminho()).toBe(aqui);
    expect(screen.getByRole('switch', { name: 'Terça-feira ativo' })).toBeTruthy();

    await buscarPacienteNoTopo();
    expect(screen.getByText(MODAL)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Sair sem salvar' }));
    await assentarMuito();
    expect(modal()).toBeNull();
    expect(caminho()).toBe(caminhos.paciente(pacienteDto.id));
  }, TIMEOUT);

  it('"Novo paciente" do topo com horários sujos: aviso; continuar editando fica; sair sem salvar vai a /pacientes/novo', async () => {
    const aqui = await emHorarios({ sujar: true });
    await novoPacienteTopo();
    expect(screen.getByText(MODAL)).toBeTruthy();
    expect(caminho()).toBe(aqui);

    fireEvent.click(screen.getByRole('button', { name: 'Continuar editando' }));
    await assentarMuito();
    expect(caminho()).toBe(aqui);

    await novoPacienteTopo();
    fireEvent.click(screen.getByRole('button', { name: 'Sair sem salvar' }));
    await assentarMuito();
    expect(modal()).toBeNull();
    expect(caminho()).toBe(caminhos.pacienteNovo());
  }, TIMEOUT);

  it('sem alteração, busca global e "Novo paciente" navegam direto, sem aviso', async () => {
    await emHorarios({ sujar: false });
    await buscarPacienteNoTopo();
    expect(modal()).toBeNull();
    expect(caminho()).toBe(caminhos.paciente(pacienteDto.id));

    await ir(caminhos.configuracoes());
    await novoPacienteTopo();
    expect(modal()).toBeNull();
    expect(caminho()).toBe(caminhos.pacienteNovo());
  }, TIMEOUT);
});

describe('Onda 2: Voltar das Notificações', () => {
  const voltarTela = async () => {
    fireEvent.click(screen.getByRole('button', { name: /^Voltar$/ }));
    await assentarMuito();
  };

  it('1ª entrada do histórico (link direto) volta para /pacientes', async () => {
    await montarApp({ caminho: caminhos.tela('notificacoes') });
    await assentarMuito(4);
    expect(caminho()).toBe('/notificacoes');
    await voltarTela();
    expect(caminho()).toBe(caminhos.pacientes());
  }, TIMEOUT);

  it('aberta depois de outra tela, volta para ela (navigate(-1))', async () => {
    await montarApp({ view: 'pacientes' });
    await ir(caminhos.agenda());
    await ir(caminhos.tela('notificacoes'));
    expect(caminho()).toBe('/notificacoes');
    await voltarTela();
    expect(caminho()).toBe(caminhos.agenda());
  }, TIMEOUT);
});

describe('Onda 2: Voltar e Avançar do detalhe da agenda', () => {
  const dto = agendaDto({ id: IDS.AGENDA_1 });
  const FECHAR = /Fechar detalhe do agendamento/;
  const rotaDoItem = [['GET', new RegExp(`^/api/v1/agendas/${IDS.AGENDA_1}$`), () => dto]];

  it('abrir detalhe; Voltar do navegador fecha e fica em /agenda; Avançar reabre', async () => {
    await montarApp({ view: 'agenda', caminho: caminhos.agenda(IDS.AGENDA_1), agendas: [dto], rotas: rotaDoItem });
    await assentarMuito(8);
    screen.getAllByRole('button', { name: FECHAR })[0].click();
    await assentarMuito(8);
    expect(caminho()).toBe('/agenda');
    fireEvent.click(screen.getAllByRole('button', { name: /^Detalhes: / })[0]);
    await assentarMuito(8);
    expect(caminho()).toBe(`/agenda/${IDS.AGENDA_1}`);
    expect(screen.getAllByRole('button', { name: FECHAR }).length).toBeGreaterThan(0);

    await ir(-1);
    await assentarMuito(4);
    expect(caminho()).toBe('/agenda');
    expect(screen.queryAllByRole('button', { name: FECHAR })).toHaveLength(0);

    await ir(1);
    await assentarMuito(4);
    expect(caminho()).toBe(`/agenda/${IDS.AGENDA_1}`);
    expect(screen.getAllByRole('button', { name: FECHAR }).length).toBeGreaterThan(0);

    // Fechar pelo botão empilha (não substitui): Voltar reabre o detalhe.
    screen.getAllByRole('button', { name: FECHAR })[0].click();
    await assentarMuito(8);
    expect(caminho()).toBe('/agenda');
    await ir(-1);
    await assentarMuito(4);
    expect(caminho()).toBe(`/agenda/${IDS.AGENDA_1}`);
    expect(screen.getAllByRole('button', { name: FECHAR }).length).toBeGreaterThan(0);
  }, TIMEOUT);
});

describe('Onda 2: legado', () => {
  it('sessionStorage antigo em "/": as chaves antigas somem e a tela abre na lista, sem CPF no endereço', async () => {
    sessionStorage.setItem('patientDetailTab', 'timeline');
    sessionStorage.setItem('activePatientCpf', pacienteDto.cpf);
    sessionStorage.setItem('activeView', 'pacientes');
    sessionStorage.setItem('patientView', 'profile');
    sessionStorage.setItem('selectedPatientCpf', pacienteDto.cpf);
    const destino = consumirChavesAntigas('/');
    for (const k of ['activeView', 'patientView', 'patientDetailTab', 'selectedPatientCpf', 'activePatientCpf']) expect(sessionStorage.getItem(k), k).toBeNull();
    expect(destino).toBe('/pacientes');

    await montarApp({ caminho: destino });
    await assentarMuito(4);
    expect(caminho()).toBe(caminhos.pacientes());
    expect(caminho()).not.toContain(pacienteDto.cpf);
    expect(screen.getAllByText('Próximos aniversários').length).toBeGreaterThan(0);
  }, TIMEOUT);
});
