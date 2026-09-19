import React from 'react';
import { usePapel } from '../../hooks/usePapel';
import { PERMISSOES, PERFIS_ACESSO } from '../../constants/permissoes';
import { ShieldAlert } from 'lucide-react';

export { PERMISSOES, PERFIS_ACESSO };

/**
 * Componente de controle de acesso visual por perfil e permissões canônicas (RBAC).
 *
 * @param {{
 *   allowedRoles?: string[],
 *   minLevel?: 'DONO'|'NIVEL_5'|'NIVEL_4'|'NIVEL_3'|'NIVEL_2'|'NIVEL_1',
 *   requiredPermission?: string | string[],
 *   requiredPermissions?: string[],
 *   anyPermission?: string[],
 *   condition?: boolean,
 *   fallback?: React.ReactNode,
 *   showError?: boolean,
 *   children: React.ReactNode
 * }} props
 */
export function RoleGuard({ 
  allowedRoles, 
  minLevel, 
  requiredPermission,
  requiredPermissions,
  anyPermission,
  condition,
  fallback = null, 
  showError = false, 
  children 
}) {
  const { papel, isAtLeast, hasPerm } = usePapel();

  let isAuthorized = true;

  if (allowedRoles && !allowedRoles.includes(papel)) {
    isAuthorized = false;
  }

  // Verifica condicao booleana explicita primeiro
  if (condition !== undefined) {
    if (!condition) {
      isAuthorized = false;
    }
  } else if (anyPermission && anyPermission.length > 0) {
    // Ao menos uma permissão da lista é necessária
    if (!anyPermission.some(p => hasPerm(p, minLevel))) {
      isAuthorized = false;
    }
  } else if (requiredPermissions && requiredPermissions.length > 0) {
    // Todas as permissões da lista são necessárias
    if (!requiredPermissions.every(p => hasPerm(p, minLevel))) {
      isAuthorized = false;
    }
  } else if (requiredPermission) {
    // Se for array ou string única
    if (Array.isArray(requiredPermission)) {
      if (!requiredPermission.every(p => hasPerm(p, minLevel))) {
        isAuthorized = false;
      }
    } else {
      if (!hasPerm(requiredPermission, minLevel)) {
        isAuthorized = false;
      }
    }
  } else if (minLevel && !isAtLeast(minLevel)) {
    // Modo legado apenas por nivel (falha para CST_)
    isAuthorized = false;
  }

  if (!isAuthorized) {
    if (showError) {
      return (
        <div className="flex flex-col items-center justify-center p-8 rounded-2xl border border-app-border bg-white shadow-sm text-center">
          <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center mb-4">
            <ShieldAlert className="h-6 w-6 text-red-500" />
          </div>
          <h3 className="text-lg font-bold text-slate-900 mb-1">Acesso Restrito</h3>
          <p className="text-sm text-slate-500 max-w-[280px]">
            Você não possui permissão para acessar esta funcionalidade.
          </p>
        </div>
      );
    }
    return fallback;
  }

  return <>{children}</>;
}
