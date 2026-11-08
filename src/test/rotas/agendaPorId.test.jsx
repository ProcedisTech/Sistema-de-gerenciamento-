/** Detalhe do agendamento pelo endereço: abrir empilha /agenda/<id>; F5 reabre; id inexistente mostra "Não encontrado". */
import { fireEvent, screen } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { limparAmbienteSnapshot } from '../snapshotConsulta.jsx';
import { IDS, agendaDto } from '../encerrar/cenariosEncerrar.js';
import { TIMEOUT, assentarMuito, montarApp } from '../consulta/appConsulta.jsx';
import { caminhos } from '../../rotas/caminhos.js';
import { ultimoRoteador } from './montarComRoteador.jsx';

vi.mock('../../lib/supabaseClient.js', async () => (await import('../encerrar/servidorEncerrarFalso.js')).supabaseFalso());
vi.mock('../../contexts/AvisosProvider.jsx', async () => (await import('../consulta/canalAvisosTeste.jsx')).avisosProviderFalso());

const dto = agendaDto({ id: IDS.AGENDA_1 });
const FECHAR = /Fechar detalhe do agendamento/;
const rotaDoItem = [['GET', new RegExp(`^/api/v1/agendas/${IDS.AGENDA_1}$`), () => dto]];
const rota404 = [['GET', /^\/api\/v1\/agendas\/inexistente$/, () => ({ status: 404, corpo: { error: 'Agendamento não encontrado', status: 404 } })]];

beforeAll(() => {
  Element.prototype.scrollTo = () => {}; // a grade da semana rola até a hora; jsdom não tem
});

afterEach(() => {
  limparAmbienteSnapshot();
  sessionStorage.clear();
  localStorage.clear();
});

describe('detalhe do agendamento pelo endereço', () => {
  it('F5 em /agenda/<id> reabre o detalhe na semana do item; fechar empilha /agenda', async () => {
    await montarApp({ view: 'agenda', caminho: caminhos.agenda(IDS.AGENDA_1), agendas: [dto], rotas: rotaDoItem });
    await assentarMuito(8);
    const r = ultimoRoteador();
    expect(r.state.location.pathname).toBe(`/agenda/${IDS.AGENDA_1}`);
    expect(screen.getAllByRole('button', { name: FECHAR }).length).toBeGreaterThan(0);

    screen.getAllByRole('button', { name: FECHAR })[0].click();
    await assentarMuito(8);
    expect(r.state.location.pathname).toBe('/agenda');
    expect(r.state.historyAction).toBe('PUSH');
    expect(screen.queryAllByRole('button', { name: FECHAR })).toHaveLength(0);

    fireEvent.click(screen.getAllByRole('button', { name: /^Detalhes: / })[0]);
    await assentarMuito(8);
    expect(r.state.location.pathname).toBe(`/agenda/${IDS.AGENDA_1}`);
    expect(r.state.historyAction).toBe('PUSH');
    expect(screen.getAllByRole('button', { name: FECHAR }).length).toBeGreaterThan(0);
  }, TIMEOUT);

  it('navegar a /agenda/<id> abre o detalhe e voltar fecha', async () => {
    await montarApp({ view: 'agenda', caminho: caminhos.agenda(IDS.AGENDA_1), agendas: [dto], rotas: rotaDoItem });
    await assentarMuito(8);
    const r = ultimoRoteador();
    await r.navigate(caminhos.agenda());
    await assentarMuito(8);
    expect(screen.queryAllByRole('button', { name: FECHAR })).toHaveLength(0);

    await r.navigate(caminhos.agenda(IDS.AGENDA_1));
    await assentarMuito(8);
    expect(r.state.historyAction).toBe('PUSH');
    expect(screen.getAllByRole('button', { name: FECHAR }).length).toBeGreaterThan(0);
    await r.navigate(-1);
    await assentarMuito(8);
    expect(screen.queryAllByRole('button', { name: FECHAR })).toHaveLength(0);
  }, TIMEOUT);

  it('id inexistente (404): "Não encontrado" no lugar do detalhe, sem quebrar', async () => {
    await montarApp({ view: 'agenda', caminho: caminhos.agenda('inexistente'), agendas: [dto], rotas: rota404 });
    await assentarMuito(8);
    expect(screen.getByText('Não encontrado')).toBeTruthy();
    expect(screen.queryAllByRole('button', { name: FECHAR })).toHaveLength(0);
  }, TIMEOUT);

  it('horário vazio da semana: sem detalhe aberto não empilha /agenda; com detalhe aberto, fecha empilhando', async () => {
    const SLOT = /^Novo agendamento às /;
    await montarApp({ view: 'agenda', caminho: caminhos.agenda(IDS.AGENDA_1), agendas: [dto], rotas: rotaDoItem });
    await assentarMuito(8);
    const r = ultimoRoteador();
    screen.getAllByRole('button', { name: FECHAR })[0].click(); // abre na semana; ao fechar a visão semana permanece
    await assentarMuito(8);
    expect(r.state.location.pathname).toBe('/agenda');
    const tamanho = window.history.length;
    const acao = r.state.historyAction;
    const chave = r.state.location.key; // navegar ao mesmo endereço gera chave nova (o router troca PUSH por REPLACE)
    fireEvent.click(screen.getAllByRole('button', { name: SLOT })[0]);
    await assentarMuito(8);
    expect(r.state.location.pathname).toBe('/agenda');
    expect(r.state.historyAction).toBe(acao);
    expect(r.state.location.key).toBe(chave);
    expect(window.history.length).toBe(tamanho);

    await r.navigate(caminhos.agenda(IDS.AGENDA_1));
    await assentarMuito(8);
    expect(screen.getAllByRole('button', { name: FECHAR }).length).toBeGreaterThan(0);
    fireEvent.click(screen.getAllByRole('button', { name: SLOT })[0]);
    await assentarMuito(8);
    expect(r.state.location.pathname).toBe('/agenda');
    expect(r.state.historyAction).toBe('PUSH');
  }, TIMEOUT);
});
