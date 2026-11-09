/** Cópia guardada do perfil fora da 1ª página: depois de salvar, ir à Agenda e Voltar, a edição mostra o valor novo (nunca a cópia da 1ª busca). */
import { useSyncExternalStore } from 'react';
import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { limparAmbienteSnapshot } from '../snapshotConsulta.jsx';
import { TIMEOUT, assentarMuito, clicarBotao, montarApp } from '../consulta/appConsulta.jsx';
import { pacienteDto } from '../encerrar/cenariosEncerrar.js';
import { sessaoFalsa } from './supabaseComEstado.js';
import { ultimoRoteador } from './montarComRoteador.jsx';
import { caminhos } from '../../rotas/caminhos.js';

vi.mock('../../lib/supabaseClient.js', async () => (await import('./supabaseComEstado.js')).supabaseComEstado());
vi.mock('../../contexts/AvisosProvider.jsx', async () => (await import('../consulta/canalAvisosTeste.jsx')).avisosProviderFalso());

// Fuso controlável: mudar o fuso refaz a busca de `patients` (refreshPatients) com o perfil fora da tela, como um refresh da lista longe do paciente.
const fusoTeste = vi.hoisted(() => {
  const ouvintes = new Set();
  return { valor: 'America/Sao_Paulo', ouvintes, mudar(v) { this.valor = v; ouvintes.forEach((f) => f()); } };
});
vi.mock('../../components/hooks/useFusoClinica.js', () => ({
  useFusoClinica: () => {
    const fuso = useSyncExternalStore((f) => { fusoTeste.ouvintes.add(f); return () => fusoTeste.ouvintes.delete(f); }, () => fusoTeste.valor);
    return { fuso, pronto: true, recarregarFuso: () => {} };
  },
}));

const ID = 'c0000000-0000-4000-8000-0000000000ff';
const NOME = 'Zuleica Fora Da Pagina';
const outros = Array.from({ length: 20 }, (_, i) => ({
  ...pacienteDto,
  id: `c0000000-0000-4000-8000-${String(i + 1).padStart(12, '0')}`,
  nomeCompleto: `Paciente Pagina ${i + 1}`,
  cpf: `1000000${String(i).padStart(4, '0')}`,
}));
const campo = () => screen.queryByPlaceholderText('email@exemplo.com');
const veNome = () => screen.queryAllByText(new RegExp(NOME)).length > 0;

async function abrirEditarCadastro() {
  clicarBotao(/^Cadastro$/);
  await assentarMuito();
  clicarBotao(/^Editar$/);
  await assentarMuito();
}

describe('cópia guardada do paciente fora da página', () => {
  afterEach(() => {
    limparAmbienteSnapshot();
    sessionStorage.clear();
    localStorage.clear();
  });

  it('salvar, ir à Agenda e Voltar: a edição do cadastro mostra o e-mail novo e o 2º Salvar envia o novo', async () => {
    fusoTeste.valor = 'America/Sao_Paulo';
    sessaoFalsa.definir('usr-1');
    const servidor = { ...pacienteDto, id: ID, nomeCompleto: NOME, cpf: '11144477735', email: 'antigo@teste.com', estadoCivilId: 'ec-1', profissaoId: 'pr-1' };
    const puts = [];
    let voltou = false;
    let getsDepoisDeVoltar = 0;
    let liberar;
    const portao = new Promise((r) => { liberar = r; });
    await montarApp({
      caminho: caminhos.paciente(ID),
      rotas: [
        ['GET', /^\/api\/v1\/pacientes(\/search)?$/, () => ({ content: outros, totalElements: 21, totalPages: 2, number: 0, size: 20 })],
        ['GET', new RegExp(`^/api/v1/pacientes/${ID}$`), async () => {
          // a rebusca de quando o perfil volta fica presa: a tela só pode usar a cópia guardada se ela estiver atual
          if (voltou) { getsDepoisDeVoltar += 1; await portao; }
          return { ...servidor };
        }],
        ['PUT', new RegExp(`^/api/v1/pacientes/${ID}$`), ({ body }) => { puts.push(body); Object.assign(servidor, { email: body.email }); return { ...servidor }; }],
      ],
    });
    await waitFor(() => expect(veNome()).toBe(true), { timeout: 8000 });
    await assentarMuito(6);

    await abrirEditarCadastro();
    expect(campo().value).toBe('antigo@teste.com');
    fireEvent.change(campo(), { target: { value: 'novo@teste.com' } });
    clicarBotao(/Salvar Altera/);
    await waitFor(() => expect(puts).toHaveLength(1), { timeout: 8000 });
    await assentarMuito(8);

    act(() => { ultimoRoteador().navigate(caminhos.agenda()); });
    await assentarMuito(8);
    expect(ultimoRoteador().state.location.pathname).toBe('/agenda');

    // refresh da lista com o paciente fora da rota: a 1ª página não o traz e ele sai de `patients`
    act(() => fusoTeste.mudar('America/Manaus'));
    await assentarMuito(8);

    voltou = true;
    act(() => { ultimoRoteador().navigate(-1); });
    await assentarMuito(8);
    expect(ultimoRoteador().state.location.pathname).toBe(caminhos.paciente(ID));
    // com a rebusca presa, nunca a cópia velha: ou carregando, ou o perfil já com o novo
    if (veNome() && screen.queryAllByRole('button', { name: /^Cadastro$/ }).length) {
      await abrirEditarCadastro();
      expect(campo()?.value ?? 'novo@teste.com').not.toBe('antigo@teste.com');
    }

    liberar();
    await assentarMuito(8);
    await waitFor(() => expect(veNome()).toBe(true), { timeout: 8000 });
    if (!campo()) await abrirEditarCadastro();
    expect(campo().value).toBe('novo@teste.com');
    clicarBotao(/Salvar Altera/);
    await waitFor(() => expect(puts).toHaveLength(2), { timeout: 8000 });
    expect(puts[1].email).toBe('novo@teste.com');
    expect(getsDepoisDeVoltar).toBeGreaterThan(0);
  }, TIMEOUT);
});
