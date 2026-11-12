import React from 'react';
import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import '@testing-library/jest-dom';

const mocks = vi.hoisted(() => ({ access: {}, buscarPerfil: vi.fn() }));
vi.mock('../../hooks/usePapel', () => ({ usePapel: () => mocks.access }));
vi.mock('../../contexts/useToast.js', () => ({ useToast: () => ({ error: vi.fn(), success: vi.fn(), info: vi.fn() }) }));
vi.mock('../../contexts/OrgContext', () => ({
  useOrg: () => ({ roleUserId: 'owner', recarregarContextoOrg: vi.fn() }),
}));
vi.mock('../../components/hooks/useAgoraDaClinica.js', () => ({
  useAgoraDaClinica: () => ({ hojeIso: '2026-11-07', fuso: 'America/Sao_Paulo' }),
}));
vi.mock('../../services/api', () => ({
  authHeadersForFetch: vi.fn(async () => ({})),
  configuracoesClinicaApi: { buscar: vi.fn(async () => ({})) },
  agendasApi: { byRange: vi.fn(async () => []) },
  equipeApi: { update: vi.fn() },
  perfilApi: { buscar: mocks.buscarPerfil },
  getApiErrorDetail: ({ body }) => body.message,
  getApiErrorToastMessage: (e, f) => e.message || f,
}));
vi.mock('../../components/configuracoes/InviteModal', () => ({ InviteModal: () => null }));
vi.mock('../../components/configuracoes/EditRoleModal', () => ({ EditRoleModal: () => null }));
vi.mock('../../components/configuracoes/DisponibilidadeProfissionalModal', () => ({ default: () => null }));
vi.mock('../../components/configuracoes/AuditoriaView', () => ({ AuditoriaView: () => <div>Auditoria da clínica</div> }));
vi.mock('../../components/configuracoes/GestaoPerfisTab', () => ({ GestaoPerfisTab: () => <div>Editor de perfis</div> }));
vi.mock('../../components/configuracoes/EquipePessoaView', () => ({
  default: ({ pessoa }) => <h2>Pessoa: {pessoa.nomeCompleto}</h2>,
}));

import { GestaoUsuariosView } from '../../components/configuracoes/GestaoUsuariosView.jsx';
import { montarComRoteador, ultimoRoteador } from './montarComRoteador.jsx';

const equipe = [
  { id: 'owner', nomeCompleto: 'Ana Dono', perfilAcessoId: 'dono', perfilAcessoCodigo: 'DONO', perfilAcessoNome: 'Dono', roleId: 'd', roleName: 'DENTISTA', ativo: true },
  { id: 'member', nomeCompleto: 'Bruno Silva', perfilAcessoId: 'clinico', perfilAcessoNome: 'Clínico', roleId: 'd', roleName: 'DENTISTA', ativo: true },
];
const montar = (caminho) => montarComRoteador(<GestaoUsuariosView />, { caminho });
const local = () => ultimoRoteador().state.location.pathname;

beforeEach(() => {
  mocks.access = {
    canSeeConfigEquipe: true, canCreateUsers: true, canManageUsers: true, canDeleteUsers: true,
    canSeeConfigPerfil: true, canEditConfigPerfil: true, canSeeConfigAuditoria: true,
  };
  mocks.buscarPerfil.mockResolvedValue({ id: 'u', nomeCompleto: 'Ana Pessoal' });
  vi.stubGlobal('fetch', vi.fn(async (url) => ({
    ok: true,
    json: async () => (String(url).endsWith('/equipe') ? equipe : []),
  })));
});
afterEach(() => vi.unstubAllGlobals());

it('F5 em /equipe/perfis abre a aba Perfis', async () => {
  montar('/equipe/perfis');
  expect(await screen.findByText('Editor de perfis')).toBeInTheDocument();
});

it('F5 em /equipe/auditoria abre a aba Auditoria', async () => {
  montar('/equipe/auditoria');
  expect(await screen.findByText('Auditoria da clínica')).toBeInTheDocument();
});

it('clicar num membro empilha /equipe/<id> e Voltar volta à lista', async () => {
  montar('/equipe');
  fireEvent.click(await screen.findByRole('button', { name: 'Ver Bruno Silva' }));
  expect(await screen.findByText('Pessoa: Bruno Silva')).toBeInTheDocument();
  await waitFor(() => expect(local()).toBe('/equipe/member'));
  await act(async () => { await ultimoRoteador().navigate(-1); });
  await waitFor(() => expect(local()).toBe('/equipe'));
  expect(await screen.findByRole('button', { name: 'Ver Bruno Silva' })).toBeInTheDocument();
});

it('/equipe/<id inexistente> mostra Não encontrado', async () => {
  montar('/equipe/ninguem');
  expect(await screen.findByText('Não encontrado')).toBeInTheDocument();
});

it('sem permissão de equipe, /equipe/<outro> não abre e não busca a equipe', async () => {
  mocks.access = { canSeeConfigEquipe: false };
  montar('/equipe/member');
  expect(screen.getByText('Você não tem permissão para visualizar a equipe.')).toBeInTheDocument();
  expect(fetch).not.toHaveBeenCalled();
});

it('sem permissão de equipe, o próprio perfil continua abrindo', async () => {
  mocks.access = { canSeeConfigEquipe: false };
  montar('/equipe/me');
  expect(await screen.findByText('Pessoa: Ana Pessoal')).toBeInTheDocument();
});
