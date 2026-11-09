/** Paciente fora da 1ª página, salvar o cadastro: uma cópia antiga nunca volta para a tela (nem para o próximo Salvar). */
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { limparAmbienteSnapshot } from '../snapshotConsulta.jsx';
import { TIMEOUT, assentarMuito, clicarBotao, montarApp } from '../consulta/appConsulta.jsx';
import { pacienteDto } from '../encerrar/cenariosEncerrar.js';
import { sessaoFalsa } from './supabaseComEstado.js';
import { caminhos } from '../../rotas/caminhos.js';

vi.mock('../../lib/supabaseClient.js', async () => (await import('./supabaseComEstado.js')).supabaseComEstado());
vi.mock('../../contexts/AvisosProvider.jsx', async () => (await import('../consulta/canalAvisosTeste.jsx')).avisosProviderFalso());

const ID = 'c0000000-0000-4000-8000-0000000000ff';
const outros = Array.from({ length: 20 }, (_, i) => ({
  ...pacienteDto,
  id: `c0000000-0000-4000-8000-${String(i + 1).padStart(12, '0')}`,
  nomeCompleto: `Paciente Pagina ${i + 1}`,
  cpf: `1000000${String(i).padStart(4, '0')}`,
}));

const emailAtual = () => screen.getByPlaceholderText('email@exemplo.com').value;

async function abrirEditarCadastro() {
  clicarBotao(/^Cadastro$/);
  await assentarMuito();
  clicarBotao(/^Editar$/);
  await assentarMuito();
}

describe('salvar cadastro de paciente fora da página da lista', () => {
  afterEach(() => {
    limparAmbienteSnapshot();
    sessionStorage.clear();
    localStorage.clear();
  });

  it('depois de salvar, enquanto a busca nova não chega, a cópia antiga não volta; depois o perfil e o 2º Salvar usam o novo', async () => {
    sessaoFalsa.definir('usr-1');
    const servidor = { ...pacienteDto, id: ID, nomeCompleto: 'Zuleica Fora Da Pagina', cpf: '11144477735', email: 'antigo@teste.com', estadoCivilId: 'ec-1', profissaoId: 'pr-1' };
    const puts = [];
    let getsDepoisDoPut = 0;
    let liberar;
    const portao = new Promise((r) => { liberar = r; });
    await montarApp({
      caminho: caminhos.paciente(ID),
      rotas: [
        ['GET', /^\/api\/v1\/pacientes(\/search)?$/, () => ({ content: outros, totalElements: 21, totalPages: 2, number: 0, size: 20 })],
        ['GET', new RegExp(`^/api/v1/pacientes/${ID}$`), async () => {
          // 1º GET depois do PUT é o "fresh" do próprio salvar; os seguintes (rebusca do perfil) ficam presos.
          if (puts.length > 0 && (getsDepoisDoPut += 1) > 1) await portao;
          return { ...servidor };
        }],
        ['PUT', new RegExp(`^/api/v1/pacientes/${ID}$`), ({ body }) => { puts.push(body); Object.assign(servidor, { email: body.email }); return { ...servidor }; }],
      ],
    });
    await waitFor(() => expect(screen.getAllByText(/Zuleica Fora Da Pagina/).length).toBeGreaterThan(0), { timeout: 8000 });
    await assentarMuito(6);

    await abrirEditarCadastro();
    expect(emailAtual()).toBe('antigo@teste.com');
    fireEvent.change(screen.getByPlaceholderText('email@exemplo.com'), { target: { value: 'novo@teste.com' } });
    clicarBotao(/Salvar Altera/);
    await waitFor(() => expect(puts).toHaveLength(1), { timeout: 8000 });
    expect(puts[0].email).toBe('novo@teste.com');
    await waitFor(() => expect(getsDepoisDoPut).toBeGreaterThan(1), { timeout: 8000 });
    await assentarMuito(6);

    // janela da rebusca: se o formulário abrir agora, jamais com o e-mail antigo
    if (screen.queryAllByRole('button', { name: /^Cadastro$/ }).length) {
      await abrirEditarCadastro();
      await waitFor(() => expect(screen.queryByPlaceholderText('email@exemplo.com')?.value ?? 'novo@teste.com').not.toBe('antigo@teste.com'));
    }

    liberar();
    await assentarMuito(8);
    await waitFor(() => expect(screen.getAllByText(/Zuleica Fora Da Pagina/).length).toBeGreaterThan(0), { timeout: 8000 });
    if (!screen.queryByPlaceholderText('email@exemplo.com')) await abrirEditarCadastro();
    expect(emailAtual()).toBe('novo@teste.com');
    clicarBotao(/Salvar Altera/);
    await waitFor(() => expect(puts).toHaveLength(2), { timeout: 8000 });
    expect(puts[1].email).toBe('novo@teste.com');
  }, TIMEOUT);
});
