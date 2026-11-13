/** Onda 6 "Ver como" com o App MONTADO: a guarda continua no papel real; menu/cabeçalho seguem a pessoa vista. */
import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { limparAmbienteSnapshot } from '../snapshotConsulta.jsx';
import { ROLE_USER_ID } from '../encerrar/servidorEncerrarFalso.js';
import { assentarMuito, montarApp, TIMEOUT } from '../consulta/appConsulta.jsx';
import { PERMISSOES } from '../../constants/permissoes.js';
import { caminhos } from '../../rotas/caminhos.js';
import { ultimoRoteador } from './montarComRoteador.jsx';
import { sessaoFalsa } from './supabaseComEstado.js';

vi.mock('../../lib/supabaseClient.js', async () => (await import('./supabaseComEstado.js')).supabaseComEstado());
vi.mock('../../contexts/AvisosProvider.jsx', async () => (await import('../consulta/canalAvisosTeste.jsx')).avisosProviderFalso());
// Sem botão "Ver como" ainda: captura o valor do contexto para chamar entrar() de dentro do provider real.
const captura = vi.hoisted(() => ({ previa: null }));
vi.mock('../../contexts/PreviaAcessoContext.jsx', async () => {
  const real = await vi.importActual('../../contexts/PreviaAcessoContext.jsx');
  return { ...real, usePreviaAcesso: () => (captura.previa = real.usePreviaAcesso()) };
});

const OUTRO = 'bbbbbbbb-0000-4000-8000-000000000002';
const equipe = [
  { id: ROLE_USER_ID, nomeCompleto: 'Beatriz Lima', perfilAcessoId: 'p1', perfilAcessoNome: 'Dono', roleId: 'd', roleName: 'DENTISTA', ativo: true },
  { id: OUTRO, nomeCompleto: 'Bruno Silva', perfilAcessoId: 'p1', perfilAcessoNome: 'Dono', roleId: 'd', roleName: 'DENTISTA', ativo: true },
];
const rotas = [
  ['GET', /^\/api\/v1\/equipe$/, () => equipe],
  ['GET', /^\/api\/v1\/perfil$/, () => ({ id: ROLE_USER_ID, nomeCompleto: 'Beatriz Pessoal' })],
];
const SECRETARIA = Object.values(PERMISSOES).filter(
  (p) => p !== PERMISSOES.ACESSO_CONFIGURACOES_VER && p !== PERMISSOES.ATENDIMENTO_REALIZAR,
);
// Menu = desktop ("Gestão de Equipe") ou barra móvel ("Equipe"); o botão de voltar da página (.btn-g) tem o mesmo nome e não é menu.
const temMenu = (nome) => screen
  .queryAllByRole('button', { name: new RegExp(`^${nome === 'Gestão de Equipe' ? '(Gestão de )?Equipe( · \\d+ pendências?)?$' : nome}`) })
  .some((b) => !b.classList.contains('btn-g'));
const temConsulta = () => screen.queryAllByRole('button', { name: 'Iniciar consulta' }).length > 0;

afterEach(() => {
  limparAmbienteSnapshot();
  sessionStorage.clear();
  localStorage.clear();
});

describe('Ver como (prévia de acesso) com o App montado', () => {
  it('entra na prévia sem sair da rota, esconde Gestão de Equipe e Consulta, sem chamada nova, e sai', async () => {
    sessaoFalsa.definir('usr-1');
    await montarApp({ rotas, caminho: caminhos.membro(OUTRO) });
    const chamadas = vi.fn(globalThis.fetch);
    vi.stubGlobal('fetch', chamadas);
    await waitFor(() => expect(temMenu('Pacientes')).toBe(true));
    expect(temMenu('Gestão de Equipe')).toBe(true);
    expect(temConsulta()).toBe(true);
    const antes = chamadas.mock.calls.length;

    act(() => { captura.previa.entrar({ pessoaId: OUTRO, nome: 'Bruno Silva', perfil: 'Secretária', codigos: SECRETARIA }); });
    await assentarMuito();

    expect(screen.getByText(/Prévia\. É assim que Bruno Silva \(Secretária\) vê o Procedi/)).toBeTruthy();
    expect(temMenu('Pacientes')).toBe(true);
    expect(temMenu('Gestão de Equipe')).toBe(false);
    expect(temConsulta()).toBe(false);
    expect(ultimoRoteador().state.location.pathname).toBe(caminhos.membro(OUTRO));
    expect(chamadas.mock.calls.length).toBe(antes);

    fireEvent.click(screen.getByRole('button', { name: 'Sair da prévia' }));
    await assentarMuito();
    expect(screen.queryByText(/É assim que Bruno Silva/)).toBeNull();
    expect(temMenu('Gestão de Equipe')).toBe(true);
    expect(temConsulta()).toBe(true);
    expect(ultimoRoteador().state.location.pathname).toBe(caminhos.membro(OUTRO));
  }, TIMEOUT);
});
