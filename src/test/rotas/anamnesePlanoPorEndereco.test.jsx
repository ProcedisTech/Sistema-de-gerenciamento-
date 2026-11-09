/** Anamnese e plano por endereço: o caminho é a única fonte da ficha aberta, do modo editar e do plano aberto. */
import { act, cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { limparAmbienteSnapshot } from '../snapshotConsulta.jsx';
import { assentarMuito, montarApp, TIMEOUT } from '../consulta/appConsulta.jsx';
import { IDS } from '../encerrar/cenariosEncerrar.js';
import { caminhos } from '../../rotas/caminhos.js';
import { ultimoRoteador } from './montarComRoteador.jsx';

vi.mock('../../lib/supabaseClient.js', async () => (await import('../encerrar/servidorEncerrarFalso.js')).supabaseFalso());
vi.mock('../../contexts/AvisosProvider.jsx', async () => (await import('../consulta/canalAvisosTeste.jsx')).avisosProviderFalso());

const P = IDS.PACIENTE;
const AN = (n) => `AN-${n}`;
const lista = [1, 2].map((n) => ({
  id: AN(n), anamneseId: 'FICHA-1', anamneseNome: `Ficha numero ${n}`, dataHora: `2026-10-0${n}T12:00:00Z`, respostas: [],
}));
const PLANO = (n) => ({
  id: `b0000000-0000-4000-8000-00000000000${n}`, observacao: '', statusCodigo: n === 1 ? 'ativo' : 'concluido',
  criadoEm: `2026-09-0${n}T13:00:00.000Z`, valorTotal: 0, itens: [],
});
const rotasAnamnese = [
  ['GET', new RegExp(`^/api/v1/anamnese/paciente/${P}$`), () => lista],
  ['GET', new RegExp(`^/api/v1/anamnese/paciente/${P}/AN-\\d$`), ({ path }) => lista.find((a) => path.endsWith(a.id))],
  ['GET', /^\/api\/v1\/anamnese\/fichas\/FICHA-1$/, () => ({ id: 'FICHA-1', nome: 'Ficha', itens: [] })],
];
const caminhoAtual = () => ultimoRoteador().state.location.pathname;
const montar = (caminho, rotas = rotasAnamnese) => montarApp({ caminho, rotas });

afterEach(() => {
  limparAmbienteSnapshot();
  sessionStorage.clear();
  localStorage.clear();
});

describe('Anamnese por endereço', () => {
  it('link direto abre a ficha do endereço (não a primeira)', async () => {
    await montar(caminhos.pacienteAnamnese(P, AN(2)));
    await waitFor(() => expect(screen.getByRole('combobox').value).toBe(AN(2)));
  }, TIMEOUT);

  it('trocar a ficha empilha o endereço; Modificar empilha /editar; Cancelar empilha a própria ficha', async () => {
    await montar(caminhos.pacienteAnamnese(P, AN(1)));
    await waitFor(() => expect(screen.getByRole('combobox').value).toBe(AN(1)));
    fireEvent.change(screen.getByRole('combobox'), { target: { value: AN(2) } });
    await assentarMuito();
    expect(caminhoAtual()).toBe(caminhos.pacienteAnamnese(P, AN(2)));
    const antes = ultimoRoteador().state.historyAction;
    expect(antes).toBe('PUSH');

    fireEvent.click(await screen.findByRole('button', { name: /^Modificar$/ }));
    await assentarMuito();
    expect(caminhoAtual()).toBe(caminhos.pacienteAnamnese(P, AN(2), { editar: true }));
    expect(ultimoRoteador().state.historyAction).toBe('PUSH');
    expect(await screen.findByText('Modificar anamnese')).toBeTruthy();

    fireEvent.click(screen.getAllByRole('button', { name: /^Cancelar$/ })[0]);
    await assentarMuito();
    expect(caminhoAtual()).toBe(caminhos.pacienteAnamnese(P, AN(2)));
    expect(ultimoRoteador().state.historyAction).toBe('PUSH');
    await waitFor(() => expect(screen.queryByText('Modificar anamnese')).toBeNull());
    await waitFor(() => expect(screen.getByRole('combobox').value).toBe(AN(2)));
  }, TIMEOUT);

  it('F5 no mesmo endereço mantém a ficha e o modo editar', async () => {
    await montar(caminhos.pacienteAnamnese(P, AN(2), { editar: true }));
    expect(await screen.findByText('Modificar anamnese')).toBeTruthy();
    cleanup();
    await montar(caminhos.pacienteAnamnese(P, AN(2), { editar: true }));
    expect(await screen.findByText('Modificar anamnese')).toBeTruthy();
    expect(caminhoAtual()).toBe(caminhos.pacienteAnamnese(P, AN(2), { editar: true }));
  }, TIMEOUT);

  it('F5 em /editar com o detalhe atrasado: sem "Salvar Alterações" até o detalhe chegar; depois campos preenchidos', async () => {
    let liberar;
    const segurado = new Promise((r) => { liberar = r; });
    const rotas = rotasAnamnese.map((r) => (String(r[1]).includes('AN-') ? ['GET', r[1], async (ctx) => { await segurado; return r[2](ctx); }] : r));
    await montar(caminhos.pacienteAnamnese(P, AN(2), { editar: true }), rotas);
    await assentarMuito();
    await waitFor(() => expect(screen.queryByRole('button', { name: /Salvar Altera/ })).toBeNull());
    await waitFor(() => expect(screen.queryByText('Modificar anamnese')).toBeNull());
    liberar();
    expect(await screen.findByText('Modificar anamnese')).toBeTruthy();
    expect(screen.getByRole('button', { name: /Salvar Altera/ })).toBeTruthy();
  }, TIMEOUT);

  it('F5 em /editar com a ficha falhando: mostra o erro e Cancelar volta para a ficha (push), sem ficar em Carregando', async () => {
    const rotas = rotasAnamnese.map((r) => (String(r[1]).includes('fichas') ? ['GET', r[1], () => ({ status: 500, corpo: { error: 'Erro interno', status: 500 } })] : r));
    await montar(caminhos.pacienteAnamnese(P, AN(2), { editar: true }), rotas);
    expect(await screen.findByText('Não foi possível carregar a anamnese.')).toBeTruthy();
    await waitFor(() => expect(screen.queryByText('Carregando anamnese...')).toBeNull());
    fireEvent.click(screen.getAllByRole('button', { name: /^Cancelar$/ })[0]);
    await assentarMuito();
    expect(caminhoAtual()).toBe(caminhos.pacienteAnamnese(P, AN(2)));
    expect(ultimoRoteador().state.historyAction).toBe('PUSH');
  }, TIMEOUT);

  it('salvar a edição substitui o endereço: Voltar não reabre o editor', async () => {
    const rotas = [...rotasAnamnese, ['PUT', new RegExp(`^/api/v1/anamnese/paciente/${P}/AN-\\d$`), () => lista[1]]];
    await montar(caminhos.pacienteAnamnese(P, AN(2)), rotas);
    await waitFor(() => expect(screen.getByRole('combobox').value).toBe(AN(2)));
    fireEvent.click(await screen.findByRole('button', { name: /^Modificar$/ }));
    fireEvent.click(await screen.findByRole('button', { name: /Salvar Altera/ }));
    await waitFor(() => expect(caminhoAtual()).toBe(caminhos.pacienteAnamnese(P, AN(2))));
    expect(ultimoRoteador().state.historyAction).toBe('REPLACE');
    await act(async () => { await ultimoRoteador().navigate(-1); });
    await assentarMuito();
    expect(caminhoAtual()).not.toBe(caminhos.pacienteAnamnese(P, AN(2), { editar: true }));
  }, TIMEOUT);

  it('anamnese inexistente no endereço mostra Não encontrado', async () => {
    await montar(caminhos.pacienteAnamnese(P, 'AN-99'));
    expect(await screen.findByText('Não encontrado')).toBeTruthy();
    await waitFor(() => expect(screen.queryByRole('combobox')).toBeNull());
  }, TIMEOUT);
});

describe('Plano por endereço', () => {
  const rotasPlano = (planos) => [
    ['GET', /^\/api\/v1\/planejamentos$/, () => planos],
    ['GET', /^\/api\/v1\/planejamentos\/[^/]+$/, ({ path }) => planos.find((p) => path.endsWith(p.id))],
  ];

  it('link direto abre e destaca só o plano do endereço', async () => {
    await montar(caminhos.pacientePlano(P, PLANO(2).id), rotasPlano([PLANO(1), PLANO(2)]));
    await waitFor(() => expect(document.querySelector('[data-plano-alvo="true"]')).not.toBeNull());
    expect(document.querySelectorAll('[data-plano-alvo]')).toHaveLength(1);
  }, TIMEOUT);

  it('plano inexistente no endereço mostra Não encontrado', async () => {
    await montar(caminhos.pacientePlano(P, PLANO(9).id), rotasPlano([PLANO(1), PLANO(2)]));
    expect(await screen.findByText('Não encontrado')).toBeTruthy();
    await waitFor(() => expect(document.querySelector('[data-plano-alvo]')).toBeNull());
  }, TIMEOUT);

  it('o plano do endereço (fechado por padrão) fecha no 1º clique', async () => {
    await montar(caminhos.pacientePlano(P, PLANO(2).id), rotasPlano([PLANO(1), PLANO(2)]));
    await waitFor(() => expect(document.querySelector('[data-plano-alvo="true"] .rotate-180')).not.toBeNull());
    fireEvent.click(document.querySelector('[data-plano-alvo="true"] div.cursor-pointer.select-none'));
    await assentarMuito();
    await waitFor(() => expect(document.querySelector('[data-plano-alvo="true"] .rotate-180')).toBeNull());
  }, TIMEOUT);

  it('sem a prop nada é destacado (consulta e perfil sem endereço de plano)', async () => {
    await montar(caminhos.paciente(P), rotasPlano([PLANO(1), PLANO(2)]));
    await assentarMuito();
    await waitFor(() => expect(document.querySelector('[data-plano-alvo]')).toBeNull());
  }, TIMEOUT);

  it('abrir um plano fechado empilha o endereço do plano', async () => {
    await montar(caminhos.paciente(P), rotasPlano([PLANO(1), PLANO(2)]));
    await assentarMuito();
    const cabs = Array.from(document.querySelectorAll('div.cursor-pointer.select-none'));
    const cab = cabs[0]; // concluído (mais novo primeiro): nasce fechado
    fireEvent.click(cab);
    await assentarMuito();
    expect(caminhoAtual()).toBe(caminhos.pacientePlano(P, PLANO(2).id));
    expect(ultimoRoteador().state.historyAction).toBe('PUSH');
  }, TIMEOUT);
});
