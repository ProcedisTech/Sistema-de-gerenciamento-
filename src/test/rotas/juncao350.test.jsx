// Junção do #350 (equipe/RBAC/auditoria) com as rotas: o App real, só por endereço.
import React from 'react';
import { fireEvent, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import '@testing-library/jest-dom';
import { limparAmbienteSnapshot } from '../snapshotConsulta.jsx';
import { ROLE_USER_ID } from '../encerrar/servidorEncerrarFalso.js';
import { TIMEOUT, assentarMuito, montarApp } from '../consulta/appConsulta.jsx';
import { ultimoRoteador } from './montarComRoteador.jsx';
import { PERMISSOES } from '../../constants/permissoes.js';

vi.mock('../../lib/supabaseClient.js', async () => (await import('../encerrar/servidorEncerrarFalso.js')).supabaseFalso());
vi.mock('../../contexts/AvisosProvider.jsx', async () => (await import('../consulta/canalAvisosTeste.jsx')).avisosProviderFalso());
// Sidebar de desktop (no jsdom o matchMedia é sempre falso e só aparece a navegação do celular).
vi.mock('../../hooks/useMediaQuery.js', () => ({ useMediaQuery: (q) => q === '(min-width: 1024px)' }));
vi.mock('../../components/configuracoes/AuditoriaView', () => ({ AuditoriaView: () => <div>Auditoria da clínica</div> }));

const pessoa = {
  id: ROLE_USER_ID,
  usuarioId: 'usr-1',
  nomeCompleto: 'Beatriz Lima',
  ativo: true,
  apareceNaAgenda: true,
  perfilAcessoCodigo: 'DONO',
  perfilAcessoNome: 'Dono',
  roleName: 'MEDICO',
};
const grade = [{ diaSemana: 1, horaInicio: '08:00', horaFim: '12:00', ativo: true }];
const rotas = () => [
  ['GET', /^\/api\/v1\/clinica$/, ({ headers }) => ({ id: headers['x-org-id'], nome: 'Clínica Teste', tipoOrg: 'clinica' })],
  ['GET', /^\/api\/v1\/perfil$/, () => ({ ...pessoa, id: 'usr-1' })],
  ['GET', /^\/api\/v1\/equipe$/, () => [pessoa]],
  ['GET', /^\/api\/v1\/equipe\/[^/]+\/disponibilidade$/, () => ({ seguirHorarioClinica: true, turnos: [], gradeClinica: grade })],
  ['GET', /^\/api\/v1\/organizacoes\/[^/]+\/horarios$/, () => grade],
];
const local = () => ultimoRoteador().state.location.pathname;
const acao = () => ultimoRoteador().state.historyAction;
const semAuditoria = Object.values(PERMISSOES).filter((p) => p !== PERMISSOES.AUDITORIA_VER);

afterEach(() => {
  limparAmbienteSnapshot();
  sessionStorage.clear();
  localStorage.clear();
});

describe('junção #350 x rotas', () => {
  it('(a) /auditoria por endereço (F5) mostra a AuditoriaView', async () => {
    await montarApp({ caminho: '/auditoria', rotas: rotas() });
    expect(screen.getByText('Auditoria da clínica')).toBeInTheDocument();
    expect(local()).toBe('/auditoria');
  }, TIMEOUT);

  it('(a) /auditoria sem permissão cai em /pacientes com replace', async () => {
    await montarApp({ caminho: '/auditoria', rotas: rotas(), permissoes: semAuditoria });
    expect(screen.queryByText('Auditoria da clínica')).not.toBeInTheDocument();
    expect(local()).toBe('/pacientes');
    expect(acao()).toBe('REPLACE');
  }, TIMEOUT);

  it('(a) item Auditoria da Sidebar empilha (push) em /auditoria', async () => {
    await montarApp({ caminho: '/agenda', rotas: rotas() });
    fireEvent.click(screen.getAllByRole('button', { name: 'Auditoria' })[0]);
    await assentarMuito();
    expect(local()).toBe('/auditoria');
    expect(acao()).toBe('PUSH');
    expect(screen.getByText('Auditoria da clínica')).toBeInTheDocument();
  }, TIMEOUT);

  it('(b) /equipe/:membroId abre a pessoa e o botão Agendar com abre o modal sem sair da tela (#350)', async () => {
    await montarApp({ caminho: `/equipe/${ROLE_USER_ID}`, rotas: rotas() });
    expect(local()).toBe(`/equipe/${ROLE_USER_ID}`);
    fireEvent.click(await screen.findByRole('button', { name: /Agendar com Beatriz/ }));
    await assentarMuito();
    expect(screen.getByRole('dialog', { name: /agendamento/i })).toBeInTheDocument();
    // sem navegação: a pessoa continua no endereço de antes (como no #350, que não trocava de tela)
    expect(local()).toBe(`/equipe/${ROLE_USER_ID}`);
    expect(acao()).toBe('POP');
  }, TIMEOUT);
});
