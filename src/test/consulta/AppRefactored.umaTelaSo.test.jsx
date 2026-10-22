// Integração no App real: monta AppRoot/AppRefactored, OrgContext e painéis reais do modelo unificado de clínica.
import React from 'react';
import { PERMISSOES } from '../../constants/permissoes.js';
import { fireEvent, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { limparAmbienteSnapshot } from '../snapshotConsulta.jsx';
import { ORG_ID, ROLE_USER_ID } from '../encerrar/servidorEncerrarFalso.js';
import { TIMEOUT, assentarMuito, montarApp } from './appConsulta.jsx';

vi.mock('../../lib/supabaseClient.js', async () => (await import('../encerrar/servidorEncerrarFalso.js')).supabaseFalso());
vi.mock('../../contexts/AvisosProvider.jsx', async () => (await import('./canalAvisosTeste.jsx')).avisosProviderFalso());

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

function rotas() {
  return [
    ['GET', /^\/api\/v1\/clinica$/, ({ headers }) => ({ id: headers['x-org-id'], nome: 'Clínica Teste', tipoOrg: 'clinica' })],
    ['GET', /^\/api\/v1\/perfil$/, () => ({ ...pessoa, id: 'usr-1' })],
    ['GET', /^\/api\/v1\/equipe$/, () => [pessoa]],
    ['GET', /^\/api\/v1\/equipe\/[^/]+\/disponibilidade$/, () => ({ seguirHorarioClinica: true, turnos: [], gradeClinica: grade })],
    ['GET', /^\/api\/v1\/organizacoes\/[^/]+\/horarios$/, () => grade],
  ];
}

async function perfil(extra = {}) {
  return montarApp({ view: 'configuracoes', sessao: { procedi_config_section: 'perfil' }, rotas: rotas(), ...extra });
}

afterEach(() => {
  limparAmbienteSnapshot();
  sessionStorage.clear();
  localStorage.clear();
});

describe('Modelo unificado de clínica no App real', () => {
  it('Meu Perfil exibe horário herdado da clínica e abre modal de disponibilidade sem aviso de Modo Autônomo', async () => {
    await perfil();
    expect(screen.queryByText(/Modo Autônomo/)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Gerenciar horários' })).not.toBeInTheDocument();
    expect(screen.getByText('08:00 - 12:00')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /^editar$/i }));
    await assentarMuito();
    expect(screen.getByRole('dialog', { name: 'Disponibilidade do profissional' })).toBeInTheDocument();
  }, TIMEOUT);

  it('Gestão de Equipe permite abrir o modal de disponibilidade do membro diretamente', async () => {
    await montarApp({ view: 'gestao-equipe', rotas: rotas() });
    fireEvent.click(screen.getByRole('button', { name: 'Ver Beatriz Lima' }));
    await assentarMuito();
    expect(screen.queryByText(/Modo Autônomo/)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /^editar$/i }));
    await assentarMuito();
    expect(screen.getByRole('dialog', { name: 'Disponibilidade do profissional' })).toBeInTheDocument();
  }, TIMEOUT);

  it('sem permissão de gestão de disponibilidade, Meu Perfil oculta botão editar e não mostra Modo Autônomo', async () => {
    await perfil({
      rotas: [
        [
          'GET',
          /^\/api\/auth\/me$/,
          () => ({
            id: 'usr-1',
            nomeCompleto: 'Beatriz Lima',
            roleUserId: ROLE_USER_ID,
            organizacaoId: ORG_ID,
            perfilAcessoCodigo: 'CST_SEM_AGENDA',
            permissoes: [PERMISSOES.PERFIL_ACESSO_VER],
            apareceNaAgenda: true,
            fusoHorario: 'America/Sao_Paulo',
          }),
        ],
        ...rotas(),
      ],
    });
    expect(screen.queryByText(/Modo Autônomo/)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^editar$/i })).not.toBeInTheDocument();
    expect(screen.getByText('08:00 - 12:00')).toBeInTheDocument();
  }, TIMEOUT);

  it('guard local preserva alterações nos horários da clínica quando usuário cancela saída do painel', async () => {
    await montarApp({ view: 'configuracoes', sessao: { procedi_config_section: 'horarios-funcionamento' }, rotas: rotas() });
    expect(screen.queryByRole('radio')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('switch', { name: 'Terça-feira inativo' }));
    fireEvent.click(screen.getAllByRole('button', { name: 'Feriados' })[0]);
    await assentarMuito();

    expect(screen.getByRole('button', { name: 'Continuar editando' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Continuar editando' }));
    expect(screen.getByRole('switch', { name: 'Terça-feira ativo' })).toBeInTheDocument();
    expect(sessionStorage.getItem('procedi_config_section')).toBe('horarios-funcionamento');

    fireEvent.click(screen.getAllByRole('button', { name: 'Feriados' })[0]);
    fireEvent.click(screen.getByRole('button', { name: 'Sair sem salvar' }));
    await assentarMuito();
    expect(sessionStorage.getItem('procedi_config_section')).toBe('agenda-feriados');
  }, TIMEOUT);
});
