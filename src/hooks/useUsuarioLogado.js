import { useMemo } from 'react';
import { useOrg } from '../contexts/OrgContext.jsx';

export const CLINICAL_ROLE_CODIGOS = Object.freeze([
  'medico',
  'médico',
  'esteticista',
  'dentista',
  'biomedico',
]);

function normalizeRoleCodigo(roleNome) {
  return String(roleNome || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

export function isClinicalRoleCodigo(roleCodigo) {
  const n = normalizeRoleCodigo(roleCodigo);
  return CLINICAL_ROLE_CODIGOS.includes(n) || n === 'medico';
}

export function useUsuarioLogado() {
  const { roleUserId, roleNome } = useOrg();

  return useMemo(() => {
    const role = normalizeRoleCodigo(roleNome);
    const ehProfissionalClinico = isClinicalRoleCodigo(role);
    return {
      roleUserId: roleUserId ? String(roleUserId) : '',
      role,
      roleNome: roleNome ? String(roleNome) : '',
      ehProfissionalClinico,
    };
  }, [roleUserId, roleNome]);
}
