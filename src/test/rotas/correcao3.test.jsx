/** Correção 3: rebusca depois de salvar sem piscar, sem rede extra no caso comum, falha só do detalhe da anamnese, paciente apagado sem laço. */
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { limparAmbienteSnapshot } from '../snapshotConsulta.jsx';
import { TIMEOUT, assentarMuito, clicarBotao, montarApp } from '../consulta/appConsulta.jsx';
import { IDS, pacienteDto } from '../encerrar/cenariosEncerrar.js';
import { sessaoFalsa } from './supabaseComEstado.js';
import { ultimoRoteador } from './montarComRoteador.jsx';
import { caminhos } from '../../rotas/caminhos.js';

vi.mock('../../lib/supabaseClient.js', async () => (await import('./supabaseComEstado.js')).supabaseComEstado());
vi.mock('../../contexts/AvisosProvider.jsx', async () => (await import('../consulta/canalAvisosTeste.jsx')).avisosProviderFalso());

const ID = 'c0000000-0000-4000-8000-0000000000ff';
const NOME = 'Zuleica Fora Da Pagina';
const outros = Array.from({ length: 20 }, (_, i) => ({
  ...pacienteDto,
  id: `c0000000-0000-4000-8000-${String(i + 1).padStart(12, '0')}`,
  nomeCompleto: `Paciente Pagina ${i + 1}`,
  cpf: `1000000${String(i).padStart(4, '0')}`,
}));
const pagina = () => ['GET', /^\/api\/v1\/pacientes(\/search)?$/, () => ({ content: outros, totalElements: 21, totalPages: 2, number: 0, size: 20 })];
const reId = (id) => new RegExp(`^/api/v1/pacientes/${id}$`);
const caminhoAtual = () => ultimoRoteador().state.location.pathname;
const veNome = () => screen.queryAllByText(new RegExp(NOME)).length > 0;

async function abrirEditarCadastro() {
  clicarBotao(/^Cadastro$/);
  await assentarMuito();
  clicarBotao(/^Editar$/);
  await assentarMuito();
}

const servidorFora = () => ({ ...pacienteDto, id: ID, nomeCompleto: NOME, cpf: '11144477735', email: 'antigo@teste.com', estadoCivilId: 'ec-1', profissaoId: 'pr-1' });

afterEach(() => {
  limparAmbienteSnapshot();
  sessionStorage.clear();
  localStorage.clear();
});

