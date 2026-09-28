import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { RoleGuard, PERMISSOES } from './RoleGuard';
import * as OrgContextModule from '../../contexts/OrgContext';

vi.mock('../../contexts/OrgContext', () => ({
  useOrg: vi.fn(),
}));

describe('RoleGuard RBAC', () => {
  it('renderiza os filhos quando o usuário tem a requiredPermission', () => {
    vi.mocked(OrgContextModule.useOrg).mockReturnValue({
      papel: 'NIVEL_2',
      permissoes: [PERMISSOES.PACIENTE_VER],
    });

    render(
      <RoleGuard requiredPermission={PERMISSOES.PACIENTE_VER}>
        <div>Conteúdo Protegido Pacientes</div>
      </RoleGuard>
    );

    expect(screen.getByText('Conteúdo Protegido Pacientes')).toBeInTheDocument();
  });

  it('não renderiza e exibe tela de Acesso Restrito quando showError=true e usuário não tem permissão', () => {
    vi.mocked(OrgContextModule.useOrg).mockReturnValue({
      papel: 'NIVEL_2',
      permissoes: [PERMISSOES.PACIENTE_VER],
    });

    render(
      <RoleGuard requiredPermission={PERMISSOES.PACIENTE_GALERIA_VER} showError>
        <div>Galeria Sigilosa</div>
      </RoleGuard>
    );

    expect(screen.queryByText('Galeria Sigilosa')).not.toBeInTheDocument();
    expect(screen.getByText('Acesso Restrito')).toBeInTheDocument();
  });

  it('suporta anyPermission onde pelo menos uma permissão satisfaz', () => {
    vi.mocked(OrgContextModule.useOrg).mockReturnValue({
      papel: 'NIVEL_2',
      permissoes: [PERMISSOES.AGENDA_VER],
    });

    render(
      <RoleGuard anyPermission={[PERMISSOES.USUARIO_VER, PERMISSOES.AGENDA_VER]}>
        <div>Acesso Permitido via Agenda</div>
      </RoleGuard>
    );

    expect(screen.getByText('Acesso Permitido via Agenda')).toBeInTheDocument();
  });

  it('suporta requiredPermissions onde todas devem estar presentes', () => {
    vi.mocked(OrgContextModule.useOrg).mockReturnValue({
      papel: 'NIVEL_2',
      permissoes: [PERMISSOES.AGENDA_VER],
    });

    render(
      <RoleGuard requiredPermissions={[PERMISSOES.AGENDA_VER, PERMISSOES.USUARIO_VER]} fallback={<div>Acesso Negado</div>}>
        <div>Conteúdo Duplo</div>
      </RoleGuard>
    );

    expect(screen.queryByText('Conteúdo Duplo')).not.toBeInTheDocument();
    expect(screen.getByText('Acesso Negado')).toBeInTheDocument();
  });

  it('Dono aguarda permissões contextuais antes de renderizar conteúdo protegido', () => {
    vi.mocked(OrgContextModule.useOrg).mockReturnValue({
      papel: 'DONO',
      permissoes: [],
    });

    render(
      <RoleGuard requiredPermission={PERMISSOES.PERFIL_ACESSO_EDITAR}>
        <div>Painel do Dono</div>
      </RoleGuard>
    );

    expect(screen.queryByText('Painel do Dono')).not.toBeInTheDocument();
  });
});
