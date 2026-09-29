import { useMemo } from 'react';
import { useOrg } from '../contexts/OrgContext.jsx';

function normalizeRoleCodigo(roleNome) {
  return String(roleNome || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

export function useUsuarioLogado() {
  const { roleUserId, roleNome, apareceNaAgenda } = useOrg();

  return useMemo(() => {
    const role = normalizeRoleCodigo(roleNome);
    const ehProfissionalClinico = Boolean(apareceNaAgenda);

    return {
      roleUserId: roleUserId ? String(roleUserId) : '',
      role,
      roleNome: roleNome ? String(roleNome) : '',
      ehProfissionalClinico,
      apareceNaAgenda: Boolean(apareceNaAgenda),
    };
  }, [roleUserId, roleNome, apareceNaAgenda]);
}