describe('correção 3', () => {
  it('1) [ACHADO: a lista pisca] rebusca depois de salvar: não pisca para a lista, endereço fixo; registra se o perfil desmonta', async () => {
    sessaoFalsa.definir('usr-1');
    const servidor = servidorFora();
    const puts = [];
    let gets = 0;
    let liberar;
    const portao = new Promise((r) => { liberar = r; });
    await montarApp({
      caminho: caminhos.paciente(ID),
      rotas: [
        pagina(),
        ['GET', reId(ID), async () => { gets += 1; if (puts.length > 0 && gets > 2) await portao; return { ...servidor }; }],
        ['PUT', reId(ID), ({ body }) => { puts.push(body); Object.assign(servidor, { email: body.email }); return { ...servidor }; }],
      ],
    });
    await waitFor(() => expect(veNome()).toBe(true), { timeout: 8000 });
    await assentarMuito(6);
    await abrirEditarCadastro();
    fireEvent.change(screen.getByPlaceholderText('email@exemplo.com'), { target: { value: 'novo@teste.com' } });

    const amostras = [];
    const obs = new MutationObserver(() => amostras.push({ lista: !!screen.queryByText('Paciente Pagina 1'), perfil: veNome(), caminho: caminhoAtual(), gets, puts: puts.length, form: !!screen.queryByPlaceholderText('email@exemplo.com'), spin: !!document.querySelector('.animate-spin') }));
    obs.observe(document.body, { childList: true, subtree: true, characterData: true });
    clicarBotao(/Salvar Altera/);
    await waitFor(() => expect(puts).toHaveLength(1), { timeout: 8000 });
    await waitFor(() => expect(gets).toBeGreaterThan(2), { timeout: 8000 });
    await assentarMuito(6);
    const naJanela = { perfilVisivel: veNome(), lista: !!screen.queryByText('Paciente Pagina 1'), caminho: caminhoAtual(), form: !!screen.queryByPlaceholderText('email@exemplo.com') };
    liberar();
    await assentarMuito(8);
    obs.disconnect();
    console.log('C3-SEQ', JSON.stringify(amostras.map((a) => [a.lista ? 'L' : '-', a.perfil ? 'P' : '-', a.form ? 'F' : '-', a.spin ? 'S' : '-', a.gets, a.puts].join(''))));
    console.log('C3-ITEM1', JSON.stringify({ naJanela, gets, amostras: amostras.length, algumaLista: amostras.some((a) => a.lista), perfilSumiu: amostras.some((a) => !a.perfil), caminhos: [...new Set(amostras.map((a) => a.caminho))], formDepois: !!screen.queryByPlaceholderText('email@exemplo.com') }));
    expect(amostras.some((a) => a.lista)).toBe(false);
    expect(naJanela.lista).toBe(false);
    expect(amostras.every((a) => a.caminho.startsWith(caminhos.paciente(ID)))).toBe(true);
    await waitFor(() => expect(veNome()).toBe(true), { timeout: 8000 });
  }, TIMEOUT);

  it('2) paciente da 1ª página: salvar não faz nenhum GET do paciente por id', async () => {
    sessaoFalsa.definir('usr-1');
    const alvo = { ...pacienteDto, id: IDS.PACIENTE, email: 'antigo@teste.com', estadoCivilId: 'ec-1', profissaoId: 'pr-1' };
    const gets = [];
    const puts = [];
    await montarApp({
      caminho: caminhos.paciente(IDS.PACIENTE),
      rotas: [
        ['GET', /^\/api\/v1\/pacientes(\/search)?$/, () => ({ content: [alvo], totalElements: 1, totalPages: 1, number: 0, size: 20 })],
        ['GET', reId(IDS.PACIENTE), () => { gets.push(1); return { ...alvo }; }],
        ['PUT', reId(IDS.PACIENTE), ({ body }) => { puts.push(body); Object.assign(alvo, { email: body.email }); return { ...alvo }; }],
      ],
    });
    await waitFor(() => expect(screen.getAllByText(/Maria Souza/).length).toBeGreaterThan(0), { timeout: 8000 });
    await assentarMuito(6);
    const antes = gets.length;
    await abrirEditarCadastro();
    fireEvent.change(screen.getByPlaceholderText('email@exemplo.com'), { target: { value: 'novo@teste.com' } });
    clicarBotao(/Salvar Altera/);
    await waitFor(() => expect(puts).toHaveLength(1), { timeout: 8000 });
    await assentarMuito(8);
    console.log('C3-ITEM2', JSON.stringify({ antes, depois: gets.length }));
    expect(gets.length - antes).toBeLessThanOrEqual(3); // os 3 do próprio salvar/perfil (medido); o hook não soma
  }, TIMEOUT);

  it('3) falha só do detalhe da anamnese em /editar: erro com Cancelar, sem Carregando eterno', async () => {
    sessaoFalsa.definir('usr-1');
    const P = IDS.PACIENTE;
    const lista = [{ id: 'AN-2', anamneseId: 'FICHA-1', anamneseNome: 'Ficha numero 2', dataHora: '2026-10-02T12:00:00Z', respostas: [] }];
    const aviso = vi.spyOn(console, 'warn').mockImplementation(() => {});
    await montarApp({
      caminho: caminhos.pacienteAnamnese(P, 'AN-2', { editar: true }),
      rotas: [
        ['GET', new RegExp(`^/api/v1/anamnese/paciente/${P}$`), () => lista],
        ['GET', new RegExp(`^/api/v1/anamnese/paciente/${P}/AN-2$`), () => ({ status: 500, corpo: { error: 'Erro interno', status: 500 } })],
        ['GET', /^\/api\/v1\/anamnese\/fichas\/FICHA-1$/, () => ({ id: 'FICHA-1', nome: 'Ficha', itens: [] })],
      ],
    });
    await assentarMuito(8);
    aviso.mockRestore();
    await waitFor(() => expect(screen.queryByText('Carregando anamnese...')).toBeNull());
    expect(await screen.findByText('Não foi possível carregar a anamnese.')).toBeTruthy();
    fireEvent.click(screen.getAllByRole('button', { name: /^Cancelar$/ })[0]);
    await assentarMuito();
    expect(caminhoAtual()).toBe(caminhos.pacienteAnamnese(P, 'AN-2'));
  }, TIMEOUT);

  it('4) paciente apagado depois de aberto (qualquer GET devolve 404): salvar não rebusca, perfil fica, sem laço de buscas (404 na 1ª abertura: pacienteInexistente.test)', async () => {
    sessaoFalsa.definir('usr-1');
    const servidor = servidorFora();
    const puts = [];
    let gets = 0;
    let depoisDoPut = 0; // o 1º GET depois do PUT é o "fresh" do próprio salvar; o seguinte é a rebusca do perfil
    await montarApp({
      caminho: caminhos.paciente(ID),
      rotas: [
        pagina(),
        ['GET', reId(ID), () => { gets += 1; if (puts.length > 0) depoisDoPut += 1; return depoisDoPut > 1 ? { status: 404, corpo: { error: 'x', status: 404 } } : { ...servidor }; }],
        ['PUT', reId(ID), ({ body }) => { puts.push(body); return { ...servidor, email: body.email }; }],
      ],
    });
    await waitFor(() => expect(veNome()).toBe(true), { timeout: 8000 });
    await assentarMuito(6);
    await abrirEditarCadastro();
    fireEvent.change(screen.getByPlaceholderText('email@exemplo.com'), { target: { value: 'novo@teste.com' } });
    clicarBotao(/Salvar Altera/);
    await waitFor(() => expect(puts).toHaveLength(1), { timeout: 8000 });
    await assentarMuito(6);
    await waitFor(() => expect(screen.queryByText('Não encontrado')).toBeNull());
    expect(veNome()).toBe(true);
    const n = gets;
    await assentarMuito(12);
    console.log('C3-ITEM4', JSON.stringify({ getsNoNaoEncontrado: n, getsDepois: gets }));
    expect(gets).toBe(n);
    expect(caminhoAtual()).toBe(caminhos.paciente(ID));
  }, TIMEOUT);
});
