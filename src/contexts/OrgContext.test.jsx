import React, { useEffect } from 'react';
import { act, cleanup, renderHook } from '@testing-library/react';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../services/api', () => ({ setOrgId: vi.fn(), getOrgId: () => '' }));
vi.mock('../utils/authMeProbe', () => ({ invalidateAuthMeCache: vi.fn() }));

import { OrgProvider, useOrg } from './OrgContext';

const ORG = '330e8b5c-8687-48dd-a534-d12aea1d5cd7';
const OTHER = 'd0000000-0000-0000-0000-0000000000aa';
const wrapper = ({ children }) => <OrgProvider>{children}</OrgProvider>;

describe('restauração do contexto da clínica', () => {
  beforeEach(() => { localStorage.clear(); localStorage.setItem('procedi_org_id', ORG); });
  afterEach(cleanup);

  function loadPermissions(result) {
    act(() => {
      result.current.setRoleUserId('vinculo');
      result.current.setPapel('DONO');
      result.current.setRoleNome('DONO');
      result.current.setPermissoes(['PACIENTE_VER']);
      result.current.setApareceNaAgenda(true);
      result.current.setFusoHorario('America/Rio_Branco');
      result.current.setContextStatus('ready');
    });
  }

  it('preserva /me quando a descoberta confirma depois a clínica salva', () => {
    const fetchContext = vi.fn();
    const { result } = renderHook(() => {
      const org = useOrg();
      useEffect(() => { fetchContext(org.orgId); }, [org.orgId]);
      return org;
    }, { wrapper });
    loadPermissions(result);
    act(() => result.current.setOrgId(ORG, 'clinica-top'));
    expect(result.current).toMatchObject({ contextStatus: 'ready', papel: 'DONO', roleNome: 'DONO',
      roleUserId: 'vinculo', permissoes: ['PACIENTE_VER'], apareceNaAgenda: true, orgSlug: 'clinica-top',
      fusoHorario: 'America/Rio_Branco' });
    expect(fetchContext).toHaveBeenCalledTimes(1);
  });

  it('preserva o carregamento quando a descoberta termina antes de /me', () => {
    const { result } = renderHook(useOrg, { wrapper });
    act(() => result.current.setContextStatus('loading'));
    act(() => result.current.setOrgId(ORG));
    loadPermissions(result);
    expect(result.current.contextStatus).toBe('ready');
    expect(result.current.permissoes).toEqual(['PACIENTE_VER']);
    expect(result.current.fusoHorario).toBe('America/Rio_Branco');
  });

  it('limpa permissões ao trocar realmente de clínica', () => {
    const { result } = renderHook(useOrg, { wrapper });
    loadPermissions(result);
    act(() => result.current.setOrgId(OTHER));
    expect(result.current).toMatchObject({ orgId: OTHER, contextStatus: 'loading', papel: null,
      roleUserId: '', roleNome: '', permissoes: [], apareceNaAgenda: null, fusoHorario: null });
  });

  it('recarrega a mesma clínica após logout, sem preservar autorização anterior', () => {
    const { result } = renderHook(useOrg, { wrapper });
    loadPermissions(result);
    act(() => result.current.clearOrgSession());
    act(() => result.current.setOrgId(ORG));
    expect(result.current).toMatchObject({ orgId: ORG, contextStatus: 'loading', papel: null, permissoes: [], fusoHorario: null });
  });
});
